import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, IsNull } from 'typeorm';
import { TeacherEntity } from '../../teacher/entities/teacher.entity';
import { ClassEntity } from '../../class/entities/class.entity';
import { SubjectEntity } from '../../subject/entities/subject.entity';
import { RoomEntity } from '../../room/entities/room.entity';
import { PeriodDefinitionEntity } from '../../academic/entities/period-definition.entity';
import { SchoolEntity } from '../../school/entities/school.entity';
import { TeachingAssignmentEntity } from '../../teaching-assignment/entities/teaching-assignment.entity';
import {
  FetInputData,
  TeachingAssignmentDto,
  TeacherDto,
  TeacherAvailabilityDto,
  ClassDto,
  SubjectDto,
  RoomDto,
  RoomConstraintDto,
  PeriodDefinitionDto,
} from '../interfaces/fet-dto.interface';

/** Default school days (Monday–Saturday in Vietnamese) */
const DEFAULT_DAYS: string[] = [
  'Thứ 2',
  'Thứ 3',
  'Thứ 4',
  'Thứ 5',
  'Thứ 6',
  'Thứ 7',
];

@Injectable()
export class FetInputDataCollectorService {
  private readonly logger = new Logger(FetInputDataCollectorService.name);

  constructor(
    @InjectRepository(TeacherEntity)
    private readonly teacherRepo: Repository<TeacherEntity>,
    @InjectRepository(ClassEntity)
    private readonly classRepo: Repository<ClassEntity>,
    @InjectRepository(SubjectEntity)
    private readonly subjectRepo: Repository<SubjectEntity>,
    @InjectRepository(RoomEntity)
    private readonly roomRepo: Repository<RoomEntity>,
    @InjectRepository(PeriodDefinitionEntity)
    private readonly periodDefinitionRepo: Repository<PeriodDefinitionEntity>,
    @InjectRepository(SchoolEntity)
    private readonly schoolRepo: Repository<SchoolEntity>,
    @InjectRepository(TeachingAssignmentEntity)
    private readonly teachingAssignmentRepo: Repository<TeachingAssignmentEntity>,
  ) {}

  /**
   * Collects all domain data needed for FET timetable generation.
   * All queries are filtered by schoolId for multi-tenant isolation.
   */
  async collectForGeneration(
    semesterId: string,
    schoolId: string,
  ): Promise<FetInputData> {
    this.logger.log(
      `Collecting FET input data for school=${schoolId}, semester=${semesterId}`,
    );

    const [
      school,
      teachers,
      classes,
      subjects,
      rooms,
      periodDefinitions,
      teachingAssignments,
    ] = await Promise.all([
      this.querySchool(schoolId),
      this.queryTeachers(schoolId),
      this.queryClasses(schoolId),
      this.querySubjects(schoolId),
      this.queryRooms(schoolId),
      this.queryPeriodDefinitions(schoolId),
      this.queryTeachingAssignments(semesterId, schoolId),
    ]);

    const institution = school?.name ?? '';
    const teacherDtos = this.mapTeachers(teachers);
    const teacherAvailability = this.extractTeacherAvailability(teachers);
    const classDtos = this.mapClasses(classes);
    const subjectDtos = this.mapSubjects(subjects);
    const roomDtos = this.mapRooms(rooms);
    const periodDefinitionDtos = this.mapPeriodDefinitions(periodDefinitions);
    const teachingAssignmentDtos =
      this.mapTeachingAssignments(teachingAssignments);
    const roomConstraints = this.deriveRoomConstraints(subjects, rooms);

    this.logger.log(
      `Collected: ${teachingAssignmentDtos.length} assignments, ` +
        `${teacherDtos.length} teachers, ${classDtos.length} classes, ` +
        `${subjectDtos.length} subjects, ${roomDtos.length} rooms, ` +
        `${periodDefinitionDtos.length} periods`,
    );

    return {
      institution,
      schoolId,
      semesterId,
      teachingAssignments: teachingAssignmentDtos,
      teachers: teacherDtos,
      classes: classDtos,
      subjects: subjectDtos,
      rooms: roomDtos,
      periodDefinitions: periodDefinitionDtos,
      days: DEFAULT_DAYS,
      teacherAvailability,
      roomConstraints,
    };
  }

  // ─── Private Query Methods ─────────────────────────────────────────────

  private async querySchool(schoolId: string): Promise<SchoolEntity | null> {
    return this.schoolRepo.findOne({
      where: { id: schoolId, deletedAt: IsNull() },
    });
  }

  private async queryTeachers(schoolId: string): Promise<TeacherEntity[]> {
    return this.teacherRepo.find({
      where: { schoolId, deletedAt: IsNull() },
    });
  }

