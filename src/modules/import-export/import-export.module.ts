import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BullModule } from '@nestjs/bullmq';
import { TeacherEntity } from '../teacher/entities/teacher.entity';
import { SubjectEntity } from '../subject/entities/subject.entity';
import { ClassEntity } from '../class/entities/class.entity';
import { GradeEntity } from '../class/entities/grade.entity';
import { DepartmentEntity } from '../department/entities/department.entity';
import { SchoolEntity } from '../school/entities/school.entity';
import { TimetableSlotEntity } from '../timetable/entities/timetable-slot.entity';
import { TimetableVersionEntity } from '../timetable/entities/timetable-version.entity';
import { PeriodDefinitionEntity } from '../academic/entities/period-definition.entity';
import { AcademicYearEntity } from '../academic/entities/academic-year.entity';
import { ImportBatchEntity } from './entities/import-batch.entity';
import { ExportTemplateEntity } from './entities/export-template.entity';
import { ImportController } from './controllers/import.controller';
import { ExportController } from './controllers/export.controller';
import { ImportService } from './services/import.service';
import { ExportExcelService } from './services/export-excel.service';
import { ExportPdfService } from './services/export-pdf.service';
import { EntityExportService } from './services/entity-export.service';
import { ImportProcessor } from './processors/import.processor';
import { TeacherImportProcessor } from './processors/teacher-import.processor';
import { TimetableImportProcessor } from './processors/timetable-import.processor';
import { TeacherSchoolAssignmentEntity } from '../teacher-school-assignment/entities/teacher-school-assignment.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      TeacherEntity,
      SubjectEntity,
      ClassEntity,
      GradeEntity,
      DepartmentEntity,
      SchoolEntity,
      TimetableSlotEntity,
      TimetableVersionEntity,
      PeriodDefinitionEntity,
      AcademicYearEntity,
      ImportBatchEntity,
      ExportTemplateEntity,
      TeacherSchoolAssignmentEntity,
    ]),
    // TODO: Re-enable when Redis is available
    // BullModule.registerQueue({
    //   name: 'teacher-import',
    // }),
  ],
  controllers: [ImportController, ExportController],
  providers: [
    ImportService,
    ExportExcelService,
    ExportPdfService,
    EntityExportService,
    ImportProcessor,
    TimetableImportProcessor,
    // TeacherImportProcessor disabled - requires Redis
    // TeacherImportProcessor,
    // Mock queue provider when Redis is not available
    {
      provide: 'BullQueue_teacher-import',
      useValue: { add: async () => ({ id: 'mock' }), getJob: async () => null },
    },
  ],
  exports: [
    ImportService,
    ExportExcelService,
    ExportPdfService,
    EntityExportService,
    TimetableImportProcessor,
  ],
})
export class ImportExportModule {}
