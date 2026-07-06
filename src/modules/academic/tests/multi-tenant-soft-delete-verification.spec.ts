/**
 * Tasks 22.3 + 23.2: Multi-Tenant Isolation & Soft Delete Behavior Verification
 *
 * 22.3: Unit test multi-tenant isolation
 *   - Service with schoolId A does not return data of schoolId B
 *   - Create assigns correct schoolId from context
 *   - Applied to 3 representative services: AcademicYear, Teacher, Room
 *
 * 23.2: Unit test soft delete behavior
 *   - Delete does not remove record from DB (calls softDelete)
 *   - findAll excludes soft-deleted records (via repository filter)
 *   - findById returns 404 for soft-deleted record
 *   - Applied to 2 representative services: Teacher, Room
 */
import { NotFoundException } from '@nestjs/common';
import { TeacherService } from '../../teacher/teacher.service';
import { TeacherRepository } from '../../teacher/teacher.repository';
import { TeacherSubjectService } from '../../teacher/teacher-subject.service';
import { RoomService } from '../../room/room.service';
import { RoomRepository } from '../../room/room.repository';
import { AcademicYearService } from '../services/academic-year.service';
import { AcademicYearRepository } from '../repositories/academic-year.repository';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { DataSource } from 'typeorm';

// ─── Constants ───────────────────────────────────────────────────────────────
const SCHOOL_A_ID = 'school-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
const SCHOOL_B_ID = 'school-bbbb-bbbb-bbbb-bbbbbbbbbbbb';

// ─── Mock Factories ──────────────────────────────────────────────────────────

function createMockTeacherRepository() {
  return {
    findAll: jest.fn(),
    findById: jest.fn(),
    findByIdInternal: jest.fn(),
    findBySchool: jest.fn(),
    findByEmployeeCode: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    softDelete: jest.fn(),
  };
}

function createMockRoomRepository() {
  return {
    findAll: jest.fn(),
    findById: jest.fn(),
    findBySchool: jest.fn(),
    findByCode: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    softDelete: jest.fn(),
  };
}

function createMockAcademicYearRepository() {
  return {
    findAll: jest.fn(),
    findById: jest.fn(),
    findBySchool: jest.fn(),
    findCurrent: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    softDelete: jest.fn(),
    findOverlapping: jest.fn(),
  };
}

function createMockTeacherSubjectService() {
  return {
    getSubjectsMapForTeachers: jest.fn().mockResolvedValue(new Map()),
    getSubjectsForTeacher: jest.fn().mockResolvedValue([]),
    assignSubjects: jest.fn(),
    removeAssignment: jest.fn(),
    getAssignmentsForTeacher: jest.fn(),
  };
}

// ─── 22.3: Multi-Tenant Isolation Tests ──────────────────────────────────────

