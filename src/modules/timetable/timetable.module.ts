import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
// import { BullModule } from '@nestjs/bullmq'; // TODO: Enable when Redis is available
import { TimetableVersionEntity } from './entities/timetable-version.entity';
import { TimetableSlotEntity } from './entities/timetable-slot.entity';
import { ActualTimetableSlotEntity } from './entities/actual-timetable-slot.entity';
import { TimetableConstraintEntity } from './entities/timetable-constraint.entity';
import { TeacherEntity } from '../teacher/entities/teacher.entity';
import { SubjectEntity } from '../subject/entities/subject.entity';
import { ClassEntity } from '../class/entities/class.entity';
import { PeriodDefinitionEntity } from '../academic/entities/period-definition.entity';
import { RoomEntity } from '../room/entities/room.entity';
import { SchoolEntity } from '../school/entities/school.entity';
import { TeachingAssignmentEntity } from '../teaching-assignment/entities/teaching-assignment.entity';
import { TimetableVersionController } from './controllers/timetable-version.controller';
import { TimetableSlotController } from './controllers/timetable-slot.controller';
import { TimetableGenerationController } from './controllers/timetable-generation.controller';
import { DragDropController } from './controllers/drag-drop.controller';
import { TimetableExportController } from './controllers/timetable-export.controller';
import { TimetableImportController } from './controllers/timetable-import.controller';
import { ConflictController } from './controllers/conflict.controller';
import { CrossSchoolTimetableController } from './controllers/cross-school-timetable.controller';
import { TimetableService } from './services/timetable.service';
import { TimetableVersionService } from './services/timetable-version.service';
import { TimetableSlotService } from './services/timetable-slot.service';
import { ConflictDetectionService } from './services/conflict-detection.service';
import {
  TeacherDoubleBookedChecker,
  RoomDoubleBookedChecker,
  ClassDoubleBookedChecker,
  TeacherMaxConsecutiveChecker,
  TeacherTravelTimeChecker,
  SubjectConsecutiveDaysChecker,
  TeacherMaxPerDayChecker,
} from './services/checkers';
import { TimetableComparisonService } from './services/timetable-comparison.service';
import { TimetablePublishService } from './services/timetable-publish.service';
import { TimetableGeneratorService } from './services/timetable-generator.service';
import { DragDropService } from './services/drag-drop.service';
import { TimetableExportService } from './services/timetable-export.service';
import { TimetableImportService } from './services/timetable-import.service';
import { TimetableVersionStateMachineService } from './services/timetable-version-state-machine.service';
import { FetInputExporterService } from './services/fet-input-exporter.service';
import { FetInputDeserializerService } from './services/fet-input-deserializer.service';
import { FetEngineAdapterService } from './services/fet-engine-adapter.service';
import { FetOutputParserService } from './services/fet-output-parser.service';
import { ResultMapperService } from './services/result-mapper.service';
import { FetInputDataCollectorService } from './services/fet-input-data-collector.service';
import { GenerationPipelineService } from './services/generation-pipeline.service';
import { GenerationProgressGatewayService } from './services/generation-progress-gateway.service';
import { fetConfig } from '../../config/fet.config';
import { TimetableVersionRepository } from './repositories/timetable-version.repository';
import { TimetableSlotRepository } from './repositories/timetable-slot.repository';
import { ConflictSlotRepository } from './repositories/conflict-slot.repository';
import { ConflictLogRepository } from './repositories/conflict-log.repository';
import { ConflictLogEntity } from './entities/conflict-log.entity';
import { ConflictOrchestrationService } from './services/conflict-orchestration.service';
import { CrossSchoolTimetableService } from './services/cross-school-timetable.service';
import { TeacherSchoolAssignmentModule } from '../teacher-school-assignment/teacher-school-assignment.module';
// import { TimetableGenerationProcessor } from './processors'; // TODO: Enable when Redis is available

@Module({
  imports: [
    ConfigModule.forFeature(fetConfig),
    TypeOrmModule.forFeature([
      TimetableVersionEntity,
      TimetableSlotEntity,
      ActualTimetableSlotEntity,
      TimetableConstraintEntity,
      TeacherEntity,
      SubjectEntity,
      ClassEntity,
      PeriodDefinitionEntity,
      RoomEntity,
      SchoolEntity,
      TeachingAssignmentEntity,
      ConflictLogEntity,
    ]),
    TeacherSchoolAssignmentModule,
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
    ConflictController,
    CrossSchoolTimetableController,
  ],
  providers: [
    TimetableService,
    TimetableVersionService,
    TimetableSlotService,
    ConflictDetectionService,
    TeacherDoubleBookedChecker,
    RoomDoubleBookedChecker,
    ClassDoubleBookedChecker,
    TeacherMaxConsecutiveChecker,
    TeacherTravelTimeChecker,
    SubjectConsecutiveDaysChecker,
    TeacherMaxPerDayChecker,
    TimetableComparisonService,
    TimetablePublishService,
    TimetableGeneratorService,
    DragDropService,
    TimetableExportService,
    TimetableImportService,
    TimetableVersionStateMachineService,
    FetInputExporterService,
    FetInputDeserializerService,
    FetEngineAdapterService,
    FetOutputParserService,
    ResultMapperService,
    FetInputDataCollectorService,
    GenerationPipelineService,
    GenerationProgressGatewayService,
    TimetableVersionRepository,
    TimetableSlotRepository,
    ConflictSlotRepository,
    ConflictLogRepository,
    ConflictOrchestrationService,
    CrossSchoolTimetableService,
    // TimetableGenerationProcessor, // TODO: Enable when Redis is available
  ],
  exports: [
    TimetableService,
    TimetableVersionService,
    TimetableSlotService,
    TimetablePublishService,
    ConflictDetectionService,
    ConflictOrchestrationService,
    DragDropService,
    TimetableVersionStateMachineService,
    FetInputExporterService,
    FetInputDeserializerService,
    FetEngineAdapterService,
    FetOutputParserService,
    ResultMapperService,
    FetInputDataCollectorService,
    GenerationPipelineService,
    GenerationProgressGatewayService,
    CrossSchoolTimetableService,
  ],
})
export class TimetableModule {}
