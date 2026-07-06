import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { EmployeeMasterEntity } from './entities/employee-master.entity';
import { FieldDefinitionEntity } from './entities/field-definition.entity';
import { EmployeeAuditLogEntity } from './entities/employee-audit-log.entity';
import { SyncLogEntity } from './entities/sync-log.entity';
import { ReconciliationSessionEntity } from './entities/reconciliation-session.entity';
import { MasterDataController } from './controllers/master-data.controller';
import { ReconciliationController } from './controllers/reconciliation.controller';
import { FieldDefinitionController } from './controllers/field-definition.controller';
import { MasterDataRepository } from './repositories/master-data.repository';
import { FieldDefinitionRepository } from './repositories/field-definition.repository';
import { AuditLogRepository } from './repositories/audit-log.repository';
import { SyncLogRepository } from './repositories/sync-log.repository';
import { MasterDataService } from './services/master-data.service';
import { FieldDefinitionService } from './services/field-definition.service';
import { ImportService } from './services/import.service';
import { ReconciliationService } from './services/reconciliation.service';
import { SyncService } from './services/sync.service';
import { MasterDataScopeGuard } from './guards/master-data-scope.guard';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      EmployeeMasterEntity,
      FieldDefinitionEntity,
      EmployeeAuditLogEntity,
      SyncLogEntity,
      ReconciliationSessionEntity,
    ]),
  ],
  controllers: [
    MasterDataController,
    ReconciliationController,
    FieldDefinitionController,
  ],
  providers: [
    MasterDataRepository,
    FieldDefinitionRepository,
    AuditLogRepository,
    SyncLogRepository,
    MasterDataService,
    FieldDefinitionService,
    ImportService,
    ReconciliationService,
    SyncService,
    MasterDataScopeGuard,
  ],
  exports: [
    MasterDataRepository,
    FieldDefinitionRepository,
    AuditLogRepository,
    SyncLogRepository,
    MasterDataService,
    FieldDefinitionService,
    ImportService,
    ReconciliationService,
    SyncService,
    MasterDataScopeGuard,
  ],
})
export class MasterDataModule {}
