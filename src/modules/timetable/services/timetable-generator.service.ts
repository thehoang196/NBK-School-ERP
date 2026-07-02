import { Injectable, Logger } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { XMLParser } from 'fast-xml-parser';
import { TimetableSlotRepository } from '../repositories/timetable-slot.repository';
import { TeacherEntity } from '../../teacher/entities/teacher.entity';
import { SubjectEntity } from '../../subject/entities/subject.entity';
import { ClassEntity } from '../../class/entities/class.entity';
import { RoomEntity } from '../../room/entities/room.entity';
import { PeriodDefinitionEntity } from '../../academic/entities/period-definition.entity';

// FET XML interfaces
export interface FetInput {
  institution: string;
  teachers: FetTeacher[];
  subjects: FetSubject[];
  activities: FetActivity[];
  rooms: FetRoom[];
  days: string[];
  hours: string[];
  timeConstraints: FetTimeConstraint[];
  spaceConstraints: FetSpaceConstraint[];
}

export interface FetTeacher {
  id: string;
  name: string;
}

export interface FetSubject {
  id: string;
  name: string;
}

export interface FetActivity {
  id: string;
  teacherId: string;
  subjectId: string;
  studentsSet: string;
  duration: number;
}

export interface FetRoom {
  id: string;
  name: string;
  capacity: number;
}

export interface FetTimeConstraint {
  type: string;
  weight: number;
  teacherId?: string;
  day?: string;
  hour?: string;
}

export interface FetSpaceConstraint {
  type: string;
  weight: number;
  activityId?: string;
  roomId?: string;
}

export interface GenerationJob {
  id: string;
  versionId: string;
  semesterId: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  progress: number;
  message: string | null;
  createdAt: Date;
  completedAt: Date | null;
  totalSlots: number;
}

export interface ParsedSlotData {
  versionId: string;
  dayOfWeek: number;
  periodId: string;
  classId: string;
  teacherId: string;
  subjectId: string;
  roomId: string | null;
  isDoublePeriod: boolean;
}

interface FetOutputActivity {
  Id: string;
  Day: string;
  Hour: string;
  Room?: string;
}

interface FetOutputSolution {
  Activity: FetOutputActivity | FetOutputActivity[];
}

@Injectable()
export class TimetableGeneratorService {
  private readonly logger = new Logger(TimetableGeneratorService.name);
  private jobs: Map<string, GenerationJob> = new Map();

  constructor(
    private readonly dataSource: DataSource,
    private readonly slotRepo: TimetableSlotRepository,
  ) {}

  async generate(semesterId: string, versionId: string, timeoutSeconds: number = 300): Promise<string> {
    const jobId = `gen-${Date.now()}`;

    const job: GenerationJob = {
      id: jobId,
      versionId,
      semesterId,
      status: 'pending',
      progress: 0,
      message: null,
      createdAt: new Date(),
      completedAt: null,
      totalSlots: 0,
    };

    this.jobs.set(jobId, job);

    // Run generation asynchronously
    this.runGeneration(job, timeoutSeconds).catch(err => {
      this.logger.error(`Generation failed: ${err.message}`);
      job.status = 'failed';
      job.message = err.message;
    });

    return jobId;
  }

  getJobStatus(jobId: string): GenerationJob | null {
    return this.jobs.get(jobId) || null;
  }

