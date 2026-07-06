import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ValidationRuleEntity } from './entities/validation-rule.entity';
import { ValidationRulesRepository } from './validation-rules.repository';
import { ValidationRulesService } from './validation-rules.service';
import { ValidationRulesController } from './validation-rules.controller';

@Module({
  imports: [TypeOrmModule.forFeature([ValidationRuleEntity])],
  controllers: [ValidationRulesController],
  providers: [ValidationRulesService, ValidationRulesRepository],
  exports: [ValidationRulesService, ValidationRulesRepository],
})
export class ValidationRulesModule {}
