import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DataSource } from 'typeorm';
import { seedSystemConfig } from '../seeds/system-config.seed';
import { seedComprehensive } from '../seeds/comprehensive-seed';

/**
 * SeederService — Tự động seed dữ liệu test khi app khởi động.
 *
 * Điều kiện chạy:
 * - NODE_ENV !== 'production'
 * - AUTO_SEED=true trong .env
 *
 * Idempotent — an toàn khi app restart nhiều lần.
 */
@Injectable()
export class SeederService implements OnModuleInit {
  private readonly logger = new Logger(SeederService.name);

  constructor(
    private readonly dataSource: DataSource,
    private readonly configService: ConfigService,
  ) {}

  async onModuleInit(): Promise<void> {
    const nodeEnv = this.configService.get<string>('NODE_ENV', 'development');
    const autoSeed = this.configService.get<string>('AUTO_SEED', 'false');

    if (nodeEnv === 'production') {
      this.logger.log('Skipping auto-seed in production environment');
      return;
    }

    if (autoSeed !== 'true') {
      this.logger.log(
        'Auto-seed disabled. Set AUTO_SEED=true in .env to enable.',
      );
      return;
    }

    this.logger.log('🌱 Auto-seed enabled. Running comprehensive seed...');

    try {
      await seedSystemConfig(this.dataSource);
      await seedComprehensive(this.dataSource);
      this.logger.log('✅ Auto-seed completed successfully');
    } catch (error) {
      this.logger.error('❌ Auto-seed failed:', error);
      // Không throw — app vẫn start bình thường dù seed lỗi
    }
  }
}
