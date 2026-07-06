import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { TeachingAssignmentEntity } from './entities/teaching-assignment.entity';
import { TeachingAssignmentController } from './teaching-assignment.controller';
import { TeachingAssignmentService } from './teaching-assignment.service';
import { TeachingAssignmentRepository } from './teaching-assignment.repository';
import { TeacherEntity } from '../teacher/entities/teacher.entity';
import { ClassEntity } from '../class/entities/class.entity';
import { RoomEntity } from '../room/entities/room.entity';
import { TeacherModule } from '../teacher/teacher.module';
import { TeacherSchoolAssignmentModule } from '../teacher-school-assignment/teacher-school-assignment.module';
import { WorkloadValidator } from './validators/workload.validator';
import { CompetencyValidator } from './validators/competency.validator';
import { RoomAvailabilityValidator } from './validators/room-availability.validator';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      TeachingAssignmentEntity,
      TeacherEntity,
      ClassEntity,
      RoomEntity,
    ]),
    TeacherModule,
    TeacherSchoolAssignmentModule,
  ],
  controllers: [TeachingAssignmentController],
  providers: [
    TeachingAssignmentService,
    TeachingAssignmentRepository,
    WorkloadValidator,
    CompetencyValidator,
    RoomAvailabilityValidator,
  ],
  exports: [
    TeachingAssignmentService,
    TeachingAssignmentRepository,
    WorkloadValidator,
    CompetencyValidator,
    RoomAvailabilityValidator,
  ],
})
export class TeachingAssignmentModule {}
