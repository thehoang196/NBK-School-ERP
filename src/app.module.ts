import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { getDatabaseConfig } from './config/database.config';
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
import { CompensationModule } from './modules/compensation/compensation.module';

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
    EventEmitterModule.forRoot(),
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
    CompensationModule,
  ],
})
export class AppModule {}
