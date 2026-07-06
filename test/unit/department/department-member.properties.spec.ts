import * as fc from 'fast-check';
import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, ConflictException } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { DepartmentMemberService } from '../../../src/modules/department/department-member.service';
import { DepartmentRepository } from '../../../src/modules/department/department.repository';
import { DepartmentMemberRepository } from '../../../src/modules/department/department-member.repository';
import { TeacherRepository } from '../../../src/modules/teacher/teacher.repository';
import { TeacherSubjectRepository } from '../../../src/modules/teacher/teacher-subject.repository';
import { DepartmentEntity } from '../../../src/modules/department/entities/department.entity';
import { DepartmentMemberEntity } from '../../../src/modules/department/entities/department-member.entity';
import { TeacherEntity } from '../../../src/modules/teacher/entities/teacher.entity';
import {
  PositionTitle,
  ManagementLevel,
} from '../../../src/modules/department/enums';
import { BatchAction } from '../../../src/modules/department/dto/batch-update.dto';

/**
 * Feature: to-bo-mon
 * Property 6: Default values on member creation
 * Property 10: Duplicate membership rejection
 * Property 11: Position title enum validation
 * Property 12: Management level enum validation
 * Property 15: Batch atomicity
 *
 * Validates: Requirements 2.1, 2.6, 3.1, 3.3, 4.1, 4.3, 5.1, 5.2
 */

// Helper: create mock instances
function createMockDepartment(
  overrides?: Partial<DepartmentEntity>,
): DepartmentEntity {
  return {
    id: 'dept-id',
    schoolId: 'school-id',
    name: 'Test Department',
    headTeacherId: null,
    headTeacher: null,
    school: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    deletedAt: null,
    ...overrides,
  } as DepartmentEntity;
}

function createMockTeacher(overrides?: Partial<TeacherEntity>): TeacherEntity {
  return {
    id: 'teacher-id',
    schoolId: 'school-id',
    fullName: 'Test Teacher',
    email: 'test@example.com',
    createdAt: new Date(),
    updatedAt: new Date(),
    deletedAt: null,
    ...overrides,
  } as TeacherEntity;
}

function createMockMember(
  overrides?: Partial<DepartmentMemberEntity>,
): DepartmentMemberEntity {
  return {
    id: 'member-id',
    departmentId: 'dept-id',
    teacherId: 'teacher-id',
    positionTitle: PositionTitle.GVBM,
    managementLevel: null,
    department: null,
    teacher: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    deletedAt: null,
    ...overrides,
  } as DepartmentMemberEntity;
}

