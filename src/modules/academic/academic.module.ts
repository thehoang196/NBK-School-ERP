import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AcademicYearEntity } from './entities/academic-year.entity';
import { SemesterEntity } from './entities/semester.entity';
import { WeekEntity } from './entities/week.entity';
import { SessionEntity } from './entities/session.entity';
import { PeriodDefinitionEntity } from './entities/period-definition.entity';
import { AcademicYearRepository } from './repositories/academic-year.repository';
import { SemesterRepository } from './repositories/semester.repository';
import { WeekRepository } from './repositories/week.repository';
import { SessionRepository } from './repositories/session.repository';
import { PeriodDefinitionRepository } from './repositories/period-definition.repository';
import { AcademicYearService } from './services/academic-year.service';
import { SemesterService } from './services/semester.service';
import { WeekService } from './services/week.service';
import { SessionService } from './services/session.service';
import { PeriodDefinitionService } from './services/period-definition.service';
import { AcademicYearController } from './controllers/academic-year.controller';
import { SemesterController } from './controllers/semester.controller';
import { WeekController } from './controllers/week.controller';
import { SessionController } from './controllers/session.controller';
import { PeriodDefinitionController } from './controllers/period-definition.controller';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      AcademicYearEntity,
      SemesterEntity,
      WeekEntity,
      SessionEntity,
      PeriodDefinitionEntity,
    ]),
  ],
  controllers: [
    AcademicYearController,
    SemesterController,
    WeekController,
    SessionController,
    PeriodDefinitionController,
  ],
  providers: [
    AcademicYearRepository,
    SemesterRepository,
    WeekRepository,
    SessionRepository,
    PeriodDefinitionRepository,
    AcademicYearService,
    SemesterService,
    WeekService,
    SessionService,
    PeriodDefinitionService,
  ],
  exports: [
    TypeOrmModule,
    AcademicYearRepository,
    SemesterRepository,
    WeekRepository,
    SessionRepository,
    PeriodDefinitionRepository,
    AcademicYearService,
    SemesterService,
    WeekService,
    SessionService,
    PeriodDefinitionService,
  ],
})
export class AcademicModule {}
