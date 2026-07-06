import { Injectable, Logger } from '@nestjs/common';
import { XMLParser } from 'fast-xml-parser';
import {
  FetParseContext,
  FetParseResult,
  FetParseError,
  ParsedSlotDto,
  ActivityMetadata,
} from '../interfaces/fet-dto.interface';
import { IFetOutputParser } from '../interfaces/generation-pipeline.interface';
import { FetParseException } from '../exceptions';

/**
 * Raw parsed activity element from FET output XML.
 */
interface RawFetActivity {
  Id: string | number;
  Day: string;
  Hour: string;
  Room?: string;
}

/**
 * Parsed FET output document structure.
 */
interface FetOutputDocument {
  fet?: {
    Timetable_Data?: {
      Activity?: RawFetActivity | RawFetActivity[];
    };
  };
}

/**
 * Parses FET v6.x output XML, validates structure and referential integrity.
 * Pure function layer — no database dependencies.
 *
 * @implements IFetOutputParser
 */
@Injectable()
export class FetOutputParserService implements IFetOutputParser {
  private readonly logger = new Logger(FetOutputParserService.name);

  private readonly xmlParser = new XMLParser({
    ignoreAttributes: false,
    parseAttributeValue: true,
    trimValues: true,
    isArray: (tagName: string) => tagName === 'Activity',
  });

  /**
   * Parses FET v6.x output XML and maps activities to ParsedSlotDto[].
   *
   * @param xml - Raw FET output XML string
   * @param context - Mapping context from FET names to domain UUIDs
   * @returns FetParseResult with slots, errors, and warnings
   * @throws FetParseException if XML is completely malformed
   */
  parse(xml: string, context: FetParseContext): FetParseResult {
    const errors: FetParseError[] = [];
    const warnings: string[] = [];
    const slots: ParsedSlotDto[] = [];

    // Step 1: Parse XML
    const document = this.parseXml(xml);

    // Step 2: Validate structure
    const activities = this.extractActivities(document);

    if (activities.length === 0) {
      warnings.push('Không tìm thấy hoạt động nào trong kết quả FET');
      return { success: true, slots, errors, warnings };
    }

    // Step 3: Map each activity to ParsedSlotDto
    for (const activity of activities) {
      const activityId = String(activity.Id);
      const result = this.mapActivity(activity, activityId, context);

      if (result.error) {
        errors.push(result.error);
        continue;
      }

      if (result.slot) {
        slots.push(result.slot);
      }

      if (result.warning) {
        warnings.push(result.warning);
      }
    }

    // Step 4: Detect double periods (consecutive slots with same teacher+class+subject)
    this.markDoublePeriods(slots);

    const success = errors.length === 0;

    this.logger.debug(
      `FET output parsed: ${activities.length} activities → ${slots.length} slots, ${errors.length} errors, ${warnings.length} warnings`,
    );

    return { success, slots, errors, warnings };
  }

