import { Injectable } from '@nestjs/common';
import { TimetableSlotRepository } from '../repositories/timetable-slot.repository';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { TeacherEntity } from '../../teacher/entities/teacher.entity';

export enum ConflictType {
  TEACHER_CONFLICT = 'teacher_conflict',
  CLASS_CONFLICT = 'class_conflict',
  ROOM_CONFLICT = 'room_conflict',
  TEACHER_MAX_PERIODS = 'teacher_max_periods',
  TEACHER_UNAVAILABLE = 'teacher_unavailable',
}

export interface ConflictResult {
  type: ConflictType;
  severity: 'error' | 'warning';
  message: string;
  details: {
    slotId?: string;
    teacherId?: string;
    classId?: string;
    roomId?: string;
    dayOfWeek?: number;
    periodId?: string;
  };
}

@Injectable()
export class ConflictDetectionService {
  constructor(
    private readonly slotRepository: TimetableSlotRepository,
    @InjectRepository(TeacherEntity)
    private readonly teacherRepo: Repository<TeacherEntity>,
  ) {}

  async checkSlotConflicts(
    versionId: string,
    dayOfWeek: number,
    periodId: string,
    teacherId: string,
    classId: string,
    roomId: string | null,
    excludeSlotId?: string,
  ): Promise<ConflictResult[]> {
    const conflicts: ConflictResult[] = [];

    // Lấy tất cả slots cùng version, ngày, tiết
    const existingSlots = await this.slotRepository.findConflicts({
      versionId, dayOfWeek, periodId, excludeId: excludeSlotId,
    });

    // Check teacher conflict - GV dạy 2 lớp cùng lúc
    const teacherConflict = existingSlots.find(s => s.teacherId === teacherId);
    if (teacherConflict) {
      conflicts.push({
        type: ConflictType.TEACHER_CONFLICT,
        severity: 'error',
        message: `Giáo viên đã có tiết dạy vào thời điểm này`,
        details: {
          slotId: teacherConflict.id,
          teacherId,
          dayOfWeek,
          periodId,
        },
      });
    }

    // Check class conflict - Lớp có 2 tiết cùng lúc
    const classConflict = existingSlots.find(s => s.classId === classId);
    if (classConflict) {
      conflicts.push({
        type: ConflictType.CLASS_CONFLICT,
        severity: 'error',
        message: `Lớp đã có tiết học vào thời điểm này`,
        details: {
          slotId: classConflict.id,
          classId,
          dayOfWeek,
          periodId,
        },
      });
    }

    // Check room conflict - Phòng bị dùng 2 lần cùng lúc
    if (roomId) {
      const roomConflict = existingSlots.find(s => s.roomId === roomId);
      if (roomConflict) {
        conflicts.push({
          type: ConflictType.ROOM_CONFLICT,
          severity: 'error',
          message: `Phòng học đã được sử dụng vào thời điểm này`,
          details: {
            slotId: roomConflict.id,
            roomId,
            dayOfWeek,
            periodId,
          },
        });
      }
    }

    // Check teacher max periods per day
    await this.checkTeacherMaxPeriodsPerDay(versionId, dayOfWeek, teacherId, excludeSlotId, conflicts);

    // Check teacher unavailable slots
    await this.checkTeacherUnavailable(teacherId, dayOfWeek, periodId, conflicts);

    return conflicts;
  }

  private async checkTeacherMaxPeriodsPerDay(
    versionId: string,
    dayOfWeek: number,
    teacherId: string,
    excludeSlotId: string | undefined,
    conflicts: ConflictResult[],
  ): Promise<void> {
    const teacher = await this.teacherRepo.findOne({ where: { id: teacherId } });
    if (!teacher) return;

    // Đếm số tiết GV đang dạy trong ngày
    const allSlots = await this.slotRepository.findByQuery({
      versionId,
      teacherId,
    });
    const slotsInDay = allSlots.filter(
      s => s.dayOfWeek === dayOfWeek && s.id !== excludeSlotId,
    );

    if (slotsInDay.length >= teacher.maxPeriodsPerDay) {
      conflicts.push({
        type: ConflictType.TEACHER_MAX_PERIODS,
        severity: 'warning',
        message: `Giáo viên đã đạt số tiết tối đa/ngày (${teacher.maxPeriodsPerDay})`,
        details: {
          teacherId,
          dayOfWeek,
        },
      });
    }
  }

  private async checkTeacherUnavailable(
    teacherId: string,
    dayOfWeek: number,
    periodId: string,
    conflicts: ConflictResult[],
  ): Promise<void> {
    const teacher = await this.teacherRepo.findOne({ where: { id: teacherId } });
    if (!teacher || !teacher.unavailableSlots) return;

    const isUnavailable = teacher.unavailableSlots.some(
      slot => slot.dayOfWeek === dayOfWeek && slot.periodId === periodId,
    );

    if (isUnavailable) {
      conflicts.push({
        type: ConflictType.TEACHER_UNAVAILABLE,
        severity: 'error',
        message: `Giáo viên không thể dạy vào thời điểm này (đã đăng ký không khả dụng)`,
        details: {
          teacherId,
          dayOfWeek,
          periodId,
        },
      });
    }
  }

  async checkAllConflicts(versionId: string): Promise<ConflictResult[]> {
    const allSlots = await this.slotRepository.findByVersion(versionId);
    const conflicts: ConflictResult[] = [];

    // Group by dayOfWeek + periodId
    const slotMap = new Map<string, typeof allSlots>();
    for (const slot of allSlots) {
      const key = `${slot.dayOfWeek}-${slot.periodId}`;
      if (!slotMap.has(key)) {
        slotMap.set(key, []);
      }
      slotMap.get(key)!.push(slot);
    }

    for (const [, slotsInTimeslot] of slotMap) {
      // Check teacher conflicts
      const teacherIds = slotsInTimeslot.map(s => s.teacherId);
      const duplicateTeachers = teacherIds.filter((id, idx) => teacherIds.indexOf(id) !== idx);
      for (const teacherId of duplicateTeachers) {
        const conflictSlots = slotsInTimeslot.filter(s => s.teacherId === teacherId);
        conflicts.push({
          type: ConflictType.TEACHER_CONFLICT,
          severity: 'error',
          message: `Giáo viên dạy ${conflictSlots.length} lớp cùng lúc`,
          details: {
            teacherId,
            dayOfWeek: slotsInTimeslot[0].dayOfWeek,
            periodId: slotsInTimeslot[0].periodId,
          },
        });
      }

      // Check room conflicts
      const roomIds = slotsInTimeslot.filter(s => s.roomId).map(s => s.roomId!);
      const duplicateRooms = roomIds.filter((id, idx) => roomIds.indexOf(id) !== idx);
      for (const roomId of duplicateRooms) {
        conflicts.push({
          type: ConflictType.ROOM_CONFLICT,
          severity: 'error',
          message: `Phòng học được dùng bởi nhiều lớp cùng lúc`,
          details: {
            roomId,
            dayOfWeek: slotsInTimeslot[0].dayOfWeek,
            periodId: slotsInTimeslot[0].periodId,
          },
        });
      }
    }

    return conflicts;
  }
}
