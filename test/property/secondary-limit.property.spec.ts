import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException } from '@nestjs/common';
import * as fc from 'fast-check';
import { DataSource, IsNull } from 'typeorm';
import {
  TeacherSchoolAssignmentService,
  FEATURE_FLAG_SERVICE,
  TOKEN_INVALIDATION_SERVICE,
} from '../../src/modules/teacher-school-assignment/teacher-school-assignment.service';
import { TeacherSchoolAssignmentRepository } from '../../src/modules/teacher-school-assignment/teacher-school-assignment.repository';
import { SchoolRepository } from '../../src/modules/school/school.repository';
import { AssignmentRole } from '../../src/modules/teacher-school-assignment/enums/assignment-role.enum';
import { AssignmentStatus } from '../../src/modules/teacher-school-assignment/enums/assignment-status.enum';
import { TeacherSchoolAssignmentEntity } from '../../src/modules/teacher-school-assignment/entities/teacher-school-assignment.entity';

/**
 * Property-Based Tests for Secondary Assignment Limit
 *
 * Property 3: Secondary Assignment Limit
 * For any teacher, the number of active Teacher_School_Assignments with role
 * "secondary" SHALL never exceed 5. The 6th creation attempt SHALL be rejected.
 *
 * Feature: cross-campus-teaching
 * Testing Framework: fast-check
 * Minimum Iterations: 100 per property
 *
 * **Validates: Requirements 1.6**
 */

// --- Constants ---
const MAX_SECONDARY_ASSIGNMENTS = 5;

// --- Custom Arbitraries ---

const uuidArb = fc.uuid({ version: 4 });

/** Generate a count of existing secondary assignments between 0 and 6 */
const existingSecondaryCountArb = fc.integer({ min: 0, max: 6 });

/** Generate a valid date string in YYYY-MM-DD format */
const dateStringArb = fc
  .tuple(
    fc.integer({ min: 2024, max: 2026 }),
    fc.integer({ min: 1, max: 12 }),
    fc.integer({ min: 1, max: 28 }),
  )
  .map(
    ([y, m, d]) =>
      `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`,
  );

// --- Helper Functions ---

function createMockSchool(id: string, parentSchoolId: string | null) {
  return {
    id,
    code: `SCHOOL-${id.slice(0, 4)}`,
    name: `School ${id.slice(0, 4)}`,
    address: null,
    phone: null,
    email: null,
    principalName: null,
    parentSchoolId,
    parentSchool: null,
    childSchools: [],
    status: 'active',
    createdAt: new Date(),
    updatedAt: new Date(),
    deletedAt: null,
  };
}

function createMockTeacher(id: string, schoolId: string) {
  return {
    id,
    schoolId,
    employeeCode: `EMP-${id.slice(0, 4)}`,
    fullName: `Teacher ${id.slice(0, 4)}`,
    deletedAt: null,
  };
}

