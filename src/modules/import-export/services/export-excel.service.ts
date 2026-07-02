import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, IsNull } from 'typeorm';
import { Workbook, Worksheet } from 'exceljs';
import { TimetableSlotEntity } from '../../timetable/entities/timetable-slot.entity';
import { TimetableVersionEntity } from '../../timetable/entities/timetable-version.entity';
import { ClassEntity } from '../../class/entities/class.entity';
import { TeacherEntity } from '../../teacher/entities/teacher.entity';
import { ExportQueryDto, ExportViewType } from '../dto/export-query.dto';
import { TimetableStatus } from '../../../common/enums/status.enum';

interface SlotData {
  dayOfWeek: number;
  periodNumber: number;
  subjectName: string;
  teacherName: string;
  className: string;
  roomName: string | null;
}

const DAY_NAMES: Record<number, string> = {
  2: 'Thứ 2',
  3: 'Thứ 3',
  4: 'Thứ 4',
  5: 'Thứ 5',
  6: 'Thứ 6',
  7: 'Thứ 7',
};

@Injectable()
export class ExportExcelService {
  constructor(
    @InjectRepository(TimetableSlotEntity)
    private readonly slotRepo: Repository<TimetableSlotEntity>,
    @InjectRepository(TimetableVersionEntity)
    private readonly versionRepo: Repository<TimetableVersionEntity>,
    @InjectRepository(ClassEntity)
    private readonly classRepo: Repository<ClassEntity>,
    @InjectRepository(TeacherEntity)
    private readonly teacherRepo: Repository<TeacherEntity>,
  ) {}

  async exportTimetable(query: ExportQueryDto): Promise<Buffer> {
    const versionId = await this.resolveVersionId(query);
    const slots = await this.fetchSlots(versionId, query);

    const workbook = new Workbook();
    workbook.creator = 'STMS';
    workbook.created = new Date();

    switch (query.viewType) {
      case ExportViewType.CLASS:
        await this.buildClassView(workbook, slots, query);
        break;
      case ExportViewType.TEACHER:
        await this.buildTeacherView(workbook, slots, query);
        break;
      case ExportViewType.FULL:
      default:
        await this.buildFullView(workbook, slots);
        break;
    }

    const buffer = await workbook.xlsx.writeBuffer();
    return Buffer.from(buffer);
  }

  private async resolveVersionId(query: ExportQueryDto): Promise<string> {
    if (query.versionId) {
      return query.versionId;
    }

    // Get the latest published version
    const publishedVersion = await this.versionRepo.findOne({
      where: {
        status: TimetableStatus.PUBLISHED,
        deletedAt: IsNull(),
      },
      order: { createdAt: 'DESC' },
    });

    if (!publishedVersion) {
      throw new NotFoundException('Không tìm thấy phiên bản TKB đã công bố');
    }

    return publishedVersion.id;
  }

  private async fetchSlots(
    versionId: string,
    query: ExportQueryDto,
  ): Promise<SlotData[]> {
    const queryBuilder = this.slotRepo
      .createQueryBuilder('slot')
      .leftJoinAndSelect('slot.subject', 'subject')
      .leftJoinAndSelect('slot.teacher', 'teacher')
      .leftJoinAndSelect('slot.class', 'class')
      .leftJoinAndSelect('slot.period', 'period')
      .where('slot.versionId = :versionId', { versionId })
      .andWhere('slot.deletedAt IS NULL');

    if (query.classId) {
      queryBuilder.andWhere('slot.classId = :classId', { classId: query.classId });
    }

    if (query.teacherId) {
      queryBuilder.andWhere('slot.teacherId = :teacherId', { teacherId: query.teacherId });
    }

    queryBuilder.orderBy('slot.dayOfWeek', 'ASC').addOrderBy('period.periodNumber', 'ASC');

    const slots = await queryBuilder.getMany();

    return slots.map((slot) => ({
      dayOfWeek: slot.dayOfWeek,
      periodNumber: slot.period?.periodNumber || 0,
      subjectName: slot.subject?.name || '',
      teacherName: slot.teacher?.shortName || slot.teacher?.fullName || '',
      className: slot.class?.name || '',
      roomName: slot.room?.name || null,
    }));
  }

