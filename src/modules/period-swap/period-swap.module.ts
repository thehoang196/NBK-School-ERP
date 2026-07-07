import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PeriodSwapEntity } from './entities/period-swap.entity';
import { PeriodSwapRepository } from './repositories/period-swap.repository';
import { PeriodSwapService } from './services/period-swap.service';
import { PeriodSwapController } from './controllers/period-swap.controller';
import { PeriodSwapEventListener } from './listeners/period-swap-event.listener';

@Module({
  imports: [TypeOrmModule.forFeature([PeriodSwapEntity])],
  controllers: [PeriodSwapController],
  providers: [PeriodSwapRepository, PeriodSwapService, PeriodSwapEventListener],
  exports: [PeriodSwapService],
})
export class PeriodSwapModule {}