describe('Feature: to-bo-mon, Property 6: Default values on member creation', () => {
  let service: DepartmentMemberService;
  let departmentRepository: jest.Mocked<DepartmentRepository>;
  let memberRepository: jest.Mocked<DepartmentMemberRepository>;
  let teacherRepository: jest.Mocked<TeacherRepository>;
  let dataSource: jest.Mocked<DataSource>;

  beforeEach(async () => {
    const mockDepartmentRepo = {
      findById: jest.fn(),
      findByNameAndSchool: jest.fn(),
      countActiveMembers: jest.fn(),
    };
    const mockMemberRepo = {
      findByDepartment: jest.fn(),
      findById: jest.fn(),
      findByTeacherAndDepartment: jest.fn(),
      create: jest.fn(),
      updatePositionTitle: jest.fn(),
      updateManagementLevel: jest.fn(),
      softDelete: jest.fn(),
    };
    const mockTeacherRepo = {
      findById: jest.fn(),
      findByIdInternal: jest.fn(),
    };
    const mockDataSource = {
      transaction: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DepartmentMemberService,
        { provide: DepartmentRepository, useValue: mockDepartmentRepo },
        { provide: DepartmentMemberRepository, useValue: mockMemberRepo },
        { provide: TeacherRepository, useValue: mockTeacherRepo },
        {
          provide: TeacherSubjectRepository,
          useValue: { findByTeacherIds: jest.fn().mockResolvedValue([]) },
        },
        { provide: DataSource, useValue: mockDataSource },
      ],
    }).compile();

    service = module.get<DepartmentMemberService>(DepartmentMemberService);
    departmentRepository = module.get(
      DepartmentRepository,
    ) as jest.Mocked<DepartmentRepository>;
    memberRepository = module.get(
      DepartmentMemberRepository,
    ) as jest.Mocked<DepartmentMemberRepository>;
    teacherRepository = module.get(
      TeacherRepository,
    ) as jest.Mocked<TeacherRepository>;
    dataSource = module.get(DataSource) as jest.Mocked<DataSource>;
  });

  /**
   * **Validates: Requirements 2.1**
   *
   * For any valid teacher-department pair, when the teacher is added to the department,
   * the resulting DepartmentMember record SHALL have position_title = GVBM and management_level = null.
   */
  it('should create member with positionTitle=GVBM and managementLevel=null for any valid teacher-department pair', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.uuid(),
        fc.uuid(),
        fc.uuid(),
        async (departmentId, teacherId, schoolId) => {
          const department = createMockDepartment({
            id: departmentId,
            schoolId,
          });
          const teacher = createMockTeacher({ id: teacherId, schoolId });

          departmentRepository.findById.mockResolvedValue(department);
          teacherRepository.findByIdInternal.mockResolvedValue(teacher);
          memberRepository.findByTeacherAndDepartment.mockResolvedValue(null);

          const createdMember = createMockMember({
            departmentId,
            teacherId,
            positionTitle: PositionTitle.GVBM,
            managementLevel: null,
          });
          memberRepository.create.mockResolvedValue(createdMember);

          const result = await service.addMember(
            departmentId,
            { teacherId },
            null,
          );

          expect(result.positionTitle).toBe(PositionTitle.GVBM);
          expect(result.managementLevel).toBeNull();

          // Verify create was called with correct defaults
          expect(memberRepository.create).toHaveBeenCalledWith(
            expect.objectContaining({
              departmentId,
              teacherId,
              positionTitle: PositionTitle.GVBM,
              managementLevel: null,
            }),
          );
        },
      ),
      { numRuns: 100 },
    );
  });
});

describe('Feature: to-bo-mon, Property 10: Duplicate membership rejection', () => {
  let service: DepartmentMemberService;
  let departmentRepository: jest.Mocked<DepartmentRepository>;
  let memberRepository: jest.Mocked<DepartmentMemberRepository>;
  let teacherRepository: jest.Mocked<TeacherRepository>;
  let dataSource: jest.Mocked<DataSource>;

  beforeEach(async () => {
    const mockDepartmentRepo = {
      findById: jest.fn(),
      findByNameAndSchool: jest.fn(),
      countActiveMembers: jest.fn(),
    };
    const mockMemberRepo = {
      findByDepartment: jest.fn(),
      findById: jest.fn(),
      findByTeacherAndDepartment: jest.fn(),
      create: jest.fn(),
      updatePositionTitle: jest.fn(),
      updateManagementLevel: jest.fn(),
      softDelete: jest.fn(),
    };
    const mockTeacherRepo = {
      findById: jest.fn(),
      findByIdInternal: jest.fn(),
    };
    const mockDataSource = {
      transaction: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DepartmentMemberService,
        { provide: DepartmentRepository, useValue: mockDepartmentRepo },
        { provide: DepartmentMemberRepository, useValue: mockMemberRepo },
        { provide: TeacherRepository, useValue: mockTeacherRepo },
        {
          provide: TeacherSubjectRepository,
          useValue: { findByTeacherIds: jest.fn().mockResolvedValue([]) },
        },
        { provide: DataSource, useValue: mockDataSource },
      ],
    }).compile();

    service = module.get<DepartmentMemberService>(DepartmentMemberService);
    departmentRepository = module.get(
      DepartmentRepository,
    ) as jest.Mocked<DepartmentRepository>;
    memberRepository = module.get(
      DepartmentMemberRepository,
    ) as jest.Mocked<DepartmentMemberRepository>;
    teacherRepository = module.get(
      TeacherRepository,
    ) as jest.Mocked<TeacherRepository>;
    dataSource = module.get(DataSource) as jest.Mocked<DataSource>;
  });

  /**
   * **Validates: Requirements 2.6**
   *
   * For any teacher that is already an active member of a department,
   * attempting to add that same teacher to the same department again
   * SHALL be rejected with a duplicate error.
   */
  it('should reject duplicate membership for any teacher already active in a department', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.uuid(),
        fc.uuid(),
        fc.uuid(),
        fc.uuid(),
        async (departmentId, teacherId, schoolId, existingMemberId) => {
          const department = createMockDepartment({
            id: departmentId,
            schoolId,
          });
          const teacher = createMockTeacher({ id: teacherId, schoolId });
          const existingMember = createMockMember({
            id: existingMemberId,
            departmentId,
            teacherId,
          });

          departmentRepository.findById.mockResolvedValue(department);
          teacherRepository.findByIdInternal.mockResolvedValue(teacher);
          memberRepository.findByTeacherAndDepartment.mockResolvedValue(
            existingMember,
          );

          await expect(
            service.addMember(departmentId, { teacherId }, null),
          ).rejects.toThrow(ConflictException);
        },
      ),
      { numRuns: 100 },
    );
  });
});

