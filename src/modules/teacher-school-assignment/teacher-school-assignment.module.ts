import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { TeacherSchoolAssignmentEntity } from './entities/teacher-school-assignment.entity';
import { TeacherSchoolAssignmentRepository } from './teacher-school-assignment.repository';
import {
  TeacherSchoolAssignmentService,
  FEATURE_FLAG_SERVICE,
  TOKEN_INVALIDATION_SERVICE,
} from './teacher-school-assignment.service';
import { SchoolModule } from '../school/school.module';
import { FeatureFlagModule } from '../feature-flag/feature-flag.module';
import { FeatureFlagService } from '../feature-flag/feature-flag.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([TeacherSchoolAssignmentEntity]),
    SchoolModule,
    FeatureFlagModule,
  ],
  controllers: [],
  providers: [
    TeacherSchoolAssignmentRepository,
    TeacherSchoolAssignmentService,
    {
      provide: FEATURE_FLAG_SERVICE,
      useExisting: FeatureFlagService,
    },
    {
      provide: TOKEN_INVALIDATION_SERVICE,
      useFactory: () => null,
    },
  ],
  exports: [TeacherSchoolAssignmentService],
})
export class TeacherSchoolAssignmentModule {}
