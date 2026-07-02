import { Module } from '@nestjs/common';
// import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
// import { BullModule } from '@nestjs/bullmq'; // TODO: Enable when Redis is available
import { TimetableVersionEntity } from './entities/timetable-version.entity';
import { TimetableSlotEntity } from './entities/timetable-slot.entity';
import { ActualTimetableSlotEntity } from './entities/actual-timetable-slot.entity';
import { TeacherEntity } from '../teacher/entities/teacher.entity';
import { SubjectEntity } from '../subject/entities/subject.entity';
import { ClassEntity } from '../class/entities/class.entity';
import { PeriodDefinitionEntity } from '../academic/entities/period-definition.entity';
import { RoomEntity } from '../room/entities/room.entity';
import { TimetableVersionController } from './controllers/timetable-version.controller';
import { TimetableSlotController } from './controllers/timetable-slot.controller';
import { TimetableGenerationController } from './controllers/timetable-generation.controller';
import { DragDropController } from './controllers/drag-drop.controller';
import { TimetableExportController } from './controllers/timetable-export.controller';
import { TimetableImportController } from './controllers/timetable-import.controller';
import { TimetableService } from './services/timetable.service';
import { TimetableVersionService } from './services/timetable-version.service';
import { TimetableSlotService } from './services/timetable-slot.service';
import { ConflictDetectionService } from './services/conflict-detection.service';
import { TimetableComparisonService } from './services/timetable-comparison.service';
import { TimetablePublishService } from './services/timetable-publish.service';
import { TimetableGeneratorService } from './services/timetable-generator.service';
import { DragDropService } from './services/drag-drop.service';
import { TimetableExportService } from './services/timetable-export.service';
import { TimetableImportService } from './services/timetable-import.service';
import { TimetableVersionRepository } from './repositories/timetable-version.repository';
import { TimetableSlotRepository } from './repositories/timetable-slot.repository';
// import { TimetableGenerationProcessor } from './processors'; // TODO: Enable when Redis is available

@Module({
  imports: [
    TypeOrmModule.forFeature([
      TimetableVersionEntity,
      TimetableSlotEntity,
      ActualTimetableSlotEntity,
      TeacherEntity,
      SubjectEntity,
      ClassEntity,
      PeriodDefinitionEntity,
      RoomEntity,
    ]),
    // TODO: Enable BullModule when Redis is available
    // BullModule.forRootAsync({
    //   imports: [ConfigModule],
    //   useFactory: (configService: ConfigService) => ({
    //     connection: {
    //       host: configService.get<string>('REDIS_HOST', 'localhost'),
    //       port: configService.get<number>('REDIS_PORT', 6379),
    //       password: configService.get<string>('REDIS_PASSWORD') || undefined,
    //     },
    //   }),
    //   inject: [ConfigService],
    // }),
    // BullModule.registerQueue({
    //   name: 'timetable-generation',
    // }),
  ],
  controllers: [
    TimetableVersionController,
    TimetableSlotController,
    TimetableGenerationController,
    DragDropController,
    TimetableExportController,
    TimetableImportController,
  ],
  providers: [
    TimetableService,
    TimetableVersionService,
    TimetableSlotService,
    ConflictDetectionService,
    TimetableComparisonService,
    TimetablePublishService,
    TimetableGeneratorService,
    DragDropService,
    TimetableExportService,
    TimetableImportService,
    TimetableVersionRepository,
    TimetableSlotRepository,
    // TimetableGenerationProcessor, // TODO: Enable when Redis is available
  ],
  exports: [
    TimetableService,
    TimetableVersionService,
    TimetableSlotService,
    TimetablePublishService,
    ConflictDetectionService,
    DragDropService,
  ],
})
export class TimetableModule {}
