import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { FeatureFlagEntity } from './entities/feature-flag.entity';
import { FeatureFlagRepository } from './feature-flag.repository';
import { FeatureFlagService } from './feature-flag.service';

@Module({
  imports: [TypeOrmModule.forFeature([FeatureFlagEntity])],
  providers: [FeatureFlagRepository, FeatureFlagService],
  exports: [FeatureFlagService],
})
export class FeatureFlagModule {}
