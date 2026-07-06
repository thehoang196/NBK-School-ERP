import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { FeatureFlagEntity } from './entities/feature-flag.entity';

@Injectable()
export class FeatureFlagRepository {
  constructor(
    @InjectRepository(FeatureFlagEntity)
    private readonly repo: Repository<FeatureFlagEntity>,
  ) {}

  async findByOrgAndKey(
    organizationId: string,
    flagKey: string,
  ): Promise<FeatureFlagEntity | null> {
    return this.repo.findOne({
      where: { organizationId, flagKey },
    });
  }

  async findByOrganization(
    organizationId: string,
  ): Promise<FeatureFlagEntity[]> {
    return this.repo.find({
      where: { organizationId },
    });
  }

  async upsert(
    organizationId: string,
    flagKey: string,
    enabled: boolean,
  ): Promise<FeatureFlagEntity> {
    const existing = await this.findByOrgAndKey(organizationId, flagKey);
    if (existing) {
      existing.enabled = enabled;
      return this.repo.save(existing);
    }
    const entity = this.repo.create({ organizationId, flagKey, enabled });
    return this.repo.save(entity);
  }
}
