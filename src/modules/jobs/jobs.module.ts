import { Module, Global } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { JobRecordEntity } from './entities/job-record.entity';
import { JobsRepository } from './jobs.repository';
import { JobsService } from './jobs.service';
import { JobsController } from './jobs.controller';

/**
 * JobsModule — Quản lý trạng thái background jobs.
 *
 * Cung cấp:
 * - JobsService: tạo/cập nhật/query job records
 * - JobsController: GET /api/v1/jobs, GET /api/v1/jobs/:id
 *
 * Dùng bởi:
 * - TimetableGenerationProcessor
 * - ImportExportModule
 * - CalendarSyncModule
 * - NotificationModule
 */
@Global()
@Module({
  imports: [TypeOrmModule.forFeature([JobRecordEntity])],
  controllers: [JobsController],
  providers: [JobsRepository, JobsService],
  exports: [JobsService],
})
export class JobsModule {}
