import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';

/**
 * Listener xử lý side-effects của Period Swap:
 * - Thông báo GV target khi có yêu cầu đổi tiết
 * - Thông báo admin khi GV target đồng ý (chờ duyệt)
 * - Thông báo cả hai GV khi admin duyệt
 * - Cập nhật actual_timetable_slots khi approved
 */
@Injectable()
export class PeriodSwapEventListener {
  private readonly logger = new Logger(PeriodSwapEventListener.name);

  @OnEvent('period-swap.created')
  async handleCreated(payload: {
    schoolId: string;
    requesterId: string;
    targetId: string;
    swapId: string;
  }): Promise<void> {
    try {
      this.logger.log(
        `[period-swap.created] schoolId=${payload.schoolId}, requester=${payload.requesterId}, target=${payload.targetId}, swapId=${payload.swapId}`,
      );
      // TODO: Gửi notification cho GV target biết có yêu cầu đổi tiết mới
    } catch (error) {
      this.logger.error(
        `Listener period-swap.created failed: ${(error as Error).message}`,
        { payload, error },
      );
    }
  }

  @OnEvent('period-swap.accepted-by-teacher')
  async handleAcceptedByTeacher(payload: {
    schoolId: string;
    swapId: string;
  }): Promise<void> {
    try {
      this.logger.log(
        `[period-swap.accepted-by-teacher] schoolId=${payload.schoolId}, swapId=${payload.swapId}`,
      );
      // TODO: Gửi notification cho admin biết có yêu cầu đổi tiết chờ duyệt
      // TODO: Gửi notification cho requester biết target đã đồng ý
    } catch (error) {
      this.logger.error(
        `Listener period-swap.accepted-by-teacher failed: ${(error as Error).message}`,
        { payload, error },
      );
    }
  }

  @OnEvent('period-swap.approved')
  async handleApproved(payload: {
    schoolId: string;
    swapId: string;
    requesterId: string;
    targetId: string;
    requesterDate: string;
    requesterPeriod: number;
    targetDate: string;
    targetPeriod: number;
  }): Promise<void> {
    try {
      this.logger.log(
        `[period-swap.approved] schoolId=${payload.schoolId}, swapId=${payload.swapId}`,
      );
      // TODO: Cập nhật actual_timetable_slots - hoán đổi tiết giữa 2 GV
      // TODO: Gửi notification cho cả 2 GV biết đổi tiết đã được duyệt
    } catch (error) {
      this.logger.error(
        `Listener period-swap.approved failed: ${(error as Error).message}`,
        { payload, error },
      );
    }
  }
}
