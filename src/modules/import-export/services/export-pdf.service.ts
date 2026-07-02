import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, IsNull } from 'typeorm';
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
export class ExportPdfService {
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

    let title = 'THỜI KHÓA BIỂU';
    let subtitle = '';

    if (query.viewType === ExportViewType.CLASS && query.classId) {
      const classEntity = await this.classRepo.findOne({
        where: { id: query.classId, deletedAt: IsNull() },
      });
      subtitle = classEntity ? `Lớp: ${classEntity.name}` : '';
    } else if (query.viewType === ExportViewType.TEACHER && query.teacherId) {
      const teacher = await this.teacherRepo.findOne({
        where: { id: query.teacherId, deletedAt: IsNull() },
      });
      subtitle = teacher ? `Giáo viên: ${teacher.fullName}` : '';
    } else {
      title = 'THỜI KHÓA BIỂU TOÀN TRƯỜNG';
    }

    const html = this.generateHtml(slots, title, subtitle, query.viewType);
    const pdfBuffer = await this.htmlToPdf(html);
    return pdfBuffer;
  }

  private async resolveVersionId(query: ExportQueryDto): Promise<string> {
    if (query.versionId) {
      return query.versionId;
    }

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

  private generateHtml(
    slots: SlotData[],
    title: string,
    subtitle: string,
    viewType: ExportViewType,
  ): string {
    const maxPeriod = slots.reduce((max, s) => Math.max(max, s.periodNumber), 0) || 10;
    const viewMode = viewType === ExportViewType.TEACHER ? 'teacher' : 'class';

    // Group slots by class or teacher for full view
    let tables = '';

    if (viewType === ExportViewType.FULL) {
      const grouped = this.groupBy(slots, 'className');
      for (const [groupName, groupSlots] of Object.entries(grouped)) {
        tables += `<h3>Lớp: ${groupName}</h3>`;
        tables += this.buildHtmlTable(groupSlots, maxPeriod, viewMode);
      }
    } else {
      tables = this.buildHtmlTable(slots, maxPeriod, viewMode);
    }

    return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    body {
      font-family: 'Times New Roman', serif;
      font-size: 12px;
      margin: 20px;
    }
    h1 {
      text-align: center;
      font-size: 18px;
      margin-bottom: 5px;
    }
    h2 {
      text-align: center;
      font-size: 14px;
      font-weight: normal;
      margin-top: 0;
    }
    h3 {
      font-size: 13px;
      margin-top: 20px;
      page-break-before: auto;
    }
    table {
      width: 100%;
      border-collapse: collapse;
      margin-top: 10px;
    }
    th, td {
      border: 1px solid #333;
      padding: 4px 6px;
      text-align: center;
      vertical-align: middle;
    }
    th {
      background-color: #4472C4;
      color: white;
      font-weight: bold;
    }
    tr:nth-child(even) {
      background-color: #f2f2f2;
    }
    .slot-content {
      font-size: 11px;
      line-height: 1.3;
    }
    .subject-name {
      font-weight: bold;
    }
    .teacher-name, .class-name {
      font-size: 10px;
      color: #555;
    }
    @media print {
      body { margin: 10mm; }
      h3 { page-break-before: always; }
      h3:first-of-type { page-break-before: auto; }
    }
  </style>
</head>
<body>
  <h1>${title}</h1>
  ${subtitle ? `<h2>${subtitle}</h2>` : ''}
  ${tables}
</body>
</html>`;
  }

  private buildHtmlTable(
    slots: SlotData[],
    maxPeriod: number,
    viewMode: 'class' | 'teacher',
  ): string {
    let html = '<table><thead><tr><th>Tiết</th>';
    for (let day = 2; day <= 7; day++) {
      html += `<th>${DAY_NAMES[day]}</th>`;
    }
    html += '</tr></thead><tbody>';

    for (let period = 1; period <= maxPeriod; period++) {
      html += `<tr><td><strong>Tiết ${period}</strong></td>`;
      for (let day = 2; day <= 7; day++) {
        const slot = slots.find(
          (s) => s.dayOfWeek === day && s.periodNumber === period,
        );
        if (slot) {
          const secondLine = viewMode === 'class'
            ? `<div class="teacher-name">${slot.teacherName}</div>`
            : `<div class="class-name">${slot.className}</div>`;
          html += `<td class="slot-content"><div class="subject-name">${slot.subjectName}</div>${secondLine}</td>`;
        } else {
          html += '<td></td>';
        }
      }
      html += '</tr>';
    }

    html += '</tbody></table>';
    return html;
  }

  private async htmlToPdf(html: string): Promise<Buffer> {
    // Try to use Puppeteer if available in production
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    try {
      const puppeteer = require('puppeteer');
      const browser = await puppeteer.launch({
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox'],
      });
      const page = await browser.newPage();
      await page.setContent(html, { waitUntil: 'networkidle0' });
      const pdfBuffer = await page.pdf({
        format: 'A4',
        landscape: true,
        margin: { top: '10mm', bottom: '10mm', left: '10mm', right: '10mm' },
        printBackground: true,
      });
      await browser.close();
      return Buffer.from(pdfBuffer);
    } catch {
      // Fallback: return HTML content as buffer for environments without Puppeteer
      // Client can render the HTML directly or install Puppeteer for PDF generation
      return Buffer.from(html, 'utf-8');
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