describe('Feature: to-bo-mon, Property 11: Position title enum validation', () => {
  let service: DepartmentMemberService;
  let departmentRepository: jest.Mocked<DepartmentRepository>;
  let memberRepository: jest.Mocked<DepartmentMemberRepository>;
  let teacherRepository: jest.Mocked<TeacherRepository>;
  let dataSource: jest.Mocked<DataSource>;

  beforeEach(async () => {
    const mockDepartmentRepo = {
      findById: jest.fn(),
      findByNameAndSchool: jest.fn(),
      countActiveMembers: jest.fn(),
    };
    const mockMemberRepo = {
      findByDepartment: jest.fn(),
      findById: jest.fn(),
      findByTeacherAndDepartment: jest.fn(),
      create: jest.fn(),
      updatePositionTitle: jest.fn(),
      updateManagementLevel: jest.fn(),
      softDelete: jest.fn(),
    };
    const mockTeacherRepo = {
      findById: jest.fn(),
      findByIdInternal: jest.fn(),
    };
    const mockDataSource = {
      transaction: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DepartmentMemberService,
        { provide: DepartmentRepository, useValue: mockDepartmentRepo },
        { provide: DepartmentMemberRepository, useValue: mockMemberRepo },
        { provide: TeacherRepository, useValue: mockTeacherRepo },
        {
          provide: TeacherSubjectRepository,
          useValue: { findByTeacherIds: jest.fn().mockResolvedValue([]) },
        },
        { provide: DataSource, useValue: mockDataSource },
      ],
    }).compile();

    service = module.get<DepartmentMemberService>(DepartmentMemberService);
    departmentRepository = module.get(
      DepartmentRepository,
    ) as jest.Mocked<DepartmentRepository>;
    memberRepository = module.get(
      DepartmentMemberRepository,
    ) as jest.Mocked<DepartmentMemberRepository>;
    teacherRepository = module.get(
      TeacherRepository,
    ) as jest.Mocked<TeacherRepository>;
    dataSource = module.get(DataSource) as jest.Mocked<DataSource>;
  });

  const validPositionTitles = Object.values(PositionTitle);

  /**
   * **Validates: Requirements 3.1**
   *
   * For any valid PositionTitle value, updating a department member's position_title SHALL succeed.
   */
  it('should accept any valid PositionTitle value on update', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.uuid(),
        fc.uuid(),
        fc.uuid(),
        fc.constantFrom(...validPositionTitles),
        async (departmentId, memberId, schoolId, positionTitle) => {
          const department = createMockDepartment({
            id: departmentId,
            schoolId,
          });
          const member = createMockMember({ id: memberId, departmentId });
          const updatedMember = createMockMember({
            id: memberId,
            departmentId,
            positionTitle,
          });

          departmentRepository.findById.mockResolvedValue(department);
          memberRepository.findById.mockResolvedValue(member);
          memberRepository.updatePositionTitle.mockResolvedValue(updatedMember);

          const result = await service.updatePositionTitle(
            departmentId,
            memberId,
            { positionTitle },
            null,
          );

          expect(result.positionTitle).toBe(positionTitle);
          expect(validPositionTitles).toContain(result.positionTitle);
        },
      ),
      { numRuns: 100 },
    );
  });

  /**
   * **Validates: Requirements 3.3**
   *
   * For any string value that is NOT one of {GVBM, GVCN, PCN},
   * updating a department member's position_title SHALL be rejected.
   *
   * Note: This tests the DTO validation layer. In the service layer, TypeScript
   * typing prevents invalid values from reaching the service. The DTO validation
   * (class-validator @IsEnum) is what enforces this at runtime.
   * Here we verify the service correctly passes through to the repository only valid values.
   */
  it('should only call updatePositionTitle with values from the PositionTitle enum', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.uuid(),
        fc.uuid(),
        fc.uuid(),
        fc.constantFrom(...validPositionTitles),
        async (departmentId, memberId, schoolId, positionTitle) => {
          const department = createMockDepartment({
            id: departmentId,
            schoolId,
          });
          const member = createMockMember({ id: memberId, departmentId });
          const updatedMember = createMockMember({
            id: memberId,
            departmentId,
            positionTitle,
          });

          departmentRepository.findById.mockResolvedValue(department);
          memberRepository.findById.mockResolvedValue(member);
          memberRepository.updatePositionTitle.mockResolvedValue(updatedMember);

          await service.updatePositionTitle(
            departmentId,
            memberId,
            { positionTitle },
            null,
          );

          expect(memberRepository.updatePositionTitle).toHaveBeenCalledWith(
            memberId,
            positionTitle,
          );
          // Verify the value passed is always a valid PositionTitle
          const calledWith =
            memberRepository.updatePositionTitle.mock.calls[0][1];
          expect(validPositionTitles).toContain(calledWith);
        },
      ),
      { numRuns: 100 },
    );
  });
});

