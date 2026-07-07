import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';

/**
 * Listener xử lý side-effects của Leave Request:
 * - Thông báo cho admin khi có đơn mới
 * - Thông báo cho GV khi đơn được duyệt/từ chối
 */
@Injectable()
export class LeaveRequestEventListener {
  private readonly logger = new Logger(LeaveRequestEventListener.name);

  @OnEvent('leave-request.created')
  async handleCreated(payload: {
    schoolId: string;
    teacherId: string;
    requestId: string;
  }): Promise<void> {
    try {
      this.logger.log(
        `[leave-request.created] schoolId=${payload.schoolId}, teacherId=${payload.teacherId}, requestId=${payload.requestId}`,
      );
      // TODO: Gửi notification cho admin/BGH khi có đơn nghỉ mới
    } catch (error) {
      this.logger.error(
        `Listener leave-request.created failed: ${(error as Error).message}`,
        { payload, error },
      );
    }
  }

  @OnEvent('leave-request.approved')
  async handleApproved(payload: {
    schoolId: string;
    teacherId: string;
    requestId: string;
    startDate: string;
    endDate: string;
  }): Promise<void> {
    try {
      this.logger.log(
        `[leave-request.approved] schoolId=${payload.schoolId}, teacherId=${payload.teacherId}, requestId=${payload.requestId}`,
      );
      // TODO: Gửi notification cho GV biết đơn đã được duyệt
      // TODO: Cập nhật dữ liệu chấm công nếu cần
    } catch (error) {
      this.logger.error(
        `Listener leave-request.approved failed: ${(error as Error).message}`,
        { payload, error },
      );
    }
  }

  @OnEvent('leave-request.rejected')
  async handleRejected(payload: {
    schoolId: string;
    teacherId: string;
    requestId: string;
  }): Promise<void> {
    try {
      this.logger.log(
        `[leave-request.rejected] schoolId=${payload.schoolId}, teacherId=${payload.teacherId}, requestId=${payload.requestId}`,
      );
      // TODO: Gửi notification cho GV biết đơn bị từ chối
    } catch (error) {
      this.logger.error(
        `Listener leave-request.rejected failed: ${(error as Error).message}`,
        { payload, error },
      );
    }
  }
}
