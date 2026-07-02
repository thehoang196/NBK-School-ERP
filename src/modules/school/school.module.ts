import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SchoolEntity } from './entities/school.entity';
import { CampusEntity } from './entities/campus.entity';
import { SchoolController } from './school.controller';
import { CampusController } from './campus.controller';
import { SchoolService } from './school.service';
import { SchoolRepository } from './school.repository';
import { CampusRepository } from './campus.repository';
import { CampusService } from './campus.service';

@Module({
  imports: [TypeOrmModule.forFeature([SchoolEntity, CampusEntity])],
  controllers: [SchoolController, CampusController],
  providers: [SchoolService, SchoolRepository, CampusRepository, CampusService],
  exports: [SchoolService, SchoolRepository, CampusRepository, CampusService],
})
export class SchoolModule {}