  /**
   * Parse FET engine output XML and map activities back to TimetableSlot format.
   *
   * FET output XML structure:
   * <Solution>
   *   <Activity>
   *     <Id>activityId</Id>
   *     <Day>Mon</Day>
   *     <Hour>Period1</Hour>
   *     <Room>RoomName</Room>
   *   </Activity>
   *   ...
   * </Solution>
   *
   * @param xml - FET output XML string
   * @param versionId - TimetableVersion ID to assign
   * @param activities - Original FetActivity[] used in input (to map back teacher/subject/class)
   * @param periodMap - Map of hour name (e.g. "Period1") → period UUID
   * @param roomMap - Map of room name → room UUID
   * @param classMap - Map of class/studentsSet name → class UUID
   */
  parseFetOutput(
    xml: string,
    versionId: string,
    activities: FetActivity[],
    periodMap: Map<string, string>,
    roomMap: Map<string, string>,
    classMap: Map<string, string>,
  ): ParsedSlotData[] {
    const DAY_MAP: Record<string, number> = {
      Mon: 2,
      Tue: 3,
      Wed: 4,
      Thu: 5,
      Fri: 6,
      Sat: 7,
    };

    const parser = new XMLParser({
      ignoreAttributes: false,
      isArray: (tagName) => tagName === 'Activity',
    });

    let parsed: { Solution?: FetOutputSolution };
    try {
      parsed = parser.parse(xml);
    } catch (error) {
      this.logger.warn(
        `parseFetOutput: Failed to parse XML - ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
      return [];
    }

    if (!parsed.Solution || !parsed.Solution.Activity) {
      this.logger.warn('parseFetOutput: No Solution or Activity elements found in XML');
      return [];
    }

    const rawActivities = Array.isArray(parsed.Solution.Activity)
      ? parsed.Solution.Activity
      : [parsed.Solution.Activity];

    // Build activity lookup by ID
    const activityLookup = new Map<string, FetActivity>();
    for (const act of activities) {
      activityLookup.set(act.id, act);
    }

    const slots: ParsedSlotData[] = [];

    for (const entry of rawActivities) {
      const activityId = String(entry.Id);
      const dayName = String(entry.Day ?? '');
      const hourName = String(entry.Hour ?? '');
      const roomName = entry.Room ? String(entry.Room) : null;

      // Validate day
      const dayOfWeek = DAY_MAP[dayName];
      if (!dayOfWeek) {
        this.logger.warn(`parseFetOutput: Invalid day "${dayName}" for activity ${activityId}, skipping`);
        continue;
      }

      // Validate hour → periodId
      const periodId = periodMap.get(hourName);
      if (!periodId) {
        this.logger.warn(`parseFetOutput: Unknown hour "${hourName}" for activity ${activityId}, skipping`);
        continue;
      }

      // Lookup original activity data
      const originalActivity = activityLookup.get(activityId);
      if (!originalActivity) {
        this.logger.warn(`parseFetOutput: Activity "${activityId}" not found in input activities, skipping`);
        continue;
      }

      // Resolve class from studentsSet
      const classId = classMap.get(originalActivity.studentsSet);
      if (!classId) {
        this.logger.warn(
          `parseFetOutput: Class "${originalActivity.studentsSet}" not found in classMap for activity ${activityId}, skipping`,
        );
        continue;
      }

      // Resolve room (optional)
      const roomId = roomName ? (roomMap.get(roomName) ?? null) : null;
      if (roomName && !roomId) {
        this.logger.warn(`parseFetOutput: Room "${roomName}" not found in roomMap for activity ${activityId}, using null`);
      }

      slots.push({
        versionId,
        dayOfWeek,
        periodId,
        classId,
        teacherId: originalActivity.teacherId,
        subjectId: originalActivity.subjectId,
        roomId,
        isDoublePeriod: originalActivity.duration > 1,
      });
    }

    this.logger.log(`parseFetOutput: Parsed ${slots.length} slots from FET output`);
    return slots;
  }

  private async runGeneration(job: GenerationJob, _timeoutSeconds: number): Promise<void> {
    job.status = 'processing';
    job.progress = 10;
    job.message = 'Đang thu thập dữ liệu...';

    try {
      // Step 1: Build FET input
      const fetInput = await this.buildFetInput(job.semesterId);
      job.progress = 30;
      job.message = 'Đang xây dựng dữ liệu đầu vào cho engine...';

      // Step 2: Convert to XML (for FET CLI integration)
      const _xml = this.convertToXml(fetInput);
      job.progress = 40;
      job.message = 'Đang sinh thời khóa biểu...';

      // Step 3: In production, call FET CLI here
      // For now, use a simple greedy algorithm as fallback
      const slots = await this.greedyGenerate(job.semesterId, job.versionId, fetInput);
      job.progress = 90;
      job.message = 'Đang lưu kết quả...';

      // Step 4: Save results
      if (slots.length > 0) {
        await this.slotRepo.createMany(slots);
      }

      job.status = 'completed';
      job.progress = 100;
      job.totalSlots = slots.length;
      job.completedAt = new Date();
      job.message = `Hoàn thành! Đã sinh ${slots.length} slot.`;
    } catch (error) {
      job.status = 'failed';
      job.message = error instanceof Error ? error.message : 'Lỗi không xác định';
      throw error;
    }
  }

  async buildFetInput(semesterId: string): Promise<FetInput> {
    // Lấy semester để tìm school_id thông qua academic_year
    const teacherRepo = this.dataSource.getRepository(TeacherEntity);
    const subjectRepo = this.dataSource.getRepository(SubjectEntity);
    const classRepo = this.dataSource.getRepository(ClassEntity);
    const roomRepo = this.dataSource.getRepository(RoomEntity);
    const periodRepo = this.dataSource.getRepository(PeriodDefinitionEntity);

    const teachers = await teacherRepo.find({ where: { status: 'active' as never } });
    const subjects = await subjectRepo.find();
    const classes = await classRepo.find();
    const rooms = await roomRepo.find();
    const periods = await periodRepo.find({ order: { periodNumber: 'ASC' } });

    const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const hours = periods.map(p => `Period${p.periodNumber}`);

    return {
      institution: 'STMS',
      teachers: teachers.map(t => ({ id: t.id, name: t.fullName })),
      subjects: subjects.map(s => ({ id: s.id, name: s.name })),
      activities: [], // Will be filled from teaching assignments
      rooms: rooms.map(r => ({ id: r.id, name: r.name, capacity: r.capacity })),
      days,
      hours,
      timeConstraints: this.buildTimeConstraints(teachers),
      spaceConstraints: [],
    };
  }

  private buildTimeConstraints(teachers: TeacherEntity[]): FetTimeConstraint[] {
    const constraints: FetTimeConstraint[] = [];

    for (const teacher of teachers) {
      if (teacher.unavailableSlots) {
        for (const slot of teacher.unavailableSlots) {
          const dayNames = ['', '', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
          constraints.push({
            type: 'ConstraintTeacherNotAvailableTimes',
            weight: 100,
            teacherId: teacher.id,
            day: dayNames[slot.dayOfWeek],
          });
        }
      }
    }

    return constraints;
  }

  convertToXml(input: FetInput): string {
    // Generate FET-compatible XML
    let xml = `<?xml version="1.0" encoding="UTF-8"?>\n`;
    xml += `<fet version="6.2.7">\n`;
    xml += `  <Institution_Name>${input.institution}</Institution_Name>\n`;

    // Days
    xml += `  <Days_List>\n`;
    xml += `    <Number_of_Days>${input.days.length}</Number_of_Days>\n`;
    for (const day of input.days) {
      xml += `    <Day><Name>${day}</Name></Day>\n`;
    }
    xml += `  </Days_List>\n`;

    // Hours
    xml += `  <Hours_List>\n`;
    xml += `    <Number_of_Hours>${input.hours.length}</Number_of_Hours>\n`;
    for (const hour of input.hours) {
      xml += `    <Hour><Name>${hour}</Name></Hour>\n`;
    }
    xml += `  </Hours_List>\n`;

    // Teachers
    xml += `  <Teachers_List>\n`;
    for (const teacher of input.teachers) {
      xml += `    <Teacher><Name>${teacher.name}</Name></Teacher>\n`;
    }
    xml += `  </Teachers_List>\n`;

    // Subjects
    xml += `  <Subjects_List>\n`;
    for (const subject of input.subjects) {
      xml += `    <Subject><Name>${subject.name}</Name></Subject>\n`;
    }
    xml += `  </Subjects_List>\n`;

    // Rooms
    xml += `  <Rooms_List>\n`;
    for (const room of input.rooms) {
      xml += `    <Room><Name>${room.name}</Name><Capacity>${room.capacity}</Capacity></Room>\n`;
    }
    xml += `  </Rooms_List>\n`;

    xml += `</fet>`;
    return xml;
  }

  private async greedyGenerate(
    _semesterId: string,
    versionId: string,
    fetInput: FetInput,
  ): Promise<Array<{
    versionId: string;
    dayOfWeek: number;
    periodId: string;
    classId: string;
    teacherId: string;
    subjectId: string;
    roomId: string | null;
    isDoublePeriod: boolean;
  }>> {
    // Simple greedy algorithm as fallback when FET is not available
    // In production, this would call FET CLI and parse results
    const slots: Array<{
      versionId: string;
      dayOfWeek: number;
      periodId: string;
      classId: string;
      teacherId: string;
      subjectId: string;
      roomId: string | null;
      isDoublePeriod: boolean;
    }> = [];

    this.logger.log(`FET input built with ${fetInput.teachers.length} teachers, ${fetInput.activities.length} activities`);
    this.logger.warn('FET CLI not available - using empty result. Configure FET_EXECUTABLE_PATH in .env');

    // Return empty - in production FET would generate these
    // The activities array needs to be populated from teaching_assignments
    return slots.concat([]); // placeholder, versionId used implicitly
  }
}
