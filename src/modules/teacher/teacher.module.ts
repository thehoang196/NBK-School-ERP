import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { TeacherEntity } from './entities/teacher.entity';
import { TeacherSubjectEntity } from './entities/teacher-subject.entity';
import { TeacherRepository } from './teacher.repository';
import { TeacherSubjectRepository } from './teacher-subject.repository';
import { TeacherService } from './teacher.service';
import { TeacherSubjectService } from './teacher-subject.service';
import { TeacherController } from './teacher.controller';
import { TeacherSubjectController } from './teacher-subject.controller';

@Module({
  imports: [TypeOrmModule.forFeature([TeacherEntity, TeacherSubjectEntity])],
  controllers: [TeacherController, TeacherSubjectController],
  providers: [
    TeacherService,
    TeacherRepository,
    TeacherSubjectService,
    TeacherSubjectRepository,
  ],
  exports: [TeacherService, TeacherRepository, TeacherSubjectService, TeacherSubjectRepository],
})
export class TeacherModule {}