  private async buildClassView(
    workbook: Workbook,
    slots: SlotData[],
    query: ExportQueryDto,
  ): Promise<void> {
    if (query.classId) {
      const classEntity = await this.classRepo.findOne({
        where: { id: query.classId, deletedAt: IsNull() },
      });
      const sheetName = classEntity?.name || 'TKB';
      const worksheet = workbook.addWorksheet(sheetName);
      const classSlots = slots.filter((s) => s.className === classEntity?.name);
      this.buildTimetableGrid(worksheet, classSlots, 'class');
    } else {
      // Group by class
      const grouped = this.groupBy(slots, 'className');
      for (const [className, classSlots] of Object.entries(grouped)) {
        const worksheet = workbook.addWorksheet(className.substring(0, 31));
        this.buildTimetableGrid(worksheet, classSlots, 'class');
      }
    }
  }

  private async buildTeacherView(
    workbook: Workbook,
    slots: SlotData[],
    query: ExportQueryDto,
  ): Promise<void> {
    if (query.teacherId) {
      const teacher = await this.teacherRepo.findOne({
        where: { id: query.teacherId, deletedAt: IsNull() },
      });
      const sheetName = teacher?.shortName || teacher?.fullName || 'TKB';
      const worksheet = workbook.addWorksheet(sheetName.substring(0, 31));
      this.buildTimetableGrid(worksheet, slots, 'teacher');
    } else {
      // Group by teacher
      const grouped = this.groupBy(slots, 'teacherName');
      for (const [teacherName, teacherSlots] of Object.entries(grouped)) {
        const worksheet = workbook.addWorksheet(teacherName.substring(0, 31));
        this.buildTimetableGrid(worksheet, teacherSlots, 'teacher');
      }
    }
  }

  private async buildFullView(
    workbook: Workbook,
    slots: SlotData[],
  ): Promise<void> {
    const grouped = this.groupBy(slots, 'className');
    for (const [className, classSlots] of Object.entries(grouped)) {
      const worksheet = workbook.addWorksheet(className.substring(0, 31));
      this.buildTimetableGrid(worksheet, classSlots, 'class');
    }
  }

  private buildTimetableGrid(
    worksheet: Worksheet,
    slots: SlotData[],
    viewMode: 'class' | 'teacher',
  ): void {
    // Determine max periods
    const maxPeriod = slots.reduce((max, s) => Math.max(max, s.periodNumber), 0) || 10;

    // Header row: Tiết | Thứ 2 | Thứ 3 | ... | Thứ 7
    const headers = ['Tiết'];
    for (let day = 2; day <= 7; day++) {
      headers.push(DAY_NAMES[day]);
    }
    worksheet.addRow(headers);

    // Style header
    const headerRow = worksheet.getRow(1);
    headerRow.font = { bold: true };
    headerRow.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FF4472C4' },
    };
    headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' } };
    headerRow.alignment = { horizontal: 'center', vertical: 'middle' };

    // Data rows
    for (let period = 1; period <= maxPeriod; period++) {
      const rowData: string[] = [`Tiết ${period}`];

      for (let day = 2; day <= 7; day++) {
        const slot = slots.find(
          (s) => s.dayOfWeek === day && s.periodNumber === period,
        );

        if (slot) {
          const cellContent = viewMode === 'class'
            ? `${slot.subjectName}\n${slot.teacherName}`
            : `${slot.subjectName}\n${slot.className}`;
          rowData.push(cellContent);
        } else {
          rowData.push('');
        }
      }

      worksheet.addRow(rowData);
    }

    // Set column widths
    worksheet.columns.forEach((col, index) => {
      col.width = index === 0 ? 10 : 20;
    });

    // Style data cells
    for (let rowIdx = 2; rowIdx <= maxPeriod + 1; rowIdx++) {
      const row = worksheet.getRow(rowIdx);
      row.alignment = { vertical: 'middle', wrapText: true };
      row.height = 35;
    }
  }

  private groupBy(
    items: SlotData[],
    key: keyof SlotData,
  ): Record<string, SlotData[]> {
    return items.reduce(
      (groups, item) => {
        const groupKey = String(item[key] || 'Unknown');
        if (!groups[groupKey]) {
          groups[groupKey] = [];
        }
        groups[groupKey].push(item);
        return groups;
      },
      {} as Record<string, SlotData[]>,
    );
  }
}
