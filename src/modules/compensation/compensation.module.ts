import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

// Entities
import { PayComponentEntity } from './entities/pay-component.entity';
import { VariableEntity } from './entities/variable.entity';
import { VariableOverrideEntity } from './entities/variable-override.entity';
import { FormulaEntity } from './entities/formula.entity';
import { RuleEntity } from './entities/rule.entity';
import { AuditLogEntity } from './entities/audit-log.entity';
import { PayPeriodEntity } from './entities/pay-period.entity';
import { CompensationPolicyEntity } from './entities/compensation-policy.entity';
import { SalarySlipEntity } from './entities/salary-slip.entity';

// Repositories
import { PayComponentRepository } from './repositories/pay-component.repository';
import { VariableRepository } from './repositories/variable.repository';
import { FormulaRepository } from './repositories/formula.repository';
import { RuleRepository } from './repositories/rule.repository';
import { AuditLogRepository } from './repositories/audit-log.repository';
import { PayPeriodRepository } from './repositories/pay-period.repository';
import { PolicyRepository } from './repositories/policy.repository';
import { SalarySlipRepository } from './repositories/salary-slip.repository';

// Services
import { PayComponentService } from './services/pay-component.service';
import { VariableService } from './services/variable.service';
import { FormulaService } from './services/formula.service';
import { RuleService } from './services/rule.service';
import { RuleEvaluator } from './services/rule-evaluator';
import { PayPeriodService } from './services/pay-period.service';
import { PolicyService } from './services/policy.service';
import { DependencyGraphService } from './services/dependency-graph.service';
import { CalculationService } from './services/calculation.service';
import { SalarySlipService } from './services/salary-slip.service';
import { SimulationService } from './services/simulation.service';
import { AuditService } from './services/audit.service';
import { FunctionLibraryService } from './services/function-library.service';

// Controllers
import { PayComponentController } from './controllers/pay-component.controller';
import { VariableController } from './controllers/variable.controller';
import { FormulaController } from './controllers/formula.controller';
import { RuleController } from './controllers/rule.controller';
import { PayPeriodController } from './controllers/pay-period.controller';
import { PolicyController } from './controllers/policy.controller';
import { CalculationController } from './controllers/calculation.controller';
import { SalarySlipController } from './controllers/salary-slip.controller';
import { SimulationController } from './controllers/simulation.controller';
import { AuditController } from './controllers/audit.controller';
import { FunctionLibraryController } from './controllers/function-library.controller';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      PayComponentEntity,
      VariableEntity,
      VariableOverrideEntity,
      FormulaEntity,
      RuleEntity,
      AuditLogEntity,
      PayPeriodEntity,
      CompensationPolicyEntity,
      SalarySlipEntity,
    ]),
  ],
  controllers: [
    PayComponentController,
    VariableController,
    FormulaController,
    RuleController,
    PayPeriodController,
    PolicyController,
    CalculationController,
    SalarySlipController,
    SimulationController,
    AuditController,
    FunctionLibraryController,
  ],
  providers: [
    // Repositories
    PayComponentRepository,
    VariableRepository,
    FormulaRepository,
    RuleRepository,
    AuditLogRepository,
    PayPeriodRepository,
    PolicyRepository,
    SalarySlipRepository,
    // Services
    PayComponentService,
    VariableService,
    FormulaService,
    RuleService,
    RuleEvaluator,
    PayPeriodService,
    PolicyService,
    DependencyGraphService,
    CalculationService,
    SalarySlipService,
    SimulationService,
    AuditService,
    FunctionLibraryService,
  ],
  exports: [
    PayComponentService,
    VariableService,
    FormulaService,
    RuleService,
    RuleEvaluator,
    PayPeriodService,
    PolicyService,
    CalculationService,
    SalarySlipService,
    SimulationService,
    AuditService,
    FunctionLibraryService,
  ],
})
export class CompensationModule {}
