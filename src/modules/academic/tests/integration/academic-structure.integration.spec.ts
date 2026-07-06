import { NotFoundException } from '@nestjs/common';
import { DataSource, EntityManager } from 'typeorm';
import { CampusGradeLevelService } from '../../services/campus-grade-level.service';
import { WeekService } from '../../services/week.service';
import { SessionService } from '../../services/session.service';
import { AcademicYearService } from '../../services/academic-year.service';
import { CampusGradeLevelRepository } from '../../repositories/campus-grade-level.repository';
import { WeekRepository } from '../../repositories/week.repository';
import { SemesterRepository } from '../../repositories/semester.repository';
import { SessionRepository } from '../../repositories/session.repository';
import { AcademicYearRepository } from '../../repositories/academic-year.repository';
import { CampusGradeLevelEntity } from '../../entities/campus-grade-level.entity';
import { WeekEntity } from '../../entities/week.entity';
import { SemesterEntity } from '../../entities/semester.entity';
import { SessionEntity } from '../../entities/session.entity';
import { AcademicYearEntity } from '../../entities/academic-year.entity';
import { GradeLevel, WeekType } from '../../enums';
import { AcademicStatus } from '../../../../common/enums/status.enum';
import {
  CampusGradeLevelExistsException,
  CampusGradeLevelNotFoundException,
  InvalidDateRangeException,
  WeekOutOfRangeException,
  WeekOverlapException,
  BulkGenerationConflictException,
  InvalidStatusTransitionException,
} from '../../exceptions';

// ============================================================
// In-memory state-tracking mocks
// ============================================================