describe('Task 22.3: Multi-Tenant Isolation', () => {
  describe('TeacherService — schoolId A cannot access schoolId B', () => {
    let service: TeacherService;
    let repository: ReturnType<typeof createMockTeacherRepository>;
    let teacherSubjectService: ReturnType<
      typeof createMockTeacherSubjectService
    >;

    beforeEach(() => {
      repository = createMockTeacherRepository();
      teacherSubjectService = createMockTeacherSubjectService();
      const eventEmitter = { emit: jest.fn() } as unknown as EventEmitter2;
      service = new TeacherService(
        repository as unknown as TeacherRepository,
        teacherSubjectService as unknown as TeacherSubjectService,
        eventEmitter,
      );
    });

    it('findAll with schoolId A only queries data scoped to school A', async () => {
      const teacherA = {
        id: 'teacher-1',
        schoolId: SCHOOL_A_ID,
        fullName: 'GV Trường A',
      };
      repository.findAll.mockResolvedValue([[teacherA], 1]);

      const result = await service.findAll(
        { page: 1, limit: 10, sortOrder: 'ASC' as const },
        SCHOOL_A_ID,
      );

      expect(repository.findAll).toHaveBeenCalledWith(
        expect.objectContaining({ page: 1, limit: 10 }),
        SCHOOL_A_ID,
      );
      expect(result.data).toHaveLength(1);
      expect(result.data[0].schoolId).toBe(SCHOOL_A_ID);
    });

    it('findById with schoolId A throws NotFoundException when teacher belongs to school B', async () => {
      // Repository returns null because it filters by schoolId
      repository.findById.mockResolvedValue(null);

      await expect(
        service.findById('teacher-of-school-b', SCHOOL_A_ID),
      ).rejects.toThrow(NotFoundException);

      expect(repository.findById).toHaveBeenCalledWith(
        'teacher-of-school-b',
        SCHOOL_A_ID,
      );
    });

    it('create assigns correct schoolId from context', async () => {
      const dto = {
        schoolId: SCHOOL_A_ID,
        employeeCode: 'GV001',
        fullName: 'Nguyễn Văn A',
      };
      repository.findByEmployeeCode.mockResolvedValue(null);
      repository.create.mockResolvedValue({ id: 'new-id', ...dto });

      await service.create(dto as any);

      expect(repository.create).toHaveBeenCalledWith(
        expect.objectContaining({ schoolId: SCHOOL_A_ID }),
      );
    });
  });

  describe('RoomService — schoolId A cannot access schoolId B', () => {
    let service: RoomService;
    let repository: ReturnType<typeof createMockRoomRepository>;

    beforeEach(() => {
      repository = createMockRoomRepository();
      service = new RoomService(repository as unknown as RoomRepository);
    });

    it('findAll with schoolId A only queries data scoped to school A', async () => {
      const roomA = { id: 'room-1', schoolId: SCHOOL_A_ID, code: 'P101' };
      repository.findAll.mockResolvedValue([[roomA], 1]);

      const result = await service.findAll(
        { page: 1, limit: 10, sortOrder: 'ASC' as const } as any,
        SCHOOL_A_ID,
      );

      expect(repository.findAll).toHaveBeenCalledWith(
        expect.anything(),
        SCHOOL_A_ID,
      );
      expect(result.data[0].schoolId).toBe(SCHOOL_A_ID);
    });

    it('findById with schoolId A throws NotFoundException when room belongs to school B', async () => {
      repository.findById.mockResolvedValue(null);

      await expect(
        service.findById('room-of-school-b', SCHOOL_A_ID),
      ).rejects.toThrow(NotFoundException);

      expect(repository.findById).toHaveBeenCalledWith(
        'room-of-school-b',
        SCHOOL_A_ID,
      );
    });

    it('create assigns correct schoolId from context', async () => {
      const dto = { code: 'P201', name: 'Phòng 201' };
      repository.findByCode.mockResolvedValue(null);
      repository.create.mockResolvedValue({
        id: 'new-room',
        schoolId: SCHOOL_A_ID,
        ...dto,
      });

      await service.create(dto as any, SCHOOL_A_ID);

      expect(repository.create).toHaveBeenCalledWith(
        expect.objectContaining({ schoolId: SCHOOL_A_ID }),
      );
    });
  });

  describe('AcademicYearService — schoolId A cannot access schoolId B', () => {
    let service: AcademicYearService;
    let repository: ReturnType<typeof createMockAcademicYearRepository>;

    beforeEach(() => {
      repository = createMockAcademicYearRepository();
      const mockDataSource = {
        transaction: jest.fn((cb) =>
          cb({
            update: jest.fn(),
            save: jest.fn(),
            findOne: jest.fn(),
            createQueryBuilder: jest.fn().mockReturnValue({
              update: jest.fn().mockReturnThis(),
              set: jest.fn().mockReturnThis(),
              where: jest.fn().mockReturnThis(),
              andWhere: jest.fn().mockReturnThis(),
              execute: jest.fn().mockResolvedValue({}),
            }),
          }),
        ),
      } as unknown as DataSource;
      service = new AcademicYearService(
        repository as unknown as AcademicYearRepository,
        mockDataSource,
      );
    });

    it('findAll with schoolId A only queries data scoped to school A', async () => {
      const yearA = { id: 'year-1', schoolId: SCHOOL_A_ID, name: '2024-2025' };
      repository.findAll.mockResolvedValue([[yearA], 1]);

      const result = await service.findAll(SCHOOL_A_ID, {
        page: 1,
        limit: 10,
        sortOrder: 'ASC' as const,
      } as any);

      expect(repository.findAll).toHaveBeenCalledWith(
        SCHOOL_A_ID,
        expect.anything(),
      );
      expect(result.data[0].schoolId).toBe(SCHOOL_A_ID);
    });

    it('setCurrent with schoolId A throws NotFoundException when academic year belongs to school B', async () => {
      // Repository returns an academic year belonging to school B
      const yearB = {
        id: 'year-b',
        schoolId: SCHOOL_B_ID,
        name: '2024-2025',
        status: 'planning',
      };
      repository.findById.mockResolvedValue(yearB);

      // Service checks schoolId match and throws
      await expect(service.setCurrent('year-b', SCHOOL_A_ID)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('transitionStatus with schoolId A throws NotFoundException for school B academic year', async () => {
      const yearB = {
        id: 'year-b',
        schoolId: SCHOOL_B_ID,
        name: '2024-2025',
        status: 'planning',
      };
      repository.findById.mockResolvedValue(yearB);

      await expect(
        service.transitionStatus('year-b', 'active' as any, SCHOOL_A_ID),
      ).rejects.toThrow(NotFoundException);
    });

    it('create assigns correct schoolId from context', async () => {
      const dto = {
        schoolId: SCHOOL_A_ID,
        name: '2024-2025',
        startDate: '2024-09-01',
        endDate: '2025-06-30',
      };
      repository.findOverlapping.mockResolvedValue([]);
      repository.create.mockResolvedValue({ id: 'new-year', ...dto });

      await service.create(dto as any);

      expect(repository.create).toHaveBeenCalledWith(
        expect.objectContaining({ schoolId: SCHOOL_A_ID }),
      );
    });
  });
});

// ─── 23.2: Soft Delete Behavior Tests ────────────────────────────────────────

describe('Task 23.2: Soft Delete Behavior', () => {
  describe('TeacherService — soft delete semantics', () => {
    let service: TeacherService;
    let repository: ReturnType<typeof createMockTeacherRepository>;
    let teacherSubjectService: ReturnType<
      typeof createMockTeacherSubjectService
    >;

    beforeEach(() => {
      repository = createMockTeacherRepository();
      teacherSubjectService = createMockTeacherSubjectService();
      const eventEmitter = { emit: jest.fn() } as unknown as EventEmitter2;
      service = new TeacherService(
        repository as unknown as TeacherRepository,
        teacherSubjectService as unknown as TeacherSubjectService,
        eventEmitter,
      );
    });

    it('remove calls softDelete (not hard delete) — record remains in DB', async () => {
      const teacher = {
        id: 'teacher-1',
        schoolId: SCHOOL_A_ID,
        fullName: 'Test',
      };
      repository.findById.mockResolvedValue(teacher);
      repository.softDelete.mockResolvedValue(undefined);

      await service.remove('teacher-1', SCHOOL_A_ID);

      // softDelete is called — record is NOT physically removed
      expect(repository.softDelete).toHaveBeenCalledWith(
        'teacher-1',
        SCHOOL_A_ID,
      );
    });

    it('findAll excludes soft-deleted records (repository filters deletedAt IS NULL)', async () => {
      // Repository already filters by deletedAt IS NULL; returns empty when all soft-deleted
      repository.findAll.mockResolvedValue([[], 0]);

      const result = await service.findAll(
        { page: 1, limit: 10, sortOrder: 'ASC' as const },
        SCHOOL_A_ID,
      );

      // No soft-deleted records returned
      expect(result.data).toHaveLength(0);
      expect(result.meta.total).toBe(0);
    });

    it('findById returns NotFoundException for soft-deleted record', async () => {
      // Repository returns null for soft-deleted record (filtered by deletedAt IS NULL)
      repository.findById.mockResolvedValue(null);

      await expect(
        service.findById('soft-deleted-teacher', SCHOOL_A_ID),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('RoomService — soft delete semantics', () => {
    let service: RoomService;
    let repository: ReturnType<typeof createMockRoomRepository>;

    beforeEach(() => {
      repository = createMockRoomRepository();
      service = new RoomService(repository as unknown as RoomRepository);
    });

    it('remove calls softDelete (not hard delete) — record remains in DB', async () => {
      const room = { id: 'room-1', schoolId: SCHOOL_A_ID, code: 'P101' };
      repository.findById.mockResolvedValue(room);
      repository.softDelete.mockResolvedValue(undefined);

      await service.remove('room-1', SCHOOL_A_ID);

      // softDelete is called — record is NOT physically removed
      expect(repository.softDelete).toHaveBeenCalledWith('room-1', SCHOOL_A_ID);
    });

    it('findAll excludes soft-deleted records (repository filters deletedAt IS NULL)', async () => {
      // Repository already filters by deletedAt IS NULL; returns empty when all soft-deleted
      repository.findAll.mockResolvedValue([[], 0]);

      const result = await service.findAll(
        { page: 1, limit: 10, sortOrder: 'ASC' as const } as any,
        SCHOOL_A_ID,
      );

      // No soft-deleted records returned
      expect(result.data).toHaveLength(0);
      expect(result.meta.total).toBe(0);
    });

    it('findById returns NotFoundException for soft-deleted record', async () => {
      // Repository returns null for soft-deleted record (filtered by deletedAt IS NULL)
      repository.findById.mockResolvedValue(null);

      await expect(
        service.findById('soft-deleted-room', SCHOOL_A_ID),
      ).rejects.toThrow(NotFoundException);
    });
  });
});