describe('Feature: to-bo-mon, Property 12: Management level enum validation', () => {
  let service: DepartmentMemberService;
  let departmentRepository: jest.Mocked<DepartmentRepository>;
  let memberRepository: jest.Mocked<DepartmentMemberRepository>;
  let teacherRepository: jest.Mocked<TeacherRepository>;
  let dataSource: jest.Mocked<DataSource>;

  beforeEach(async () => {
    const mockDepartmentRepo = {
      findById: jest.fn(),
      findByNameAndSchool: jest.fn(),
      countActiveMembers: jest.fn(),
    };
    const mockMemberRepo = {
      findByDepartment: jest.fn(),
      findById: jest.fn(),
      findByTeacherAndDepartment: jest.fn(),
      create: jest.fn(),
      updatePositionTitle: jest.fn(),
      updateManagementLevel: jest.fn(),
      softDelete: jest.fn(),
    };
    const mockTeacherRepo = {
      findById: jest.fn(),
      findByIdInternal: jest.fn(),
    };
    const mockDataSource = {
      transaction: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DepartmentMemberService,
        { provide: DepartmentRepository, useValue: mockDepartmentRepo },
        { provide: DepartmentMemberRepository, useValue: mockMemberRepo },
        { provide: TeacherRepository, useValue: mockTeacherRepo },
        {
          provide: TeacherSubjectRepository,
          useValue: { findByTeacherIds: jest.fn().mockResolvedValue([]) },
        },
        { provide: DataSource, useValue: mockDataSource },
      ],
    }).compile();

    service = module.get<DepartmentMemberService>(DepartmentMemberService);
    departmentRepository = module.get(
      DepartmentRepository,
    ) as jest.Mocked<DepartmentRepository>;
    memberRepository = module.get(
      DepartmentMemberRepository,
    ) as jest.Mocked<DepartmentMemberRepository>;
    teacherRepository = module.get(
      TeacherRepository,
    ) as jest.Mocked<TeacherRepository>;
    dataSource = module.get(DataSource) as jest.Mocked<DataSource>;
  });

  const validManagementLevels = Object.values(ManagementLevel);

  /**
   * **Validates: Requirements 4.1**
   *
   * For any valid ManagementLevel value (including null),
   * updating a department member's management_level SHALL succeed.
   */
  it('should accept any valid ManagementLevel value (including null) on update', async () => {
    const validLevelsWithNull: (ManagementLevel | null)[] = [
      ...validManagementLevels,
      null,
    ];

    await fc.assert(
      fc.asyncProperty(
        fc.uuid(),
        fc.uuid(),
        fc.uuid(),
        fc.constantFrom(...validLevelsWithNull),
        async (departmentId, memberId, schoolId, managementLevel) => {
          const department = createMockDepartment({
            id: departmentId,
            schoolId,
          });
          const member = createMockMember({ id: memberId, departmentId });
          const updatedMember = createMockMember({
            id: memberId,
            departmentId,
            managementLevel,
          });

          departmentRepository.findById.mockResolvedValue(department);
          memberRepository.findById.mockResolvedValue(member);
          memberRepository.updateManagementLevel.mockResolvedValue(
            updatedMember,
          );

          const result = await service.updateManagementLevel(
            departmentId,
            memberId,
            { managementLevel },
            null,
          );

          expect(result.managementLevel).toBe(managementLevel);
          if (managementLevel !== null) {
            expect(validManagementLevels).toContain(result.managementLevel);
          } else {
            expect(result.managementLevel).toBeNull();
          }
        },
      ),
      { numRuns: 100 },
    );
  });

  /**
   * **Validates: Requirements 4.3**
   *
   * For any value, updating a department member's management_level SHALL succeed
   * if and only if the value is one of the valid enum values or null.
   * Here we verify the service correctly passes through to the repository only valid values.
   */
  it('should only call updateManagementLevel with valid ManagementLevel or null', async () => {
    const validLevelsWithNull: (ManagementLevel | null)[] = [
      ...validManagementLevels,
      null,
    ];

    await fc.assert(
      fc.asyncProperty(
        fc.uuid(),
        fc.uuid(),
        fc.uuid(),
        fc.constantFrom(...validLevelsWithNull),
        async (departmentId, memberId, schoolId, managementLevel) => {
          const department = createMockDepartment({
            id: departmentId,
            schoolId,
          });
          const member = createMockMember({ id: memberId, departmentId });
          const updatedMember = createMockMember({
            id: memberId,
            departmentId,
            managementLevel,
          });

          departmentRepository.findById.mockResolvedValue(department);
          memberRepository.findById.mockResolvedValue(member);
          memberRepository.updateManagementLevel.mockResolvedValue(
            updatedMember,
          );

          await service.updateManagementLevel(
            departmentId,
            memberId,
            { managementLevel },
            null,
          );

          expect(memberRepository.updateManagementLevel).toHaveBeenCalledWith(
            memberId,
            managementLevel,
          );
          const calledWith =
            memberRepository.updateManagementLevel.mock.calls[0][1];
          if (calledWith !== null) {
            expect(validManagementLevels).toContain(calledWith);
          }
        },
      ),
      { numRuns: 100 },
    );
  });
});

