import { Module } from '@nestjs/common';
import { HealthController } from './health.controller';
import { TenantHealthController } from './tenant-health.controller';

@Module({
  controllers: [HealthController, TenantHealthController],
})
export class HealthModule {}
