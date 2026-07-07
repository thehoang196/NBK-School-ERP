import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ThrottlerModule } from '@nestjs/throttler';
import { APP_GUARD } from '@nestjs/core';
import { BullModule } from '@nestjs/bullmq';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { getDatabaseConfig } from './config/database.config';
import { getRedisConfig } from './config/redis.config';
import { AppThrottlerGuard } from './common/guards/throttler.guard';
import { AuthModule } from './modules/auth/auth.module';
import { SchoolModule } from './modules/school/school.module';
import { AcademicModule } from './modules/academic/academic.module';
import { ClassModule } from './modules/class/class.module';
import { DepartmentModule } from './modules/department/department.module';
import { TeacherModule } from './modules/teacher/teacher.module';
import { SubjectModule } from './modules/subject/subject.module';
import { RoomModule } from './modules/room/room.module';
import { TimetableModule } from './modules/timetable/timetable.module';
import { TeachingAssignmentModule } from './modules/teaching-assignment/teaching-assignment.module';
import { EventModule } from './modules/event/event.module';
import { ImportExportModule } from './modules/import-export/import-export.module';
import { AttendanceModule } from './modules/attendance/attendance.module';
import { LeaveRequestModule } from './modules/leave-request/leave-request.module';
import { PeriodSwapModule } from './modules/period-swap/period-swap.module';
import { CompensationModule } from './modules/compensation/compensation.module';
import { MasterDataModule } from './modules/master-data/master-data.module';
import { ValidationRulesModule } from './modules/validation-rules/validation-rules.module';
import { FeatureFlagModule } from './modules/feature-flag/feature-flag.module';
import { TeacherSchoolAssignmentModule } from './modules/teacher-school-assignment/teacher-school-assignment.module';
import { HealthModule } from './modules/health/health.module';
import { AuditModule } from './modules/audit/audit.module';
import { CacheModule } from './modules/cache/cache.module';
import { ContextModule } from './modules/context';
import { JobsModule } from './modules/jobs/jobs.module';
import { CurriculumModule } from './modules/curriculum/curriculum.module';
import { LoggerModule } from './common/logger';
import { TenantModule } from './common/tenant';
import { SeederModule } from './database/seeder';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
    }),
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: getDatabaseConfig,
      inject: [ConfigService],
    }),
    // Rate Limiting — default 100 requests/60s per IP
    ThrottlerModule.forRoot([
      {
        name: 'default',
        ttl: 60000,
        limit: 100,
      },
      {
        name: 'strict',
        ttl: 60000,
        limit: 20,
      },
    ]),
    // BullMQ Queue Processing — conditional on REDIS_HOST availability
    BullModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: (configService: ConfigService) => ({
        connection: getRedisConfig(configService),
      }),
      inject: [ConfigService],
    }),
    EventEmitterModule.forRoot(),
    TenantModule,
    AuditModule,
    CacheModule,
    ContextModule,
    JobsModule,
    LoggerModule,
    HealthModule,
    AuthModule,
    SchoolModule,
    AcademicModule,
    ClassModule,
    DepartmentModule,
    TeacherModule,
    SubjectModule,
    RoomModule,
    TimetableModule,
    TeachingAssignmentModule,
    EventModule,
    ImportExportModule,
    AttendanceModule,
    LeaveRequestModule,
    PeriodSwapModule,
    CompensationModule,
    CurriculumModule,
    MasterDataModule,
    ValidationRulesModule,
    FeatureFlagModule,
    TeacherSchoolAssignmentModule,
    SeederModule,
  ],
  providers: [
    {
      provide: APP_GUARD,
      useClass: AppThrottlerGuard,
    },
  ],
})
export class AppModule {}