  private async queryClasses(schoolId: string): Promise<ClassEntity[]> {
    return this.classRepo.find({
      where: { schoolId, deletedAt: IsNull() },
    });
  }

  private async querySubjects(schoolId: string): Promise<SubjectEntity[]> {
    return this.subjectRepo.find({
      where: { schoolId, deletedAt: IsNull() },
    });
  }

  private async queryRooms(schoolId: string): Promise<RoomEntity[]> {
    return this.roomRepo.find({
      where: { schoolId, deletedAt: IsNull() },
    });
  }

  private async queryPeriodDefinitions(
    schoolId: string,
  ): Promise<PeriodDefinitionEntity[]> {
    return this.periodDefinitionRepo.find({
      where: { schoolId, deletedAt: IsNull() },
      order: { periodNumber: 'ASC' },
    });
  }

  private async queryTeachingAssignments(
    semesterId: string,
    schoolId: string,
  ): Promise<TeachingAssignmentEntity[]> {
    // TeachingAssignment doesn't have a direct schoolId column.
    // Filter via the teacher relation to enforce multi-tenant isolation.
    return this.teachingAssignmentRepo
      .createQueryBuilder('ta')
      .innerJoin('ta.teacher', 'teacher')
      .where('ta.semesterId = :semesterId', { semesterId })
      .andWhere('teacher.schoolId = :schoolId', { schoolId })
      .andWhere('ta.deletedAt IS NULL')
      .getMany();
  }

  // ─── Private Mapping Methods ──────────────────────────────────────────

  private mapTeachers(teachers: TeacherEntity[]): TeacherDto[] {
    return teachers.map((t) => ({
      id: t.id,
      name: t.shortName ?? t.fullName,
      maxPeriodsPerDay: t.maxPeriodsPerDay,
    }));
  }

  private extractTeacherAvailability(
    teachers: TeacherEntity[],
  ): TeacherAvailabilityDto[] {
    return teachers
      .filter(
        (t) =>
          t.unavailableSlots !== null &&
          t.unavailableSlots !== undefined &&
          t.unavailableSlots.length > 0,
      )
      .map((t) => ({
        teacherId: t.id,
        unavailableSlots: (t.unavailableSlots ?? []).map((slot) => ({
          dayOfWeek: slot.dayOfWeek,
          periodId: slot.periodId,
        })),
      }));
  }

  private mapClasses(classes: ClassEntity[]): ClassDto[] {
    return classes.map((c) => ({
      id: c.id,
      name: c.name,
      gradeId: c.gradeId,
    }));
  }

  private mapSubjects(subjects: SubjectEntity[]): SubjectDto[] {
    return subjects.map((s) => ({
      id: s.id,
      name: s.name,
    }));
  }

  private mapRooms(rooms: RoomEntity[]): RoomDto[] {
    return rooms.map((r) => ({
      id: r.id,
      name: r.name,
      capacity: r.capacity,
    }));
  }

  private mapPeriodDefinitions(
    periods: PeriodDefinitionEntity[],
  ): PeriodDefinitionDto[] {
    return periods.map((p) => ({
      id: p.id,
      periodNumber: p.periodNumber,
      name: `Tiết ${p.periodNumber}`,
      sessionId: p.sessionId,
    }));
  }

  private mapTeachingAssignments(
    assignments: TeachingAssignmentEntity[],
  ): TeachingAssignmentDto[] {
    return assignments.map((a) => ({
      id: a.id,
      teacherId: a.teacherId,
      classId: a.classId,
      subjectId: a.subjectId,
      periodsPerWeek: a.periodsPerWeek,
    }));
  }

  /**
   * Derives room constraints from subject requiresRoomType and room roomType.
   * If a subject requires a specific room type, we match it against available rooms
   * of that type and create constraints with weight 100 (mandatory).
   * Returns empty array if no subject-room type mappings exist.
   */
  private deriveRoomConstraints(
    subjects: SubjectEntity[],
    rooms: RoomEntity[],
  ): RoomConstraintDto[] {
    const constraints: RoomConstraintDto[] = [];

    // Group rooms by their roomType
    const roomsByType = new Map<string, RoomEntity[]>();
    for (const room of rooms) {
      const existing = roomsByType.get(room.roomType) ?? [];
      existing.push(room);
      roomsByType.set(room.roomType, existing);
    }

    // For subjects that require a specific (non-standard) room type,
    // create constraints linking subject to compatible rooms
    for (const subject of subjects) {
      if (subject.requiresRoomType) {
        const compatibleRooms = roomsByType.get(subject.requiresRoomType) ?? [];
        for (const room of compatibleRooms) {
          constraints.push({
            subjectId: subject.id,
            roomId: room.id,
            weight: 100, // mandatory
          });
        }
      }
    }

    return constraints;
  }
}