function createId(): string {
  return `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
}

function createInMemoryCampusGradeLevelRepository() {
  const store: CampusGradeLevelEntity[] = [];

  return {
    create: jest.fn(async (data: Partial<CampusGradeLevelEntity>) => {
      const entity = {
        id: createId(),
        campusId: data.campusId!,
        schoolId: data.schoolId!,
        gradeLevel: data.gradeLevel!,
        createdAt: new Date(),
        updatedAt: new Date(),
        deletedAt: null,
      } as CampusGradeLevelEntity;
      store.push(entity);
      return entity;
    }),
    findByCampus: jest.fn(async (campusId: string, schoolId: string) => {
      return store.filter(
        (r) =>
          r.campusId === campusId &&
          r.schoolId === schoolId &&
          r.deletedAt === null,
      );
    }),
    findByGradeLevel: jest.fn(
      async (gradeLevel: GradeLevel, schoolId: string) => {
        return store.filter(
          (r) =>
            r.gradeLevel === gradeLevel &&
            r.schoolId === schoolId &&
            r.deletedAt === null,
        );
      },
    ),
    findByCampusAndGrade: jest.fn(
      async (campusId: string, gradeLevel: GradeLevel, schoolId: string) => {
        return (
          store.find(
            (r) =>
              r.campusId === campusId &&
              r.gradeLevel === gradeLevel &&
              r.schoolId === schoolId &&
              r.deletedAt === null,
          ) ?? null
        );
      },
    ),
    findById: jest.fn(async (id: string, schoolId: string) => {
      return (
        store.find(
          (r) => r.id === id && r.schoolId === schoolId && r.deletedAt === null,
        ) ?? null
      );
    }),
    findAllBySchool: jest.fn(async (schoolId: string) => {
      return store.filter(
        (r) => r.schoolId === schoolId && r.deletedAt === null,
      );
    }),
    softDelete: jest.fn(async (id: string) => {
      const record = store.find((r) => r.id === id);
      if (record) {
        record.deletedAt = new Date();
      }
    }),
    _store: store,
  };
}

function createInMemoryWeekRepository() {
  const store: WeekEntity[] = [];

  return {
    findAll: jest.fn(
      async () =>
        [store.filter((w) => w.deletedAt === null), store.length] as [
          WeekEntity[],
          number,
        ],
    ),
    findById: jest.fn(async (id: string, schoolId?: string) => {
      return (
        store.find(
          (w) =>
            w.id === id &&
            w.deletedAt === null &&
            (!schoolId || w.schoolId === schoolId),
        ) ?? null
      );
    }),
    findBySemester: jest.fn(async (semesterId: string) => {
      return store
        .filter((w) => w.semesterId === semesterId && w.deletedAt === null)
        .sort((a, b) => a.weekNumber - b.weekNumber);
    }),
    findBySemesterWithFilters: jest.fn(
      async (semesterId: string, weekTypes?: WeekType[]) => {
        return store
          .filter(
            (w) =>
              w.semesterId === semesterId &&
              w.deletedAt === null &&
              (!weekTypes ||
                weekTypes.length === 0 ||
                weekTypes.includes(w.weekType)),
          )
          .sort((a, b) => a.weekNumber - b.weekNumber);
      },
    ),
    findOverlappingWeeks: jest.fn(
      async (
        semesterId: string,
        startDate: string,
        endDate: string,
        excludeWeekId?: string,
      ) => {
        return store.filter(
          (w) =>
            w.semesterId === semesterId &&
            w.deletedAt === null &&
            w.startDate <= endDate &&
            w.endDate >= startDate &&
            w.id !== excludeWeekId,
        );
      },
    ),
    getNextWeekNumber: jest.fn(async (semesterId: string) => {
      const semWeeks = store.filter(
        (w) => w.semesterId === semesterId && w.deletedAt === null,
      );
      if (semWeeks.length === 0) return 1;
      return Math.max(...semWeeks.map((w) => w.weekNumber)) + 1;
    }),
    countBySemester: jest.fn(async (semesterId: string) => {
      return store.filter(
        (w) => w.semesterId === semesterId && w.deletedAt === null,
      ).length;
    }),
    create: jest.fn(async (data: Partial<WeekEntity>) => {
      const entity = {
        id: createId(),
        semesterId: data.semesterId!,
        schoolId: data.schoolId!,
        weekNumber: data.weekNumber!,
        startDate: data.startDate!,
        endDate: data.endDate!,
        weekType: data.weekType ?? WeekType.REGULAR,
        note: data.note ?? null,
        createdAt: new Date(),
        updatedAt: new Date(),
        deletedAt: null,
      } as WeekEntity;
      store.push(entity);
      return entity;
    }),
    createMany: jest.fn(async (data: Partial<WeekEntity>[]) => {
      return Promise.all(
        data.map(
          (d) =>
            ({
              id: createId(),
              ...d,
              createdAt: new Date(),
              updatedAt: new Date(),
              deletedAt: null,
            }) as WeekEntity,
        ),
      );
    }),
    softDelete: jest.fn(async (id: string) => {
      const record = store.find((r) => r.id === id);
      if (record) record.deletedAt = new Date();
    }),
    reorderWeeks: jest.fn(
      async (updates: { id: string; weekNumber: number }[]) => {
        for (const { id, weekNumber } of updates) {
          const week = store.find((w) => w.id === id);
          if (week) week.weekNumber = weekNumber;
        }
      },
    ),
    _store: store,
  };
}

function createInMemorySemesterRepository() {
  const store: SemesterEntity[] = [];

  return {
    findById: jest.fn(async (id: string) => {
      return store.find((s) => s.id === id && s.deletedAt === null) ?? null;
    }),
    findByAcademicYear: jest.fn(async (academicYearId: string) => {
      return store.filter(
        (s) => s.academicYearId === academicYearId && s.deletedAt === null,
      );
    }),
    create: jest.fn(async (data: Partial<SemesterEntity>) => {
      const entity = {
        id: createId(),
        ...data,
        createdAt: new Date(),
        updatedAt: new Date(),
        deletedAt: null,
      } as SemesterEntity;
      store.push(entity);
      return entity;
    }),
    _store: store,
    _seed: (data: Partial<SemesterEntity>) => {
      const entity = {
        id: data.id ?? createId(),
        ...data,
        createdAt: new Date(),
        updatedAt: new Date(),
        deletedAt: null,
      } as SemesterEntity;
      store.push(entity);
      return entity;
    },
  };
}

function createInMemorySessionRepository() {
  const store: SessionEntity[] = [];

  return {
    findAll: jest.fn(
      async (
        query: { campusId?: string; gradeLevel?: GradeLevel },
        schoolId: string,
      ) => {
        let filtered = store.filter(
          (s) => s.schoolId === schoolId && s.deletedAt === null,
        );
        if (query.campusId)
          filtered = filtered.filter((s) => s.campusId === query.campusId);
        if (query.gradeLevel)
          filtered = filtered.filter((s) => s.gradeLevel === query.gradeLevel);
        return [filtered, filtered.length] as [SessionEntity[], number];
      },
    ),
    findById: jest.fn(async (id: string, schoolId?: string) => {
      return (
        store.find(
          (s) =>
            s.id === id &&
            s.deletedAt === null &&
            (!schoolId || s.schoolId === schoolId),
        ) ?? null
      );
    }),
    findBySchool: jest.fn(async (schoolId: string) => {
      return store.filter(
        (s) => s.schoolId === schoolId && s.deletedAt === null,
      );
    }),
    create: jest.fn(async (data: Partial<SessionEntity>) => {
      const entity = {
        id: createId(),
        schoolId: data.schoolId!,
        campusId: data.campusId!,
        gradeLevel: data.gradeLevel!,
        name: data.name!,
        startTime: data.startTime!,
        endTime: data.endTime!,
        sortOrder: data.sortOrder ?? 0,
        createdAt: new Date(),
        updatedAt: new Date(),
        deletedAt: null,
      } as SessionEntity;
      store.push(entity);
      return entity;
    }),
    update: jest.fn(async (id: string, data: Partial<SessionEntity>) => {
      const session = store.find((s) => s.id === id);
      if (session) Object.assign(session, data);
      return session ?? null;
    }),
    softDelete: jest.fn(async (id: string) => {
      const record = store.find((r) => r.id === id);
      if (record) record.deletedAt = new Date();
    }),
    _store: store,
  };
}

function createInMemoryAcademicYearRepository() {
  const store: AcademicYearEntity[] = [];

  return {
    findById: jest.fn(async (id: string) => {
      return store.find((ay) => ay.id === id && ay.deletedAt === null) ?? null;
    }),
    findBySchool: jest.fn(async (schoolId: string) => {
      return store.filter(
        (ay) => ay.schoolId === schoolId && ay.deletedAt === null,
      );
    }),
    findOverlapping: jest.fn(
      async (
        schoolId: string,
        startDate: string,
        endDate: string,
        excludeId?: string,
      ) => {
        return store.filter(
          (ay) =>
            ay.schoolId === schoolId &&
            ay.deletedAt === null &&
            ay.startDate < endDate &&
            ay.endDate > startDate &&
            ay.id !== excludeId,
        );
      },
    ),
    create: jest.fn(async (data: Partial<AcademicYearEntity>) => {
      const entity = {
        id: createId(),
        schoolId: data.schoolId!,
        name: data.name!,
        startDate: data.startDate!,
        endDate: data.endDate!,
        isCurrent: data.isCurrent ?? false,
        status: data.status ?? AcademicStatus.PLANNING,
        createdAt: new Date(),
        updatedAt: new Date(),
        deletedAt: null,
      } as AcademicYearEntity;
      store.push(entity);
      return entity;
    }),
    createWithTransaction: jest.fn(
      async (data: Partial<AcademicYearEntity>) => {
        if (data.isCurrent) {
          store
            .filter(
              (ay) =>
                ay.schoolId === data.schoolId &&
                ay.isCurrent &&
                ay.deletedAt === null,
            )
            .forEach((ay) => (ay.isCurrent = false));
        }
        const entity = {
          id: createId(),
          schoolId: data.schoolId!,
          name: data.name!,
          startDate: data.startDate!,
          endDate: data.endDate!,
          isCurrent: data.isCurrent ?? false,
          status: data.status ?? AcademicStatus.PLANNING,
          createdAt: new Date(),
          updatedAt: new Date(),
          deletedAt: null,
        } as AcademicYearEntity;
        store.push(entity);
        return entity;
      },
    ),
    update: jest.fn(async (id: string, data: Partial<AcademicYearEntity>) => {
      const entity = store.find((ay) => ay.id === id && ay.deletedAt === null);
      if (!entity) return null;
      Object.assign(entity, data);
      return entity;
    }),
    softDelete: jest.fn(async (id: string) => {
      const record = store.find((r) => r.id === id);
      if (record) record.deletedAt = new Date();
    }),
    _store: store,
    _seed: (data: Partial<AcademicYearEntity>) => {
      const entity = {
        id: data.id ?? createId(),
        ...data,
        createdAt: new Date(),
        updatedAt: new Date(),
        deletedAt: null,
      } as AcademicYearEntity;
      store.push(entity);
      return entity;
    },
  };
}

function createMockDataSource(weekStore: WeekEntity[]) {
  return {
    transaction: jest.fn(
      async (cb: (manager: EntityManager) => Promise<unknown>) => {
        const mockManager = {
          getRepository: () => ({
            create: (data: Partial<WeekEntity>[]) =>
              data.map((d) => ({
                id: createId(),
                ...d,
                createdAt: new Date(),
                updatedAt: new Date(),
                deletedAt: null,
              })),
            save: (entities: WeekEntity[]) => {
              for (const e of entities) {
                if (!e.id) e.id = createId();
                weekStore.push(e);
              }
              return entities;
            },
          }),
          update: jest.fn(
            async (entity: unknown, id: string, data: Partial<WeekEntity>) => {
              const week = weekStore.find((w) => w.id === id);
              if (week) Object.assign(week, data);
            },
          ),
          createQueryBuilder: () => ({
            update: () => ({
              set: () => ({
                where: () => ({
                  andWhere: () => ({
                    execute: jest.fn(),
                  }),
                  execute: jest.fn(),
                }),
              }),
            }),
          }),
        } as unknown as EntityManager;
        return cb(mockManager);
      },
    ),
  } as unknown as DataSource;
}

function createMockDataSourceForAcademicYear(store: AcademicYearEntity[]) {
  let callCount = 0;
  return {
    transaction: jest.fn(
      async (cb: (manager: EntityManager) => Promise<unknown>) => {
        callCount = 0;
        const mockManager = {
          createQueryBuilder: () => {
            callCount++;
            const currentCall = callCount;
            let setData: Partial<AcademicYearEntity> = {};
            let whereParams: Record<string, unknown> = {};

            const executeHandler = () => {
              if (currentCall === 1) {
                // First call: unset isCurrent for school
                store
                  .filter(
                    (ay) =>
                      ay.schoolId === whereParams.schoolId &&
                      ay.isCurrent === true &&
                      ay.deletedAt === null,
                  )
                  .forEach((ay) => Object.assign(ay, setData));
              } else {
                // Second call: set isCurrent for the specific id
                const target = store.find((ay) => ay.id === whereParams.id);
                if (target) Object.assign(target, setData);
              }
            };

            const chainObj: Record<string, unknown> = {
              execute: executeHandler,
              andWhere: () => chainObj,
            };

            return {
              update: () => ({
                set: (data: Partial<AcademicYearEntity>) => {
                  setData = data;
                  return {
                    where: (
                      _condition: string,
                      params: Record<string, unknown>,
                    ) => {
                      whereParams = { ...whereParams, ...params };
                      return chainObj;
                    },
                  };
                },
              }),
            };
          },
        } as unknown as EntityManager;
        return cb(mockManager);
      },
    ),
  } as unknown as DataSource;
}

// ============================================================
// Test Constants
// ============================================================

const SCHOOL_A_ID = 'school-a-uuid';
const SCHOOL_B_ID = 'school-b-uuid';
const CAMPUS_1_ID = 'campus-1-uuid';
const CAMPUS_2_ID = 'campus-2-uuid';
const SEMESTER_1_ID = 'semester-1-uuid';

// ============================================================
// Integration Tests
// ============================================================

describe('Academic Structure - Integration Tests', () => {
  // =========================================================
  // 1. CampusGradeLevel CRUD Flow
  // =========================================================
  describe('CampusGradeLevel CRUD Flow', () => {
    let service: CampusGradeLevelService;
    let cglRepo: ReturnType<typeof createInMemoryCampusGradeLevelRepository>;

    beforeEach(() => {
      cglRepo = createInMemoryCampusGradeLevelRepository();
      service = new CampusGradeLevelService(
        cglRepo as unknown as CampusGradeLevelRepository,
      );
    });

    it('should assign a grade level to a campus', async () => {
      const result = await service.assign(
        { campusId: CAMPUS_1_ID, gradeLevel: GradeLevel.PRIMARY },
        SCHOOL_A_ID,
      );

      expect(result.campusId).toBe(CAMPUS_1_ID);
      expect(result.gradeLevel).toBe(GradeLevel.PRIMARY);
      expect(result.schoolId).toBe(SCHOOL_A_ID);
      expect(result.id).toBeDefined();
    });

    it('should reject duplicate campus-grade-level assignment', async () => {
      await service.assign(
        { campusId: CAMPUS_1_ID, gradeLevel: GradeLevel.PRIMARY },
        SCHOOL_A_ID,
      );

      await expect(
        service.assign(
          { campusId: CAMPUS_1_ID, gradeLevel: GradeLevel.PRIMARY },
          SCHOOL_A_ID,
        ),
      ).rejects.toThrow(CampusGradeLevelExistsException);
    });

    it('should allow same grade level on different campuses', async () => {
      const r1 = await service.assign(
        { campusId: CAMPUS_1_ID, gradeLevel: GradeLevel.PRIMARY },
        SCHOOL_A_ID,
      );
      const r2 = await service.assign(
        { campusId: CAMPUS_2_ID, gradeLevel: GradeLevel.PRIMARY },
        SCHOOL_A_ID,
      );

      expect(r1.id).not.toBe(r2.id);
    });

    it('should query by campus and return all grade levels', async () => {
      await service.assign(
        { campusId: CAMPUS_1_ID, gradeLevel: GradeLevel.PRIMARY },
        SCHOOL_A_ID,
      );
      await service.assign(
        { campusId: CAMPUS_1_ID, gradeLevel: GradeLevel.MIDDLE_SCHOOL },
        SCHOOL_A_ID,
      );
      await service.assign(
        { campusId: CAMPUS_2_ID, gradeLevel: GradeLevel.HIGH_SCHOOL },
        SCHOOL_A_ID,
      );

      const results = await service.findByCampus(CAMPUS_1_ID, SCHOOL_A_ID);
      expect(results).toHaveLength(2);
      expect(results.map((r) => r.gradeLevel).sort()).toEqual([
        GradeLevel.MIDDLE_SCHOOL,
        GradeLevel.PRIMARY,
      ]);
    });

    it('should query by grade level and return all campuses', async () => {
      await service.assign(
        { campusId: CAMPUS_1_ID, gradeLevel: GradeLevel.PRIMARY },
        SCHOOL_A_ID,
      );
      await service.assign(
        { campusId: CAMPUS_2_ID, gradeLevel: GradeLevel.PRIMARY },
        SCHOOL_A_ID,
      );

      const results = await service.findByGradeLevel(
        GradeLevel.PRIMARY,
        SCHOOL_A_ID,
      );
      expect(results).toHaveLength(2);
      expect(results.map((r) => r.campusId).sort()).toEqual([
        CAMPUS_1_ID,
        CAMPUS_2_ID,
      ]);
    });

    it('should soft-delete and hide from queries', async () => {
      const record = await service.assign(
        { campusId: CAMPUS_1_ID, gradeLevel: GradeLevel.PRIMARY },
        SCHOOL_A_ID,
      );

      await service.remove(record.id, SCHOOL_A_ID);

      const results = await service.findByCampus(CAMPUS_1_ID, SCHOOL_A_ID);
      expect(results).toHaveLength(0);
    });

    it('should throw CampusGradeLevelNotFoundException when removing non-existent record', async () => {
      await expect(
        service.remove('non-existent-id', SCHOOL_A_ID),
      ).rejects.toThrow(CampusGradeLevelNotFoundException);
    });
  });

  // =========================================================
  // 2. Week Creation with Validation
  // =========================================================
  describe('Week Creation with Validation', () => {
    let service: WeekService;
    let weekRepo: ReturnType<typeof createInMemoryWeekRepository>;
    let semesterRepo: ReturnType<typeof createInMemorySemesterRepository>;
    let mockDataSource: DataSource;

    beforeEach(() => {
      weekRepo = createInMemoryWeekRepository();
      semesterRepo = createInMemorySemesterRepository();
      mockDataSource = createMockDataSource(weekRepo._store);

      // Seed a semester: 2024-09-02 to 2024-12-29
      semesterRepo._seed({
        id: SEMESTER_1_ID,
        academicYearId: 'ay-uuid',
        name: 'Học kỳ 1',
        semesterNumber: 1,
        startDate: '2024-09-02',
        endDate: '2024-12-29',
        status: AcademicStatus.PLANNING,
      });

      service = new WeekService(
        weekRepo as unknown as WeekRepository,
        semesterRepo as unknown as SemesterRepository,
        mockDataSource,
      );
    });

    it('should create a week with valid date range', async () => {
      const week = await service.create(
        {
          semesterId: SEMESTER_1_ID,
          startDate: '2024-09-02',
          endDate: '2024-09-08',
          weekType: WeekType.REGULAR,
        },
        SCHOOL_A_ID,
      );

      expect(week.startDate).toBe('2024-09-02');
      expect(week.endDate).toBe('2024-09-08');
      expect(week.weekType).toBe(WeekType.REGULAR);
      expect(week.weekNumber).toBe(1);
    });

    it('should reject week with start_date > end_date (invalid date range)', async () => {
      await expect(
        service.create(
          {
            semesterId: SEMESTER_1_ID,
            startDate: '2024-09-10',
            endDate: '2024-09-05',
          },
          SCHOOL_A_ID,
        ),
      ).rejects.toThrow(InvalidDateRangeException);
    });

    it('should reject week outside semester date range', async () => {
      await expect(
        service.create(
          {
            semesterId: SEMESTER_1_ID,
            startDate: '2024-08-25',
            endDate: '2024-09-01',
          },
          SCHOOL_A_ID,
        ),
      ).rejects.toThrow(WeekOutOfRangeException);
    });

    it('should reject week extending beyond semester end', async () => {
      await expect(
        service.create(
          {
            semesterId: SEMESTER_1_ID,
            startDate: '2024-12-25',
            endDate: '2025-01-05',
          },
          SCHOOL_A_ID,
        ),
      ).rejects.toThrow(WeekOutOfRangeException);
    });

    it('should reject overlapping weeks in same semester', async () => {
      await service.create(
        {
          semesterId: SEMESTER_1_ID,
          startDate: '2024-09-02',
          endDate: '2024-09-08',
        },
        SCHOOL_A_ID,
      );

      await expect(
        service.create(
          {
            semesterId: SEMESTER_1_ID,
            startDate: '2024-09-05',
            endDate: '2024-09-11',
          },
          SCHOOL_A_ID,
        ),
      ).rejects.toThrow(WeekOverlapException);
    });

    it('should allow adjacent non-overlapping weeks', async () => {
      await service.create(
        {
          semesterId: SEMESTER_1_ID,
          startDate: '2024-09-02',
          endDate: '2024-09-08',
        },
        SCHOOL_A_ID,
      );

      const week2 = await service.create(
        {
          semesterId: SEMESTER_1_ID,
          startDate: '2024-09-09',
          endDate: '2024-09-15',
        },
        SCHOOL_A_ID,
      );

      expect(week2.weekNumber).toBe(2);
    });

    it('should auto-assign sequential week_number', async () => {
      const w1 = await service.create(
        {
          semesterId: SEMESTER_1_ID,
          startDate: '2024-09-02',
          endDate: '2024-09-08',
        },
        SCHOOL_A_ID,
      );
      const w2 = await service.create(
        {
          semesterId: SEMESTER_1_ID,
          startDate: '2024-09-09',
          endDate: '2024-09-15',
        },
        SCHOOL_A_ID,
      );
      const w3 = await service.create(
        {
          semesterId: SEMESTER_1_ID,
          startDate: '2024-09-16',
          endDate: '2024-09-22',
        },
        SCHOOL_A_ID,
      );

      expect(w1.weekNumber).toBe(1);
      expect(w2.weekNumber).toBe(2);
      expect(w3.weekNumber).toBe(3);
    });

    it('should throw NotFoundException for non-existent semester', async () => {
      await expect(
        service.create(
          {
            semesterId: 'non-existent-semester',
            startDate: '2024-09-02',
            endDate: '2024-09-08',
          },
          SCHOOL_A_ID,
        ),
      ).rejects.toThrow(NotFoundException);
    });
  });

  // =========================================================
  // 3. Bulk Week Generation End-to-End
  // =========================================================
  describe('Bulk Week Generation End-to-End', () => {
    let service: WeekService;
    let weekRepo: ReturnType<typeof createInMemoryWeekRepository>;
    let semesterRepo: ReturnType<typeof createInMemorySemesterRepository>;
    let mockDataSource: DataSource;

    beforeEach(() => {
      weekRepo = createInMemoryWeekRepository();
      semesterRepo = createInMemorySemesterRepository();
      mockDataSource = createMockDataSource(weekRepo._store);

      // Seed: semester from Monday 2024-09-02 to Sunday 2024-10-13 (6 weeks)
      semesterRepo._seed({
        id: SEMESTER_1_ID,
        academicYearId: 'ay-uuid',
        name: 'Học kỳ 1',
        semesterNumber: 1,
        startDate: '2024-09-02',
        endDate: '2024-10-13',
        status: AcademicStatus.PLANNING,
      });

      service = new WeekService(
        weekRepo as unknown as WeekRepository,
        semesterRepo as unknown as SemesterRepository,
        mockDataSource,
      );
    });

    it('should generate weeks covering the full semester', async () => {
      const result = await service.bulkGenerate(SEMESTER_1_ID, SCHOOL_A_ID);

      expect(result.count).toBe(6);
      expect(result.weeks).toHaveLength(6);
      // First week starts on semester start
      expect(result.weeks[0].startDate).toBe('2024-09-02');
      // Last week ends on semester end
      expect(result.weeks[result.count - 1].endDate).toBe('2024-10-13');
    });

    it('should assign sequential week numbers starting from 1', async () => {
      const result = await service.bulkGenerate(SEMESTER_1_ID, SCHOOL_A_ID);

      for (let i = 0; i < result.count; i++) {
        expect(result.weeks[i].weekNumber).toBe(i + 1);
      }
    });

    it('should set all generated weeks to week_type regular', async () => {
      const result = await service.bulkGenerate(SEMESTER_1_ID, SCHOOL_A_ID);

      for (const week of result.weeks) {
        expect(week.weekType).toBe(WeekType.REGULAR);
      }
    });

    it('should reject bulk generation when weeks already exist', async () => {
      // First generation succeeds
      await service.bulkGenerate(SEMESTER_1_ID, SCHOOL_A_ID);

      // Second generation fails
      await expect(
        service.bulkGenerate(SEMESTER_1_ID, SCHOOL_A_ID),
      ).rejects.toThrow(BulkGenerationConflictException);
    });

    it('should handle semester starting mid-week (first week shorter)', async () => {
      // Semester starts on Wednesday 2024-09-04
      const midWeekSemesterId = 'mid-week-sem-uuid';
      semesterRepo._seed({
        id: midWeekSemesterId,
        academicYearId: 'ay-uuid',
        name: 'HK mid-week',
        semesterNumber: 2,
        startDate: '2024-09-04',
        endDate: '2024-09-22',
        status: AcademicStatus.PLANNING,
      });

      const result = await service.bulkGenerate(midWeekSemesterId, SCHOOL_A_ID);

      // First week: Wed 2024-09-04 to Sun 2024-09-08
      expect(result.weeks[0].startDate).toBe('2024-09-04');
      expect(result.weeks[0].endDate).toBe('2024-09-08');
      // Second week: Mon 2024-09-09 to Sun 2024-09-15
      expect(result.weeks[1].startDate).toBe('2024-09-09');
      expect(result.weeks[1].endDate).toBe('2024-09-15');
    });

    it('should throw NotFoundException for non-existent semester', async () => {
      await expect(
        service.bulkGenerate('non-existent-semester', SCHOOL_A_ID),
      ).rejects.toThrow(NotFoundException);
    });
  });

  // =========================================================
  // 4. Session Creation with Campus-Grade-Level Validation
  // =========================================================
  describe('Session Creation with Campus-Grade-Level Validation', () => {
    let sessionService: SessionService;
    let sessionRepo: ReturnType<typeof createInMemorySessionRepository>;
    let cglRepo: ReturnType<typeof createInMemoryCampusGradeLevelRepository>;

    beforeEach(() => {
      sessionRepo = createInMemorySessionRepository();
      cglRepo = createInMemoryCampusGradeLevelRepository();

      sessionService = new SessionService(
        sessionRepo as unknown as SessionRepository,
        cglRepo as unknown as CampusGradeLevelRepository,
      );
    });

    it('should create session when campus-grade-level pair exists', async () => {
      // Setup: assign grade level to campus
      cglRepo._store.push({
        id: createId(),
        campusId: CAMPUS_1_ID,
        schoolId: SCHOOL_A_ID,
        gradeLevel: GradeLevel.PRIMARY,
        createdAt: new Date(),
        updatedAt: new Date(),
        deletedAt: null,
      } as CampusGradeLevelEntity);

      const session = await sessionService.create(
        {
          campusId: CAMPUS_1_ID,
          gradeLevel: GradeLevel.PRIMARY,
          name: 'Ca sáng',
          startTime: '07:00',
          endTime: '11:30',
          sortOrder: 1,
        },
        SCHOOL_A_ID,
      );

      expect(session.campusId).toBe(CAMPUS_1_ID);
      expect(session.gradeLevel).toBe(GradeLevel.PRIMARY);
      expect(session.name).toBe('Ca sáng');
      expect(session.schoolId).toBe(SCHOOL_A_ID);
    });

    it('should reject session when campus-grade-level pair does not exist', async () => {
      await expect(
        sessionService.create(
          {
            campusId: CAMPUS_1_ID,
            gradeLevel: GradeLevel.HIGH_SCHOOL,
            name: 'Ca chiều',
            startTime: '13:00',
            endTime: '17:00',
          },
          SCHOOL_A_ID,
        ),
      ).rejects.toThrow(CampusGradeLevelNotFoundException);
    });

    it('should reject session with startTime >= endTime', async () => {
      cglRepo._store.push({
        id: createId(),
        campusId: CAMPUS_1_ID,
        schoolId: SCHOOL_A_ID,
        gradeLevel: GradeLevel.PRIMARY,
        createdAt: new Date(),
        updatedAt: new Date(),
        deletedAt: null,
      } as CampusGradeLevelEntity);

      await expect(
        sessionService.create(
          {
            campusId: CAMPUS_1_ID,
            gradeLevel: GradeLevel.PRIMARY,
            name: 'Invalid session',
            startTime: '14:00',
            endTime: '12:00',
          },
          SCHOOL_A_ID,
        ),
      ).rejects.toThrow('Giờ bắt đầu phải trước giờ kết thúc');
    });

    it('should create multiple sessions for different grade levels at same campus', async () => {
      // Setup both CGL entries
      cglRepo._store.push(
        {
          id: createId(),
          campusId: CAMPUS_1_ID,
          schoolId: SCHOOL_A_ID,
          gradeLevel: GradeLevel.PRIMARY,
          createdAt: new Date(),
          updatedAt: new Date(),
          deletedAt: null,
        } as CampusGradeLevelEntity,
        {
          id: createId(),
          campusId: CAMPUS_1_ID,
          schoolId: SCHOOL_A_ID,
          gradeLevel: GradeLevel.MIDDLE_SCHOOL,
          createdAt: new Date(),
          updatedAt: new Date(),
          deletedAt: null,
        } as CampusGradeLevelEntity,
      );

      const s1 = await sessionService.create(
        {
          campusId: CAMPUS_1_ID,
          gradeLevel: GradeLevel.PRIMARY,
          name: 'Ca sáng TH',
          startTime: '07:00',
          endTime: '11:00',
        },
        SCHOOL_A_ID,
      );
      const s2 = await sessionService.create(
        {
          campusId: CAMPUS_1_ID,
          gradeLevel: GradeLevel.MIDDLE_SCHOOL,
          name: 'Ca sáng THCS',
          startTime: '07:00',
          endTime: '11:30',
        },
        SCHOOL_A_ID,
      );

      expect(s1.gradeLevel).toBe(GradeLevel.PRIMARY);
      expect(s2.gradeLevel).toBe(GradeLevel.MIDDLE_SCHOOL);
    });
  });

  // =========================================================
  // 5. Academic Year setCurrent and Status Transition
  // =========================================================
  describe('Academic Year setCurrent and Status Transition', () => {
    let service: AcademicYearService;
    let ayRepo: ReturnType<typeof createInMemoryAcademicYearRepository>;
    let mockDataSource: DataSource;

    beforeEach(() => {
      ayRepo = createInMemoryAcademicYearRepository();
      mockDataSource = createMockDataSourceForAcademicYear(ayRepo._store);

      service = new AcademicYearService(
        ayRepo as unknown as AcademicYearRepository,
        mockDataSource,
      );
    });

    describe('setCurrent', () => {
      it('should set an academic year as current', async () => {
        const ay = ayRepo._seed({
          schoolId: SCHOOL_A_ID,
          name: '2024-2025',
          startDate: '2024-09-01',
          endDate: '2025-06-30',
          isCurrent: false,
          status: AcademicStatus.PLANNING,
        });

        const result = await service.setCurrent(ay.id, SCHOOL_A_ID);
        expect(result).toBeDefined();
      });

      it('should unset previous current when setting new current', async () => {
        const ay1 = ayRepo._seed({
          schoolId: SCHOOL_A_ID,
          name: '2023-2024',
          startDate: '2023-09-01',
          endDate: '2024-06-30',
          isCurrent: true,
          status: AcademicStatus.COMPLETED,
        });
        const ay2 = ayRepo._seed({
          schoolId: SCHOOL_A_ID,
          name: '2024-2025',
          startDate: '2024-09-01',
          endDate: '2025-06-30',
          isCurrent: false,
          status: AcademicStatus.PLANNING,
        });

        await service.setCurrent(ay2.id, SCHOOL_A_ID);

        // After transaction, ay1 should no longer be current
        const ay1After = ayRepo._store.find((ay) => ay.id === ay1.id);
        expect(ay1After!.isCurrent).toBe(false);
      });

      it('should throw NotFoundException for non-existent academic year', async () => {
        await expect(
          service.setCurrent('non-existent-id', SCHOOL_A_ID),
        ).rejects.toThrow(NotFoundException);
      });

      it('should throw NotFoundException when accessing another school academic year', async () => {
        const ay = ayRepo._seed({
          schoolId: SCHOOL_B_ID,
          name: '2024-2025',
          startDate: '2024-09-01',
          endDate: '2025-06-30',
          isCurrent: false,
          status: AcademicStatus.PLANNING,
        });

        await expect(service.setCurrent(ay.id, SCHOOL_A_ID)).rejects.toThrow(
          NotFoundException,
        );
      });
    });

    describe('transitionStatus', () => {
      it('should transition from planning to active', async () => {
        const ay = ayRepo._seed({
          schoolId: SCHOOL_A_ID,
          name: '2024-2025',
          startDate: '2024-09-01',
          endDate: '2025-06-30',
          isCurrent: false,
          status: AcademicStatus.PLANNING,
        });

        const result = await service.transitionStatus(
          ay.id,
          AcademicStatus.ACTIVE,
          SCHOOL_A_ID,
        );
        expect(result.status).toBe(AcademicStatus.ACTIVE);
      });

      it('should transition from active to completed', async () => {
        const ay = ayRepo._seed({
          schoolId: SCHOOL_A_ID,
          name: '2024-2025',
          startDate: '2024-09-01',
          endDate: '2025-06-30',
          isCurrent: false,
          status: AcademicStatus.ACTIVE,
        });

        const result = await service.transitionStatus(
          ay.id,
          AcademicStatus.COMPLETED,
          SCHOOL_A_ID,
        );
        expect(result.status).toBe(AcademicStatus.COMPLETED);
      });

      it('should reject invalid transition: planning → completed', async () => {
        const ay = ayRepo._seed({
          schoolId: SCHOOL_A_ID,
          name: '2024-2025',
          startDate: '2024-09-01',
          endDate: '2025-06-30',
          isCurrent: false,
          status: AcademicStatus.PLANNING,
        });

        await expect(
          service.transitionStatus(
            ay.id,
            AcademicStatus.COMPLETED,
            SCHOOL_A_ID,
          ),
        ).rejects.toThrow(InvalidStatusTransitionException);
      });

      it('should reject invalid transition: active → planning', async () => {
        const ay = ayRepo._seed({
          schoolId: SCHOOL_A_ID,
          name: '2024-2025',
          startDate: '2024-09-01',
          endDate: '2025-06-30',
          isCurrent: false,
          status: AcademicStatus.ACTIVE,
        });

        await expect(
          service.transitionStatus(ay.id, AcademicStatus.PLANNING, SCHOOL_A_ID),
        ).rejects.toThrow(InvalidStatusTransitionException);
      });

      it('should reject invalid transition: completed → active', async () => {
        const ay = ayRepo._seed({
          schoolId: SCHOOL_A_ID,
          name: '2024-2025',
          startDate: '2024-09-01',
          endDate: '2025-06-30',
          isCurrent: false,
          status: AcademicStatus.COMPLETED,
        });

        await expect(
          service.transitionStatus(ay.id, AcademicStatus.ACTIVE, SCHOOL_A_ID),
        ).rejects.toThrow(InvalidStatusTransitionException);
      });

      it('should reject transition for non-existent academic year', async () => {
        await expect(
          service.transitionStatus(
            'non-existent-id',
            AcademicStatus.ACTIVE,
            SCHOOL_A_ID,
          ),
        ).rejects.toThrow(NotFoundException);
      });
    });
  });

  // =========================================================
  // 6. Multi-Tenant Isolation
  // =========================================================
  describe('Multi-Tenant Data Isolation', () => {
    describe('CampusGradeLevel isolation', () => {
      let service: CampusGradeLevelService;
      let cglRepo: ReturnType<typeof createInMemoryCampusGradeLevelRepository>;

      beforeEach(() => {
        cglRepo = createInMemoryCampusGradeLevelRepository();
        service = new CampusGradeLevelService(
          cglRepo as unknown as CampusGradeLevelRepository,
        );
      });

      it('school A cannot see school B campus-grade-level records', async () => {
        // School B assigns
        await service.assign(
          { campusId: CAMPUS_1_ID, gradeLevel: GradeLevel.PRIMARY },
          SCHOOL_B_ID,
        );

        // School A queries the same campus
        const results = await service.findByCampus(CAMPUS_1_ID, SCHOOL_A_ID);
        expect(results).toHaveLength(0);
      });

      it('school A cannot remove school B records', async () => {
        const record = await service.assign(
          { campusId: CAMPUS_1_ID, gradeLevel: GradeLevel.PRIMARY },
          SCHOOL_B_ID,
        );

        await expect(service.remove(record.id, SCHOOL_A_ID)).rejects.toThrow(
          CampusGradeLevelNotFoundException,
        );
      });

      it('each school sees only its own data when querying by grade level', async () => {
        await service.assign(
          { campusId: CAMPUS_1_ID, gradeLevel: GradeLevel.PRIMARY },
          SCHOOL_A_ID,
        );
        await service.assign(
          { campusId: CAMPUS_2_ID, gradeLevel: GradeLevel.PRIMARY },
          SCHOOL_B_ID,
        );

        const schoolAResults = await service.findByGradeLevel(
          GradeLevel.PRIMARY,
          SCHOOL_A_ID,
        );
        const schoolBResults = await service.findByGradeLevel(
          GradeLevel.PRIMARY,
          SCHOOL_B_ID,
        );

        expect(schoolAResults).toHaveLength(1);
        expect(schoolAResults[0].campusId).toBe(CAMPUS_1_ID);
        expect(schoolBResults).toHaveLength(1);
        expect(schoolBResults[0].campusId).toBe(CAMPUS_2_ID);
      });
    });

    describe('Session isolation', () => {
      let sessionService: SessionService;
      let sessionRepo: ReturnType<typeof createInMemorySessionRepository>;
      let cglRepo: ReturnType<typeof createInMemoryCampusGradeLevelRepository>;

      beforeEach(() => {
        sessionRepo = createInMemorySessionRepository();
        cglRepo = createInMemoryCampusGradeLevelRepository();
        sessionService = new SessionService(
          sessionRepo as unknown as SessionRepository,
          cglRepo as unknown as CampusGradeLevelRepository,
        );

        // Setup CGL for both schools
        cglRepo._store.push(
          {
            id: createId(),
            campusId: CAMPUS_1_ID,
            schoolId: SCHOOL_A_ID,
            gradeLevel: GradeLevel.PRIMARY,
            createdAt: new Date(),
            updatedAt: new Date(),
            deletedAt: null,
          } as CampusGradeLevelEntity,
          {
            id: createId(),
            campusId: CAMPUS_1_ID,
            schoolId: SCHOOL_B_ID,
            gradeLevel: GradeLevel.PRIMARY,
            createdAt: new Date(),
            updatedAt: new Date(),
            deletedAt: null,
          } as CampusGradeLevelEntity,
        );
      });

      it('school A cannot access school B sessions', async () => {
        // School B creates a session
        await sessionService.create(
          {
            campusId: CAMPUS_1_ID,
            gradeLevel: GradeLevel.PRIMARY,
            name: 'School B session',
            startTime: '07:00',
            endTime: '11:30',
          },
          SCHOOL_B_ID,
        );

        // School A queries sessions
        const [sessions] = await sessionRepo.findAll({}, SCHOOL_A_ID);
        expect(sessions).toHaveLength(0);
      });
    });

    describe('Academic Year isolation', () => {
      let service: AcademicYearService;
      let ayRepo: ReturnType<typeof createInMemoryAcademicYearRepository>;
      let mockDataSource: DataSource;

      beforeEach(() => {
        ayRepo = createInMemoryAcademicYearRepository();
        mockDataSource = createMockDataSourceForAcademicYear(ayRepo._store);
        service = new AcademicYearService(
          ayRepo as unknown as AcademicYearRepository,
          mockDataSource,
        );
      });

      it('school A cannot setCurrent on school B academic year', async () => {
        const ayB = ayRepo._seed({
          schoolId: SCHOOL_B_ID,
          name: '2024-2025',
          startDate: '2024-09-01',
          endDate: '2025-06-30',
          isCurrent: false,
          status: AcademicStatus.PLANNING,
        });

        await expect(service.setCurrent(ayB.id, SCHOOL_A_ID)).rejects.toThrow(
          NotFoundException,
        );
      });

      it('school A cannot transition status on school B academic year', async () => {
        const ayB = ayRepo._seed({
          schoolId: SCHOOL_B_ID,
          name: '2024-2025',
          startDate: '2024-09-01',
          endDate: '2025-06-30',
          isCurrent: false,
          status: AcademicStatus.PLANNING,
        });

        await expect(
          service.transitionStatus(ayB.id, AcademicStatus.ACTIVE, SCHOOL_A_ID),
        ).rejects.toThrow(NotFoundException);
      });

      it('setCurrent for school A does not affect school B current year', async () => {
        const ayA = ayRepo._seed({
          schoolId: SCHOOL_A_ID,
          name: '2024-2025 A',
          startDate: '2024-09-01',
          endDate: '2025-06-30',
          isCurrent: false,
          status: AcademicStatus.PLANNING,
        });
        const ayB = ayRepo._seed({
          schoolId: SCHOOL_B_ID,
          name: '2024-2025 B',
          startDate: '2024-09-01',
          endDate: '2025-06-30',
          isCurrent: true,
          status: AcademicStatus.ACTIVE,
        });

        await service.setCurrent(ayA.id, SCHOOL_A_ID);

        // School B's current year should still be current
        const ayBAfter = ayRepo._store.find((ay) => ay.id === ayB.id);
        expect(ayBAfter!.isCurrent).toBe(true);
      });
    });
  });
});
