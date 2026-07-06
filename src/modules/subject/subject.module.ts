import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SubjectEntity } from './entities/subject.entity';
import { SubjectGradeEntity } from './entities/subject-grade.entity';
import { SubjectGroupEntity } from './entities/subject-group.entity';
import { SubjectRepository } from './subject.repository';
import { SubjectService } from './subject.service';
import { SubjectController } from './subject.controller';
import { ClassModule } from '../class/class.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([SubjectEntity, SubjectGradeEntity, SubjectGroupEntity]),
    ClassModule,
  ],
  controllers: [SubjectController],
  providers: [SubjectService, SubjectRepository],
  exports: [SubjectService, SubjectRepository],
})
export class SubjectModule {}
