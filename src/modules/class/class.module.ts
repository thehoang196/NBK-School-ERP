import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { GradeEntity } from './entities/grade.entity';
import { ClassEntity } from './entities/class.entity';
import { GradeRepository } from './repositories/grade.repository';
import { ClassRepository } from './repositories/class.repository';
import { GradeService } from './services/grade.service';
import { ClassService } from './services/class.service';
import { GradeController } from './controllers/grade.controller';
import { ClassController } from './controllers/class.controller';

@Module({
  imports: [TypeOrmModule.forFeature([GradeEntity, ClassEntity])],
  controllers: [GradeController, ClassController],
  providers: [GradeService, ClassService, GradeRepository, ClassRepository],
  exports: [GradeService, ClassService, GradeRepository, ClassRepository],
})
export class ClassModule {}