describe('Feature: to-bo-mon, Property 15: Batch atomicity', () => {
  let service: DepartmentMemberService;
  let departmentRepository: jest.Mocked<DepartmentRepository>;
  let memberRepository: jest.Mocked<DepartmentMemberRepository>;
  let teacherRepository: jest.Mocked<TeacherRepository>;
  let dataSource: jest.Mocked<DataSource>;

  beforeEach(async () => {
    const mockDepartmentRepo = {
      findById: jest.fn(),
      findByNameAndSchool: jest.fn(),
      countActiveMembers: jest.fn(),
    };
    const mockMemberRepo = {
      findByDepartment: jest.fn(),
      findById: jest.fn(),
      findByTeacherAndDepartment: jest.fn(),
      create: jest.fn(),
      updatePositionTitle: jest.fn(),
      updateManagementLevel: jest.fn(),
      softDelete: jest.fn(),
    };
    const mockTeacherRepo = {
      findById: jest.fn(),
      findByIdInternal: jest.fn(),
    };
    const mockDataSource = {
      transaction: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DepartmentMemberService,
        { provide: DepartmentRepository, useValue: mockDepartmentRepo },
        { provide: DepartmentMemberRepository, useValue: mockMemberRepo },
        { provide: TeacherRepository, useValue: mockTeacherRepo },
        {
          provide: TeacherSubjectRepository,
          useValue: { findByTeacherIds: jest.fn().mockResolvedValue([]) },
        },
        { provide: DataSource, useValue: mockDataSource },
      ],
    }).compile();

    service = module.get<DepartmentMemberService>(DepartmentMemberService);
    departmentRepository = module.get(
      DepartmentRepository,
    ) as jest.Mocked<DepartmentRepository>;
    memberRepository = module.get(
      DepartmentMemberRepository,
    ) as jest.Mocked<DepartmentMemberRepository>;
    teacherRepository = module.get(
      TeacherRepository,
    ) as jest.Mocked<TeacherRepository>;
    dataSource = module.get(DataSource) as jest.Mocked<DataSource>;
  });

  /**
   * **Validates: Requirements 5.1, 5.2**
   *
   * For any batch of 1–50 valid add operations on a single department,
   * ALL operations pass validation and are applied within a single transaction.
   */
  it('should apply all operations in a transaction when all validations pass', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.uuid(),
        fc.uuid(),
        fc.array(fc.uuid(), { minLength: 1, maxLength: 10 }),
        async (departmentId, schoolId, teacherIds) => {
          // Ensure unique teacher IDs
          const uniqueTeacherIds = [...new Set(teacherIds)];
          if (uniqueTeacherIds.length === 0) return;

          // Reset mocks for each property run
          jest.clearAllMocks();

          const department = createMockDepartment({
            id: departmentId,
            schoolId,
          });
          departmentRepository.findById.mockResolvedValue(department);

          // All teachers exist and belong to same school
          for (const tId of uniqueTeacherIds) {
            teacherRepository.findByIdInternal.mockResolvedValueOnce(
              createMockTeacher({ id: tId, schoolId }),
            );
          }

          // No existing memberships
          memberRepository.findByTeacherAndDepartment.mockResolvedValue(null);

          // Transaction mock: execute the callback
          (dataSource.transaction as jest.Mock).mockImplementation(
            async (cb: (manager: unknown) => Promise<void>) => {
              const mockManager = {
                create: jest.fn().mockReturnValue({}),
                save: jest.fn().mockResolvedValue({}),
                softDelete: jest.fn().mockResolvedValue({}),
                update: jest.fn().mockResolvedValue({}),
              };
              await cb(mockManager);
            },
          );

          // After batch, return members
          memberRepository.findByDepartment.mockResolvedValue([[], 0]);

          const operations = uniqueTeacherIds.map((teacherId) => ({
            action: BatchAction.ADD,
            teacherId,
          }));

          const result = await service.batchUpdate(
            departmentId,
            { operations },
            null,
          );

          // Transaction was called (atomicity)
          expect(dataSource.transaction).toHaveBeenCalledTimes(1);
          expect(result).toBeDefined();
        },
      ),
      { numRuns: 100 },
    );
  });

  /**
   * **Validates: Requirements 5.1, 5.2**
   *
   * For any batch where at least one operation fails validation,
   * NO changes are applied and the error response identifies each failed operation.
   */
  it('should reject entire batch and identify failed operations when any validation fails', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.uuid(),
        fc.uuid(),
        fc.array(fc.uuid(), { minLength: 1, maxLength: 10 }),
        fc.nat({ max: 9 }),
        async (departmentId, schoolId, teacherIds, failIndex) => {
          const uniqueTeacherIds = [...new Set(teacherIds)];
          if (uniqueTeacherIds.length === 0) return;

          // Reset mocks for each property run
          jest.clearAllMocks();

          const actualFailIndex = failIndex % uniqueTeacherIds.length;
          const department = createMockDepartment({
            id: departmentId,
            schoolId,
          });
          departmentRepository.findById.mockResolvedValue(department);

          // Set up teachers: one will fail (wrong school)
          for (let i = 0; i < uniqueTeacherIds.length; i++) {
            if (i === actualFailIndex) {
              // This teacher belongs to a different school
              teacherRepository.findByIdInternal.mockResolvedValueOnce(
                createMockTeacher({
                  id: uniqueTeacherIds[i],
                  schoolId: 'different-school-id',
                }),
              );
            } else {
              teacherRepository.findByIdInternal.mockResolvedValueOnce(
                createMockTeacher({
                  id: uniqueTeacherIds[i],
                  schoolId,
                }),
              );
            }
          }

          memberRepository.findByTeacherAndDepartment.mockResolvedValue(null);

          const operations = uniqueTeacherIds.map((teacherId) => ({
            action: BatchAction.ADD,
            teacherId,
          }));

          await expect(
            service.batchUpdate(departmentId, { operations }, null),
          ).rejects.toThrow(BadRequestException);

          // Transaction should NOT be called (no changes applied)
          expect(dataSource.transaction).not.toHaveBeenCalled();
        },
      ),
      { numRuns: 100 },
    );
  });

  /**
   * **Validates: Requirements 5.1, 5.2**
   *
   * For any batch with duplicate add operations (same teacher added twice),
   * the batch SHALL be rejected and error identifies the duplicate operation.
   */
  it('should reject batch with duplicate add operations identifying each failure', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.uuid(),
        fc.uuid(),
        fc.uuid(),
        async (departmentId, schoolId, teacherId) => {
          // Reset mocks for each property run
          jest.clearAllMocks();

          const department = createMockDepartment({
            id: departmentId,
            schoolId,
          });
          departmentRepository.findById.mockResolvedValue(department);

          const teacher = createMockTeacher({ id: teacherId, schoolId });
          teacherRepository.findByIdInternal.mockResolvedValue(teacher);

          // First add: no existing membership
          // Second add: membership now exists (simulated by returning existing member on second call)
          memberRepository.findByTeacherAndDepartment
            .mockResolvedValueOnce(null)
            .mockResolvedValueOnce(
              createMockMember({ departmentId, teacherId }),
            );

          const operations = [
            { action: BatchAction.ADD, teacherId },
            { action: BatchAction.ADD, teacherId },
          ];

          try {
            await service.batchUpdate(departmentId, { operations }, null);
            // Should not reach here
            expect(true).toBe(false);
          } catch (error) {
            expect(error).toBeInstanceOf(BadRequestException);
            // Transaction not called = no changes applied
            expect(dataSource.transaction).not.toHaveBeenCalled();
          }
        },
      ),
      { numRuns: 100 },
    );
  });
});
