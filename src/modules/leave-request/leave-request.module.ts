import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { LeaveRequestEntity } from './entities/leave-request.entity';
import { LeaveRequestRepository } from './repositories/leave-request.repository';
import { LeaveRequestService } from './services/leave-request.service';
import { LeaveRequestController } from './controllers/leave-request.controller';

@Module({
  imports: [TypeOrmModule.forFeature([LeaveRequestEntity])],
  controllers: [LeaveRequestController],
  providers: [LeaveRequestRepository, LeaveRequestService],
  exports: [LeaveRequestService],
})
export class LeaveRequestModule {}
