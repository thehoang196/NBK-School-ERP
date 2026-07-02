import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
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
import { ImportController } from './controllers/import.controller';
import { ExportController } from './controllers/export.controller';
import { ImportService } from './services/import.service';
import { ExportExcelService } from './services/export-excel.service';
import { ExportPdfService } from './services/export-pdf.service';
import { ImportProcessor } from './processors/import.processor';

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
    ]),
  ],
  controllers: [ImportController, ExportController],
  providers: [
    ImportService,
    ExportExcelService,
    ExportPdfService,
    ImportProcessor,
  ],
  exports: [ImportService, ExportExcelService, ExportPdfService],
})
export class ImportExportModule {}
