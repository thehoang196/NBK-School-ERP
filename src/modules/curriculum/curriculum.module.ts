import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CurriculumPlanEntity } from './entities/curriculum-plan.entity';
import { CurriculumPlanItemEntity } from './entities/curriculum-plan-item.entity';
import { CurriculumPlanRepository } from './curriculum-plan.repository';
import { CurriculumPlanService } from './curriculum-plan.service';
import { CurriculumPlanController } from './curriculum-plan.controller';

@Module({
  imports: [
    TypeOrmModule.forFeature([CurriculumPlanEntity, CurriculumPlanItemEntity]),
  ],
  controllers: [CurriculumPlanController],
  providers: [CurriculumPlanRepository, CurriculumPlanService],
  exports: [CurriculumPlanService],
})
export class CurriculumModule {}
