import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AcademicYearEntity } from './entities/academic-year.entity';
import { SemesterEntity } from './entities/semester.entity';
import { WeekEntity } from './entities/week.entity';
import { SessionEntity } from './entities/session.entity';
import { PeriodDefinitionEntity } from './entities/period-definition.entity';
import { CampusGradeLevelEntity } from './entities/campus-grade-level.entity';
import { AcademicYearRepository } from './repositories/academic-year.repository';
import { SemesterRepository } from './repositories/semester.repository';
import { WeekRepository } from './repositories/week.repository';
import { SessionRepository } from './repositories/session.repository';
import { PeriodDefinitionRepository } from './repositories/period-definition.repository';
import { CampusGradeLevelRepository } from './repositories/campus-grade-level.repository';
import { AcademicYearService } from './services/academic-year.service';
import { SemesterService } from './services/semester.service';
import { WeekService } from './services/week.service';
import { SessionService } from './services/session.service';
import { PeriodDefinitionService } from './services/period-definition.service';
import { CampusGradeLevelService } from './services/campus-grade-level.service';
import { AcademicYearController } from './controllers/academic-year.controller';
import { SemesterController } from './controllers/semester.controller';
import { WeekController } from './controllers/week.controller';
import { SessionController } from './controllers/session.controller';
import { PeriodDefinitionController } from './controllers/period-definition.controller';
import { CampusGradeLevelController } from './controllers/campus-grade-level.controller';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      AcademicYearEntity,
      SemesterEntity,
      WeekEntity,
      SessionEntity,
      PeriodDefinitionEntity,
      CampusGradeLevelEntity,
    ]),
  ],
  controllers: [
    AcademicYearController,
    SemesterController,
    WeekController,
    SessionController,
    PeriodDefinitionController,
    CampusGradeLevelController,
  ],
  providers: [
    AcademicYearRepository,
    SemesterRepository,
    WeekRepository,
    SessionRepository,
    PeriodDefinitionRepository,
    CampusGradeLevelRepository,
    AcademicYearService,
    SemesterService,
    WeekService,
    SessionService,
    PeriodDefinitionService,
    CampusGradeLevelService,
  ],
  exports: [
    TypeOrmModule,
    AcademicYearRepository,
    SemesterRepository,
    WeekRepository,
    SessionRepository,
    PeriodDefinitionRepository,
    CampusGradeLevelRepository,
    AcademicYearService,
    SemesterService,
    WeekService,
    SessionService,
    PeriodDefinitionService,
    CampusGradeLevelService,
  ],
})
export class AcademicModule {}
