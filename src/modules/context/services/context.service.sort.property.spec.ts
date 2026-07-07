import * as fc from 'fast-check';
import { ContextService, ContextJwtUser } from './context.service';
import { UserRole } from '../../../common/enums/role.enum';
import { SchoolStatus } from '../../../common/enums/status.enum';
import { SchoolEntity } from '../../school/entities/school.entity';

// Mock uuid module to avoid ESM issues with Jest
jest.mock('uuid', () => ({
  validate: jest.fn((str: string) => {
    const uuidRegex =
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    return uuidRegex.test(str);
  }),
}));

/**
 * Feature: workspace-context-switcher, Property 6: Alphabetical sort order
 *
 * **Validates: Requirements 1.10**
 *
 * For any accessible schools response containing 2 or more schools, the schools
 * SHALL be sorted by `name` in ascending alphabetical order.
 */
describe('Feature: workspace-context-switcher, Property 6: Alphabetical sort order', () => {
  let service: ContextService;
  let schoolRepository: {
    findById: jest.Mock;
  };
  let schoolEntityRepository: {
    find: jest.Mock;
    createQueryBuilder: jest.Mock;
  };
  let teacherSchoolAssignmentService: {
    getAccessibleSchoolIds: jest.Mock;
  };
  let contextSessionService: {
    setActiveContext: jest.Mock;
    getActiveContext: jest.Mock;
    deleteSession: jest.Mock;
    refreshTtl: jest.Mock;
  };
  let auditLogService: {
    log: jest.Mock;
  };

  // ─── Arbitraries ────────────────────────────────────────────────────────────

  /** Arbitrary: generates a valid UUID v4 string */
  const arbUuid = fc.uuid().map((u) => u.toLowerCase());

  /** Vietnamese diacritical characters used in school names */
  const vietnameseChars = [
    'á', 'à', 'ả', 'ã', 'ạ',
    'ắ', 'ằ', 'ẳ', 'ẵ', 'ặ',
    'đ', 'é', 'è', 'ẻ', 'ẽ', 'ẹ',
    'ế', 'ề', 'ể', 'ễ', 'ệ',
    'í', 'ì', 'ỉ', 'ĩ', 'ị',
    'ó', 'ò', 'ỏ', 'õ', 'ọ',
    'ố', 'ồ', 'ổ', 'ỗ', 'ộ',
    'ớ', 'ờ', 'ở', 'ỡ', 'ợ',
    'ú', 'ù', 'ủ', 'ũ', 'ụ',
    'ứ', 'ừ', 'ử', 'ữ', 'ự',
    'ý', 'ỳ', 'ỷ', 'ỹ', 'ỵ',
  ];

  /**
   * Arbitrary: generates school names with varying lengths and characters,
   * including Vietnamese diacritics for realistic testing.
   */
  const arbVietnameseSchoolName = fc.oneof(
    // Vietnamese school names with diacritics
    fc.constantFrom(
      'Trường TH Á',
      'Trường TH B',
      'Trường TH Nguyễn Bỉnh Khiêm',
      'Trường THCS Đống Đa',
      'Trường THPT Chu Văn An',
      'Trường Mầm Non Ánh Dương',
      'Trường TH Lê Quý Đôn',
      'Trường THCS Trần Phú',
      'Trường Tiểu Học Hoàng Hoa Thám',
      'Trường THPT Nguyễn Trãi',
      'Trường TH Đoàn Thị Điểm',
      'Trường THCS Giảng Võ',
      'Trường TH Quốc Tế',
      'Trường Mầm Non Hồng Hà',
      'Trường TH Thăng Long',
    ),
    // Generated names with Vietnamese diacritical characters
    fc
      .array(fc.constantFrom(...vietnameseChars, 'a', 'b', 'c', 'd', 'e', 'g', 'h', 'i', 'k', 'l', 'm', 'n', 'o', 'p', 'q', 'r', 's', 't', 'u', 'v', 'x', 'y', ' '), { minLength: 1, maxLength: 20 })
      .map((chars) => `Trường ${chars.join('').trim() || 'A'}`),
  );

  /**
   * Arbitrary: generates a non-empty school name with any printable characters.
   */
  const arbSchoolName = fc.oneof(
    arbVietnameseSchoolName,
    fc.string({ minLength: 1, maxLength: 50 }).filter((s) => s.trim().length > 0),
  );

  /**
   * Arbitrary: generates a mock ACTIVE school record with given name.
   */
  const arbActiveSchoolWithName = (name: string, id: string) =>
    ({
      id,
      code: `SC-${id.slice(0, 6)}`,
      name,
      parentSchoolId: null,
      status: SchoolStatus.ACTIVE,
      deletedAt: null,
      address: null,
      phone: null,
      email: null,
      principalName: null,
      parentSchool: null,
      childSchools: [],
    }) as unknown as SchoolEntity;

  // ─── Setup ──────────────────────────────────────────────────────────────────

  beforeEach(() => {
    const mockQueryBuilder = {
      select: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      getRawMany: jest.fn().mockResolvedValue([]),
      getMany: jest.fn().mockResolvedValue([]),
    };

    schoolEntityRepository = {
      find: jest.fn().mockResolvedValue([]),
      createQueryBuilder: jest.fn().mockReturnValue(mockQueryBuilder),
    };

    schoolRepository = {
      findById: jest.fn().mockResolvedValue(null),
    };

    teacherSchoolAssignmentService = {
      getAccessibleSchoolIds: jest.fn().mockResolvedValue([]),
    };

    contextSessionService = {
      setActiveContext: jest.fn(),
      getActiveContext: jest.fn().mockResolvedValue(null),
      deleteSession: jest.fn(),
      refreshTtl: jest.fn(),
    };

    auditLogService = {
      log: jest.fn(),
    };

    service = new ContextService(
      schoolRepository as any,
      schoolEntityRepository as any,
      teacherSchoolAssignmentService as any,
      contextSessionService as any,
      auditLogService as any,
      { emit: jest.fn() } as any,
    );
  });

  // ─── Property 6: Alphabetical sort order ────────────────────────────────────

  it('accessible schools with 2+ entries are sorted by name in ascending order (SUPER_ADMIN)', async () => {
    await fc.assert(
      fc.asyncProperty(
        // Generate 2 to 20 unique school names
        fc
          .array(arbSchoolName, { minLength: 2, maxLength: 20 })
          .map((names) => [...new Set(names)])
          .filter((names) => names.length >= 2),
        // Generate matching UUIDs
        fc.array(arbUuid, { minLength: 20, maxLength: 20 }),
        async (schoolNames, uuids) => {
          // Ensure we have enough unique UUIDs
          const uniqueUuids = [...new Set(uuids)];
          const count = Math.min(schoolNames.length, uniqueUuids.length);
          if (count < 2) return; // Skip degenerate cases

          const names = schoolNames.slice(0, count);
          const ids = uniqueUuids.slice(0, count);

          // Create schools in the generated (random) order
          const schools = names.map((name, i) =>
            arbActiveSchoolWithName(name, ids[i]),
          );

          // SUPER_ADMIN: computeAccessibleSchoolIds returns all active schools
          // Mock schoolEntityRepository.find for computeSuperAdminAccess
          schoolEntityRepository.find.mockResolvedValue(schools);

          // Mock createQueryBuilder for findSchoolIdsWithChildren (none have children)
          schoolEntityRepository.createQueryBuilder.mockReturnValue({
            select: jest.fn().mockReturnThis(),
            where: jest.fn().mockReturnThis(),
            andWhere: jest.fn().mockReturnThis(),
            getRawMany: jest.fn().mockResolvedValue([]),
          });

          const user: ContextJwtUser = {
            id: 'super-admin-user',
            role: UserRole.SUPER_ADMIN,
            schoolId: null,
          };

          const result = await service.getAccessibleSchools(user);

          // Property 6: results must be sorted by name ascending
          expect(result.schools.length).toBeGreaterThanOrEqual(2);
          for (let i = 1; i < result.schools.length; i++) {
            const comparison = result.schools[i - 1].name.localeCompare(
              result.schools[i].name,
            );
            expect(comparison).toBeLessThanOrEqual(0);
          }
        },
      ),
      { numRuns: 100 },
    );
  });

  it('accessible schools with Vietnamese diacritics are sorted by name ascending (TEACHER)', async () => {
    await fc.assert(
      fc.asyncProperty(
        // Generate 2 to 15 Vietnamese school names
        fc
          .array(arbVietnameseSchoolName, { minLength: 2, maxLength: 15 })
          .map((names) => [...new Set(names)])
          .filter((names) => names.length >= 2),
        fc.array(arbUuid, { minLength: 15, maxLength: 15 }),
        arbUuid, // userId
        async (schoolNames, uuids, userId) => {
          const uniqueUuids = [...new Set(uuids)];
          const count = Math.min(schoolNames.length, uniqueUuids.length);
          if (count < 2) return;

          const names = schoolNames.slice(0, count);
          const ids = uniqueUuids.slice(0, count);

          // Create schools in random order
          const schools = names.map((name, i) =>
            arbActiveSchoolWithName(name, ids[i]),
          );

          const user: ContextJwtUser = {
            id: userId,
            role: UserRole.TEACHER,
            schoolId: ids[0],
            accessibleSchoolIds: ids,
          };

          // Mock filterActiveSchoolIds — all schools are active
          schoolEntityRepository.createQueryBuilder.mockReturnValue({
            select: jest.fn().mockReturnThis(),
            where: jest.fn().mockReturnThis(),
            andWhere: jest.fn().mockReturnThis(),
            getMany: jest.fn().mockResolvedValue(schools),
            getRawMany: jest.fn().mockResolvedValue([]),
          });

          // Mock schoolEntityRepository.find for the getAccessibleSchools query
          schoolEntityRepository.find.mockResolvedValue(schools);

          const result = await service.getAccessibleSchools(user);

          // Property 6: results must be sorted by name ascending
          if (result.schools.length >= 2) {
            for (let i = 1; i < result.schools.length; i++) {
              const comparison = result.schools[i - 1].name.localeCompare(
                result.schools[i].name,
              );
              expect(comparison).toBeLessThanOrEqual(0);
            }
          }
        },
      ),
      { numRuns: 100 },
    );
  });

  it('sort order is consistent regardless of input order (shuffled schools)', async () => {
    await fc.assert(
      fc.asyncProperty(
        // Generate fixed set of school names
        fc
          .array(arbSchoolName, { minLength: 3, maxLength: 15 })
          .map((names) => [...new Set(names)])
          .filter((names) => names.length >= 3),
        fc.array(arbUuid, { minLength: 15, maxLength: 15 }),
        // Seed for shuffling
        fc.nat(),
        async (schoolNames, uuids, shuffleSeed) => {
          const uniqueUuids = [...new Set(uuids)];
          const count = Math.min(schoolNames.length, uniqueUuids.length);
          if (count < 3) return;

          const names = schoolNames.slice(0, count);
          const ids = uniqueUuids.slice(0, count);

          // Create schools and shuffle them using seed
          const schools = names.map((name, i) =>
            arbActiveSchoolWithName(name, ids[i]),
          );

          // Deterministic shuffle based on seed
          const shuffled = [...schools].sort(
            (a, b) =>
              ((a.id.charCodeAt(shuffleSeed % a.id.length) + shuffleSeed) % 256) -
              ((b.id.charCodeAt(shuffleSeed % b.id.length) + shuffleSeed) % 256),
          );

          // SUPER_ADMIN with shuffled schools
          schoolEntityRepository.find.mockResolvedValue(shuffled);
          schoolEntityRepository.createQueryBuilder.mockReturnValue({
            select: jest.fn().mockReturnThis(),
            where: jest.fn().mockReturnThis(),
            andWhere: jest.fn().mockReturnThis(),
            getRawMany: jest.fn().mockResolvedValue([]),
          });

          const user: ContextJwtUser = {
            id: 'super-admin-user',
            role: UserRole.SUPER_ADMIN,
            schoolId: null,
          };

          const result = await service.getAccessibleSchools(user);

          // Property 6: output is always sorted by name ascending
          expect(result.schools.length).toBeGreaterThanOrEqual(3);
          for (let i = 1; i < result.schools.length; i++) {
            const comparison = result.schools[i - 1].name.localeCompare(
              result.schools[i].name,
            );
            expect(comparison).toBeLessThanOrEqual(0);
          }

          // Also verify the sort matches what localeCompare would produce
          const expectedOrder = [...result.schools].sort((a, b) =>
            a.name.localeCompare(b.name),
          );
          expect(result.schools.map((s) => s.name)).toEqual(
            expectedOrder.map((s) => s.name),
          );
        },
      ),
      { numRuns: 100 },
    );
  });

  it('sort order is idempotent — sorting already-sorted list produces same result', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc
          .array(arbSchoolName, { minLength: 2, maxLength: 10 })
          .map((names) => [...new Set(names)])
          .filter((names) => names.length >= 2),
        fc.array(arbUuid, { minLength: 10, maxLength: 10 }),
        async (schoolNames, uuids) => {
          const uniqueUuids = [...new Set(uuids)];
          const count = Math.min(schoolNames.length, uniqueUuids.length);
          if (count < 2) return;

          const names = schoolNames.slice(0, count);
          const ids = uniqueUuids.slice(0, count);

          // Pre-sort schools by name (ascending) before passing to the mock
          const schools = names
            .map((name, i) => arbActiveSchoolWithName(name, ids[i]))
            .sort((a, b) => a.name.localeCompare(b.name));

          schoolEntityRepository.find.mockResolvedValue(schools);
          schoolEntityRepository.createQueryBuilder.mockReturnValue({
            select: jest.fn().mockReturnThis(),
            where: jest.fn().mockReturnThis(),
            andWhere: jest.fn().mockReturnThis(),
            getRawMany: jest.fn().mockResolvedValue([]),
          });

          const user: ContextJwtUser = {
            id: 'super-admin-user',
            role: UserRole.SUPER_ADMIN,
            schoolId: null,
          };

          const result = await service.getAccessibleSchools(user);

          // Property: idempotent — already sorted input produces same order
          expect(result.schools.length).toBeGreaterThanOrEqual(2);
          for (let i = 1; i < result.schools.length; i++) {
            const comparison = result.schools[i - 1].name.localeCompare(
              result.schools[i].name,
            );
            expect(comparison).toBeLessThanOrEqual(0);
          }
        },
      ),
      { numRuns: 100 },
    );
  });

  it('reverse-ordered schools are correctly sorted ascending', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc
          .array(arbSchoolName, { minLength: 2, maxLength: 10 })
          .map((names) => [...new Set(names)])
          .filter((names) => names.length >= 2),
        fc.array(arbUuid, { minLength: 10, maxLength: 10 }),
        async (schoolNames, uuids) => {
          const uniqueUuids = [...new Set(uuids)];
          const count = Math.min(schoolNames.length, uniqueUuids.length);
          if (count < 2) return;

          const names = schoolNames.slice(0, count);
          const ids = uniqueUuids.slice(0, count);

          // Reverse-sort schools by name (descending) before passing to the mock
          const schools = names
            .map((name, i) => arbActiveSchoolWithName(name, ids[i]))
            .sort((a, b) => b.name.localeCompare(a.name));

          schoolEntityRepository.find.mockResolvedValue(schools);
          schoolEntityRepository.createQueryBuilder.mockReturnValue({
            select: jest.fn().mockReturnThis(),
            where: jest.fn().mockReturnThis(),
            andWhere: jest.fn().mockReturnThis(),
            getRawMany: jest.fn().mockResolvedValue([]),
          });

          const user: ContextJwtUser = {
            id: 'super-admin-user',
            role: UserRole.SUPER_ADMIN,
            schoolId: null,
          };

          const result = await service.getAccessibleSchools(user);

          // Property: output is always sorted ascending by name
          expect(result.schools.length).toBeGreaterThanOrEqual(2);
          for (let i = 1; i < result.schools.length; i++) {
            const comparison = result.schools[i - 1].name.localeCompare(
              result.schools[i].name,
            );
            expect(comparison).toBeLessThanOrEqual(0);
          }
        },
      ),
      { numRuns: 100 },
    );
  });
});