describe('Feature: cross-campus-teaching | Property 3: Secondary Assignment Limit', () => {
  let service: TeacherSchoolAssignmentService;
  let assignmentRepository: jest.Mocked<TeacherSchoolAssignmentRepository>;
  let schoolRepository: jest.Mocked<SchoolRepository>;
  let dataSource: jest.Mocked<DataSource>;

  beforeEach(async () => {
    const mockAssignmentRepository = {
      findByTeacher: jest.fn(),
      findBySchool: jest.fn(),
      findActiveByTeacher: jest.fn(),
      countSecondaryByTeacher: jest.fn(),
      findByTeacherAndSchool: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      softDelete: jest.fn(),
    };

    const mockSchoolRepository = {
      findAll: jest.fn(),
      findById: jest.fn(),
      findByCode: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      softDelete: jest.fn(),
    };

    const mockManager = {
      create: jest.fn().mockImplementation((_entity, data) => data),
      save: jest.fn().mockImplementation((_entity, data) => ({
        id: 'new-assignment-id',
        ...data,
        createdAt: new Date(),
        updatedAt: new Date(),
        deletedAt: null,
      })),
    };

    const mockDataSource = {
      transaction: jest.fn().mockImplementation(async (cb) => cb(mockManager)),
      getRepository: jest.fn().mockReturnValue({
        findOne: jest.fn(),
      }),
    };

    const mockFeatureFlagService = {
      isCrossSchoolEnabled: jest.fn().mockResolvedValue(true),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TeacherSchoolAssignmentService,
        {
          provide: TeacherSchoolAssignmentRepository,
          useValue: mockAssignmentRepository,
        },
        { provide: SchoolRepository, useValue: mockSchoolRepository },
        { provide: DataSource, useValue: mockDataSource },
        { provide: FEATURE_FLAG_SERVICE, useValue: mockFeatureFlagService },
        { provide: TOKEN_INVALIDATION_SERVICE, useValue: null },
      ],
    }).compile();

    service = module.get<TeacherSchoolAssignmentService>(
      TeacherSchoolAssignmentService,
    );
    assignmentRepository = module.get(
      TeacherSchoolAssignmentRepository,
    ) as jest.Mocked<TeacherSchoolAssignmentRepository>;
    schoolRepository = module.get(
      SchoolRepository,
    ) as jest.Mocked<SchoolRepository>;
    dataSource = module.get(DataSource) as jest.Mocked<DataSource>;
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  /**
   * Property 3a: When existing secondary count < 5, creation SHALL succeed.
   *
   * For any teacher with N existing secondary assignments where N < 5,
   * creating a new secondary assignment SHALL be allowed.
   *
   * **Validates: Requirements 1.6**
   */
  describe('Property 3a: Secondary assignment creation allowed when count < MAX', () => {
    it('allows secondary assignment creation when existing count is below limit', async () => {
      await fc.assert(
        fc.asyncProperty(
          uuidArb,
          uuidArb,
          uuidArb,
          fc.integer({ min: 0, max: MAX_SECONDARY_ASSIGNMENTS - 1 }),
          dateStringArb,
          async (
            teacherId,
            primarySchoolId,
            secondarySchoolId,
            existingCount,
            startDate,
          ) => {
            // Ensure schools are different
            fc.pre(primarySchoolId !== secondarySchoolId);

            jest.clearAllMocks();

            const orgId = 'org-root-id';
            const mockTeacher = createMockTeacher(teacherId, primarySchoolId);
            const mockPrimarySchool = createMockSchool(primarySchoolId, orgId);
            const mockSecondarySchool = createMockSchool(
              secondarySchoolId,
              orgId,
            );

            // Mock: teacher exists
            const teacherRepo = {
              findOne: jest.fn().mockResolvedValue(mockTeacher),
            };
            dataSource.getRepository = jest.fn().mockReturnValue(teacherRepo);

            // Mock: both schools exist and belong to same org
            schoolRepository.findById
              .mockResolvedValueOnce(mockSecondarySchool as any) // target school
              .mockResolvedValueOnce(mockPrimarySchool as any) // teacher's primary school
              .mockResolvedValueOnce(mockPrimarySchool as any) // validateSameOrganization - school1
              .mockResolvedValueOnce(mockSecondarySchool as any); // validateSameOrganization - school2

            // Mock: no duplicate assignment
            assignmentRepository.findByTeacherAndSchool.mockResolvedValue(null);

            // Mock: existing secondary count is below MAX
            assignmentRepository.countSecondaryByTeacher.mockResolvedValue(
              existingCount,
            );

            const result = await service.createAssignment({
              teacherId,
              schoolId: secondarySchoolId,
              role: AssignmentRole.SECONDARY,
              effectiveStartDate: startDate,
            });

            // Assignment creation should succeed
            expect(result).toBeDefined();
            expect(result.role).toBe(AssignmentRole.SECONDARY);
            expect(result.status).toBe(AssignmentStatus.ACTIVE);
          },
        ),
        { numRuns: 100 },
      );
    });
  });

  /**
   * Property 3b: When existing secondary count >= 5, creation SHALL be rejected.
   *
   * For any teacher with N existing secondary assignments where N >= 5,
   * creating a new secondary assignment SHALL throw maxSecondaryExceeded error.
   *
   * **Validates: Requirements 1.6**
   */
  describe('Property 3b: Secondary assignment creation rejected when count >= MAX', () => {
    it('rejects secondary assignment creation when existing count is at or above limit', async () => {
      await fc.assert(
        fc.asyncProperty(
          uuidArb,
          uuidArb,
          uuidArb,
          fc.integer({ min: MAX_SECONDARY_ASSIGNMENTS, max: 10 }),
          dateStringArb,
          async (
            teacherId,
            primarySchoolId,
            secondarySchoolId,
            existingCount,
            startDate,
          ) => {
            // Ensure schools are different
            fc.pre(primarySchoolId !== secondarySchoolId);

            jest.clearAllMocks();

            const orgId = 'org-root-id';
            const mockTeacher = createMockTeacher(teacherId, primarySchoolId);
            const mockPrimarySchool = createMockSchool(primarySchoolId, orgId);
            const mockSecondarySchool = createMockSchool(
              secondarySchoolId,
              orgId,
            );

            // Mock: teacher exists
            const teacherRepo = {
              findOne: jest.fn().mockResolvedValue(mockTeacher),
            };
            dataSource.getRepository = jest.fn().mockReturnValue(teacherRepo);

            // Mock: both schools exist and belong to same org
            schoolRepository.findById
              .mockResolvedValueOnce(mockSecondarySchool as any) // target school
              .mockResolvedValueOnce(mockPrimarySchool as any) // teacher's primary school
              .mockResolvedValueOnce(mockPrimarySchool as any) // validateSameOrganization - school1
              .mockResolvedValueOnce(mockSecondarySchool as any); // validateSameOrganization - school2

            // Mock: no duplicate assignment
            assignmentRepository.findByTeacherAndSchool.mockResolvedValue(null);

            // Mock: existing secondary count is at or above MAX
            assignmentRepository.countSecondaryByTeacher.mockResolvedValue(
              existingCount,
            );

            // The 6th (or beyond) creation attempt should be rejected
            let caughtError: BadRequestException | null = null;
            try {
              await service.createAssignment({
                teacherId,
                schoolId: secondarySchoolId,
                role: AssignmentRole.SECONDARY,
                effectiveStartDate: startDate,
              });
            } catch (error) {
              caughtError = error as BadRequestException;
            }

            // Must have thrown
            expect(caughtError).not.toBeNull();
            expect(caughtError).toBeInstanceOf(BadRequestException);

            // Verify the error is specifically about max secondary exceeded
            const response = caughtError!.getResponse();
            expect((response as any).errorCode).toBe('MAX_SECONDARY_EXCEEDED');
          },
        ),
        { numRuns: 100 },
      );
    });
  });

  /**
   * Property 3c: The boundary — exactly at limit (count = 5) is always rejected.
   *
   * For any teacher with exactly 5 existing secondary assignments,
   * attempting to create a 6th SHALL always be rejected regardless of
   * other valid parameters (teacherId, schoolId, dates).
   *
   * **Validates: Requirements 1.6**
   */
  describe('Property 3c: Boundary — exactly 5 existing always rejects new secondary', () => {
    it('always rejects when teacher has exactly 5 active secondary assignments', async () => {
      await fc.assert(
        fc.asyncProperty(
          uuidArb,
          uuidArb,
          uuidArb,
          dateStringArb,
          fc.option(fc.string({ minLength: 1, maxLength: 100 }), {
            nil: undefined,
          }),
          async (
            teacherId,
            primarySchoolId,
            secondarySchoolId,
            startDate,
            note,
          ) => {
            // Ensure schools are different
            fc.pre(primarySchoolId !== secondarySchoolId);

            jest.clearAllMocks();

            const orgId = 'org-root-id';
            const mockTeacher = createMockTeacher(teacherId, primarySchoolId);
            const mockPrimarySchool = createMockSchool(primarySchoolId, orgId);
            const mockSecondarySchool = createMockSchool(
              secondarySchoolId,
              orgId,
            );

            // Mock: teacher exists
            const teacherRepo = {
              findOne: jest.fn().mockResolvedValue(mockTeacher),
            };
            dataSource.getRepository = jest.fn().mockReturnValue(teacherRepo);

            // Mock: both schools exist and belong to same org
            schoolRepository.findById
              .mockResolvedValueOnce(mockSecondarySchool as any)
              .mockResolvedValueOnce(mockPrimarySchool as any)
              .mockResolvedValueOnce(mockPrimarySchool as any)
              .mockResolvedValueOnce(mockSecondarySchool as any);

            // Mock: no duplicate
            assignmentRepository.findByTeacherAndSchool.mockResolvedValue(null);

            // Mock: exactly at limit
            assignmentRepository.countSecondaryByTeacher.mockResolvedValue(
              MAX_SECONDARY_ASSIGNMENTS,
            );

            // Should always reject
            await expect(
              service.createAssignment({
                teacherId,
                schoolId: secondarySchoolId,
                role: AssignmentRole.SECONDARY,
                effectiveStartDate: startDate,
                note: note,
              }),
            ).rejects.toThrow(BadRequestException);
          },
        ),
        { numRuns: 100 },
      );
    });
  });

  /**
   * Property 3d: Primary role is NOT subject to secondary limit.
   *
   * For any teacher regardless of existing secondary count,
   * creating an assignment with role PRIMARY SHALL NOT be rejected
   * due to the secondary limit check.
   *
   * **Validates: Requirements 1.6**
   */
  describe('Property 3d: Primary role bypasses secondary limit check', () => {
    it('primary role assignment is never rejected due to secondary limit', async () => {
      await fc.assert(
        fc.asyncProperty(
          uuidArb,
          uuidArb,
          uuidArb,
          existingSecondaryCountArb,
          dateStringArb,
          async (
            teacherId,
            primarySchoolId,
            targetSchoolId,
            existingCount,
            startDate,
          ) => {
            // Ensure schools are different
            fc.pre(primarySchoolId !== targetSchoolId);

            jest.clearAllMocks();

            const orgId = 'org-root-id';
            const mockTeacher = createMockTeacher(teacherId, primarySchoolId);
            const mockPrimarySchool = createMockSchool(primarySchoolId, orgId);
            const mockTargetSchool = createMockSchool(targetSchoolId, orgId);

            // Mock: teacher exists
            const teacherRepo = {
              findOne: jest.fn().mockResolvedValue(mockTeacher),
            };
            dataSource.getRepository = jest.fn().mockReturnValue(teacherRepo);

            // Mock: both schools exist and belong to same org
            schoolRepository.findById
              .mockResolvedValueOnce(mockTargetSchool as any)
              .mockResolvedValueOnce(mockPrimarySchool as any)
              .mockResolvedValueOnce(mockPrimarySchool as any)
              .mockResolvedValueOnce(mockTargetSchool as any);

            // Mock: no duplicate
            assignmentRepository.findByTeacherAndSchool.mockResolvedValue(null);

            // Mock: high secondary count (should not matter for PRIMARY role)
            assignmentRepository.countSecondaryByTeacher.mockResolvedValue(
              existingCount,
            );

            // Primary role should succeed regardless of secondary count
            const result = await service.createAssignment({
              teacherId,
              schoolId: targetSchoolId,
              role: AssignmentRole.PRIMARY,
              effectiveStartDate: startDate,
            });

            expect(result).toBeDefined();
            expect(result.role).toBe(AssignmentRole.PRIMARY);

            // countSecondaryByTeacher should NOT have been called for PRIMARY role
            expect(
              assignmentRepository.countSecondaryByTeacher,
            ).not.toHaveBeenCalled();
          },
        ),
        { numRuns: 100 },
      );
    });
  });
});