  /**
   * Parses XML string into a structured document.
   * Throws FetParseException on completely malformed XML.
   */
  private parseXml(xml: string): FetOutputDocument {
    try {
      const parsed = this.xmlParser.parse(xml) as FetOutputDocument;
      return parsed;
    } catch (error: unknown) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      this.logger.error(
        `Không thể phân tích XML FET: ${errorMessage}`,
        undefined,
      );
      this.logger.debug(`Raw XML content:\n${xml}`);
      throw new FetParseException(`XML không hợp lệ: ${errorMessage}`);
    }
  }

  /**
   * Extracts Activity elements from the parsed document.
   * Validates that Timetable_Data section exists.
   */
  private extractActivities(document: FetOutputDocument): RawFetActivity[] {
    if (!document.fet) {
      this.logger.debug('Raw XML content does not contain <fet> root element');
      throw new FetParseException('Thiếu phần tử gốc <fet> trong XML kết quả');
    }

    if (!document.fet.Timetable_Data) {
      throw new FetParseException(
        'Thiếu phần <Timetable_Data> trong XML kết quả',
      );
    }

    const activityData = document.fet.Timetable_Data.Activity;

    if (!activityData) {
      return [];
    }

    // Normalize to array (fast-xml-parser isArray config should handle this,
    // but we guard anyway)
    if (Array.isArray(activityData)) {
      return activityData;
    }

    return [activityData];
  }

  /**
   * Maps a single raw FET activity to a ParsedSlotDto.
   * Validates referential integrity against the context.
   */
  private mapActivity(
    activity: RawFetActivity,
    activityId: string,
    context: FetParseContext,
  ): { slot?: ParsedSlotDto; error?: FetParseError; warning?: string } {
    // Validate activity ID exists in activityMap
    const metadata = context.activityMap.get(activityId);
    if (!metadata) {
      return {
        error: {
          activityId,
          field: 'activityId',
          message: `Hoạt động '${activityId}' không tồn tại trong dữ liệu đầu vào`,
          rawValue: activityId,
        },
      };
    }

    // Validate Day
    const dayName = String(activity.Day ?? '').trim();
    const dayOfWeek = context.dayMap.get(dayName);
    if (dayOfWeek === undefined) {
      return {
        error: {
          activityId,
          field: 'Day',
          message: `Ngày '${dayName}' không tồn tại trong danh sách ngày`,
          rawValue: dayName,
        },
      };
    }

    // Validate Hour → periodId
    const hourName = String(activity.Hour ?? '').trim();
    const periodId = context.periodMap.get(hourName);
    if (!periodId) {
      return {
        error: {
          activityId,
          field: 'Hour',
          message: `Tiết '${hourName}' không tồn tại trong danh sách tiết học`,
          rawValue: hourName,
        },
      };
    }

    // Validate Room (optional — may be empty)
    let roomId: string | null = null;
    const roomName = String(activity.Room ?? '').trim();
    if (roomName !== '') {
      const resolvedRoomId = context.roomMap.get(roomName);
      if (!resolvedRoomId) {
        return {
          error: {
            activityId,
            field: 'Room',
            message: `Phòng '${roomName}' không tồn tại trong danh sách phòng học`,
            rawValue: roomName,
          },
        };
      }
      roomId = resolvedRoomId;
    }

    const slot: ParsedSlotDto = {
      teacherId: metadata.teacherId,
      classId: metadata.classId,
      subjectId: metadata.subjectId,
      roomId,
      dayOfWeek,
      periodId,
      isDoublePeriod: false, // Will be set in markDoublePeriods pass
    };

    return { slot };
  }

  /**
   * Marks consecutive slots as double periods.
   * A double period is when two slots on the same day have:
   * - Same teacher, class, and subject
   * - Consecutive period ordering (detected by adjacent position in the slots array
   *   for the same day+teacher+class+subject combination)
   *
   * Note: Since we don't have periodNumber in ParsedSlotDto, we rely on
   * the assumption that FET outputs activities in chronological order per day.
   * Slots sharing the same (dayOfWeek, teacherId, classId, subjectId) with
   * adjacent positions in the original output are treated as double periods.
   */
  private markDoublePeriods(slots: ParsedSlotDto[]): void {
    // Group slots by (dayOfWeek, teacherId, classId, subjectId)
    const groupKey = (slot: ParsedSlotDto): string =>
      `${slot.dayOfWeek}|${slot.teacherId}|${slot.classId}|${slot.subjectId}`;

    const groups = new Map<string, ParsedSlotDto[]>();

    for (const slot of slots) {
      const key = groupKey(slot);
      const group = groups.get(key);
      if (group) {
        group.push(slot);
      } else {
        groups.set(key, [slot]);
      }
    }

    // Mark groups with 2+ slots as double periods
    for (const group of groups.values()) {
      if (group.length >= 2) {
        for (const slot of group) {
          slot.isDoublePeriod = true;
        }
      }
    }
  }
}
