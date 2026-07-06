import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AttendanceRecordEntity } from './entities/attendance-record.entity';
import { AttendanceSummaryEntity } from './entities/attendance-summary.entity';
import { TeacherEntity } from '../teacher/entities/teacher.entity';
import { AttendanceRecordRepository } from './repositories/attendance-record.repository';
import { AttendanceSummaryRepository } from './repositories/attendance-summary.repository';
import { AttendanceService } from './services/attendance.service';
import { AttendanceSummaryService } from './services/attendance-summary.service';
import { AttendanceImportService } from './services/attendance-import.service';
import { AttendanceController } from './controllers/attendance.controller';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      AttendanceRecordEntity,
      AttendanceSummaryEntity,
      TeacherEntity,
    ]),
  ],
  controllers: [AttendanceController],
  providers: [
    AttendanceRecordRepository,
    AttendanceSummaryRepository,
    AttendanceService,
    AttendanceSummaryService,
    AttendanceImportService,
  ],
  exports: [
    AttendanceService,
    AttendanceSummaryService,
    AttendanceImportService,
  ],
})
export class AttendanceModule {}
