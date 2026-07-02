import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { TeachingAssignmentEntity } from './entities/teaching-assignment.entity';
import { TeachingAssignmentController } from './teaching-assignment.controller';
import { TeachingAssignmentService } from './teaching-assignment.service';
import { TeachingAssignmentRepository } from './teaching-assignment.repository';
import { TeacherEntity } from '../teacher/entities/teacher.entity';
import { TeacherModule } from '../teacher/teacher.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([TeachingAssignmentEntity, TeacherEntity]),
    TeacherModule,
  ],
  controllers: [TeachingAssignmentController],
  providers: [TeachingAssignmentService, TeachingAssignmentRepository],
  exports: [TeachingAssignmentService, TeachingAssignmentRepository],
})
export class TeachingAssignmentModule {}
