import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import {
  TeacherCreatedEvent,
  TeacherUpdatedEvent,
  TeacherDeletedEvent,
  TeachersMergedEvent,
  TeachersImportedEvent,
} from '../events/teacher.events';

/**
 * Listener xử lý side effects khi teacher data thay đổi.
 * Mỗi handler chạy async, không block main flow.
 *
 * Trong tương lai có thể:
 * - Sync to Payroll (tự động tạo/update employee record)
 * - Push notification to admin
 * - Emit webhook to external systems
 * - Update cache
 */
@Injectable()
export class TeacherEventListener {
  private readonly logger = new Logger(TeacherEventListener.name);

  @OnEvent(TeacherCreatedEvent.eventName, { async: true })
  async handleTeacherCreated(event: TeacherCreatedEvent): Promise<void> {
    this.logger.log(
      `[teacher.created] Teacher created: ${event.employeeCode} (${event.fullName}) in school ${event.schoolId}`,
    );

    // TODO: Phase 2 — Auto-create payroll employee record
    // await this.payrollService.createEmployeeRecord(event.teacherId);

    // TODO: Phase 2 — Notify school admin
    // await this.notificationService.notifyAdmin(event.schoolId, `Giáo viên mới: ${event.fullName}`);
  }

  @OnEvent(TeacherUpdatedEvent.eventName, { async: true })
  async handleTeacherUpdated(event: TeacherUpdatedEvent): Promise<void> {
    this.logger.log(
      `[teacher.updated] Teacher updated: ${event.employeeCode}, fields: [${event.changedFields.join(', ')}]`,
    );

    // TODO: Phase 2 — Sync changed fields to payroll if relevant
    // const payrollFields = ['fullName', 'citizenId', 'dateOfBirth', 'phone', 'email'];
    // const relevantChanges = event.changedFields.filter(f => payrollFields.includes(f));
    // if (relevantChanges.length > 0) {
    //   await this.payrollService.syncEmployeeData(event.teacherId, relevantChanges);
    // }
  }

  @OnEvent(TeacherDeletedEvent.eventName, { async: true })
  async handleTeacherDeleted(event: TeacherDeletedEvent): Promise<void> {
    this.logger.log(
      `[teacher.deleted] Teacher deleted: ${event.employeeCode} in school ${event.schoolId}`,
    );

    // TODO: Phase 2 — Deactivate payroll record
    // await this.payrollService.deactivateEmployee(event.teacherId);
  }

  @OnEvent(TeachersMergedEvent.eventName, { async: true })
  async handleTeachersMerged(event: TeachersMergedEvent): Promise<void> {
    this.logger.log(
      `[teacher.merged] Merged ${event.secondaryTeacherId} → ${event.primaryTeacherId}, ${event.referencesUpdated} refs updated`,
    );

    // TODO: Phase 2 — Merge payroll records
    // await this.payrollService.mergeEmployees(event.primaryTeacherId, event.secondaryTeacherId);
  }

  @OnEvent(TeachersImportedEvent.eventName, { async: true })
  async handleTeachersImported(event: TeachersImportedEvent): Promise<void> {
    this.logger.log(
      `[teacher.imported] Import completed: ${event.successCount} success, ${event.errorCount} errors in school ${event.schoolId}`,
    );

    // TODO: Phase 2 — Batch sync new teachers to payroll
    // TODO: Phase 2 — Send admin summary notification
  }
}
