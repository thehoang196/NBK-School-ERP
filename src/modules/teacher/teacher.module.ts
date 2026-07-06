import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { TeacherEntity } from './entities/teacher.entity';
import { TeacherSubjectEntity } from './entities/teacher-subject.entity';
import { TeacherRepository } from './teacher.repository';
import { TeacherSubjectRepository } from './teacher-subject.repository';
import { TeacherService } from './teacher.service';
import { TeacherSubjectService } from './teacher-subject.service';
import { DataQualityService } from './services/data-quality.service';
import { OrgTeacherService } from './services/org-teacher.service';
import { TeacherEventListener } from './listeners/teacher-event.listener';
import { TeacherController } from './teacher.controller';
import { TeacherSubjectController } from './teacher-subject.controller';
import { DataQualityController } from './controllers/data-quality.controller';
import { OrgTeacherController } from './controllers/org-teacher.controller';
import { TeacherSchoolAssignmentModule } from '../teacher-school-assignment/teacher-school-assignment.module';
import { DepartmentModule } from '../department/department.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([TeacherEntity, TeacherSubjectEntity]),
    TeacherSchoolAssignmentModule,
    forwardRef(() => DepartmentModule),
  ],
  controllers: [
    TeacherController,
    TeacherSubjectController,
    DataQualityController,
    OrgTeacherController,
  ],
  providers: [
    TeacherService,
    TeacherRepository,
    TeacherSubjectService,
    TeacherSubjectRepository,
    DataQualityService,
    OrgTeacherService,
    TeacherEventListener,
  ],
  exports: [
    TeacherService,
    TeacherRepository,
    TeacherSubjectService,
    TeacherSubjectRepository,
    DataQualityService,
    OrgTeacherService,
  ],
})
export class TeacherModule {}
