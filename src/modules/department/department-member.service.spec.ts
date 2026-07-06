import { Test, TestingModule } from '@nestjs/testing';
import {
  NotFoundException,
  BadRequestException,
  ConflictException,
} from '@nestjs/common';
import { DataSource } from 'typeorm';
import { DepartmentMemberService } from './department-member.service';
import { DepartmentRepository } from './department.repository';
import { DepartmentMemberRepository } from './department-member.repository';
import { TeacherRepository } from '../teacher/teacher.repository';
import { TeacherSubjectRepository } from '../teacher/teacher-subject.repository';
import { PositionTitle, ManagementLevel } from './enums';
import { BatchAction } from './dto/batch-update.dto';

describe('DepartmentMemberService', () => {
  let service: DepartmentMemberService;
  let departmentRepository: jest.Mocked<DepartmentRepository>;
  let memberRepository: jest.Mocked<DepartmentMemberRepository>;
  let teacherRepository: jest.Mocked<TeacherRepository>;
  let dataSource: { transaction: jest.Mock };

  const schoolId = 'school-001';
  const departmentId = 'dept-001';
  const teacherId = 'teacher-001';
  const memberId = 'member-001';

  const mockDepartment = {
    id: departmentId,
    schoolId,
    name: 'Tá»• ToÃ¡n',
  };

  const mockTeacher = {
    id: teacherId,
    schoolId,
    fullName: 'Nguyá»…n VÄƒn A',
    email: 'a@school.vn',
  };

  const mockMember = {
    id: memberId,
    departmentId,
    teacherId,
    positionTitle: PositionTitle.GVBM,
    managementLevel: null,
  };

  beforeEach(async () => {
    const mockDepartmentRepository = {
      findById: jest.fn(),
    };

    const mockMemberRepository = {
      findById: jest.fn(),
      findByTeacherAndDepartment: jest.fn(),
      findByDepartment: jest.fn(),
      create: jest.fn(),
      updatePositionTitle: jest.fn(),
      updateManagementLevel: jest.fn(),
      softDelete: jest.fn(),
    };

    const mockTeacherRepository = {
      findById: jest.fn(),
      findByIdInternal: jest.fn(),
    };

    const mockTeacherSubjectRepository = {
      findByTeacherIds: jest.fn().mockResolvedValue([]),
    };

    const mockDataSource = {
      transaction: jest.fn(async (fn) =>
        fn({
          create: jest.fn().mockImplementation((_entity, data) => data),
          save: jest.fn().mockResolvedValue({}),
          softDelete: jest.fn().mockResolvedValue({}),
          update: jest.fn().mockResolvedValue({}),
        }),
      ),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DepartmentMemberService,
        { provide: DepartmentRepository, useValue: mockDepartmentRepository },
        { provide: DepartmentMemberRepository, useValue: mockMemberRepository },
        { provide: TeacherRepository, useValue: mockTeacherRepository },
        {
          provide: TeacherSubjectRepository,
          useValue: mockTeacherSubjectRepository,
        },
        { provide: DataSource, useValue: mockDataSource },
      ],
    }).compile();

    service = module.get<DepartmentMemberService>(DepartmentMemberService);
    departmentRepository = module.get(DepartmentRepository);
    memberRepository = module.get(DepartmentMemberRepository);
    teacherRepository = module.get(TeacherRepository);
    dataSource = module.get(DataSource);
  });

  describe('addMember', () => {
    it('should create member with positionTitle = GVBM and managementLevel = null', async () => {
      departmentRepository.findById.mockResolvedValue(mockDepartment as any);
      teacherRepository.findByIdInternal.mockResolvedValue(mockTeacher as any);
      memberRepository.findByTeacherAndDepartment.mockResolvedValue(null);
      memberRepository.create.mockResolvedValue(mockMember as any);

      const result = await service.addMember(
        departmentId,
        { teacherId },
        schoolId,
      );

      expect(memberRepository.create).toHaveBeenCalledWith({
        departmentId,
        teacherId,
        positionTitle: PositionTitle.GVBM,
        managementLevel: null,
      });
      expect(result).toEqual(mockMember);
    });

    it('should throw ConflictException when teacher is already a member', async () => {
      departmentRepository.findById.mockResolvedValue(mockDepartment as any);
      teacherRepository.findByIdInternal.mockResolvedValue(mockTeacher as any);
      memberRepository.findByTeacherAndDepartment.mockResolvedValue(
        mockMember as any,
      );

      await expect(
        service.addMember(departmentId, { teacherId }, schoolId),
      ).rejects.toThrow(ConflictException);
    });

    it('should throw BadRequestException when teacher belongs to different school', async () => {
      departmentRepository.findById.mockResolvedValue(mockDepartment as any);
      teacherRepository.findByIdInternal.mockResolvedValue({
        ...mockTeacher,
        schoolId: 'other-school',
      } as any);

      await expect(
        service.addMember(departmentId, { teacherId }, schoolId),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException when teacher not found', async () => {
      departmentRepository.findById.mockResolvedValue(mockDepartment as any);
      teacherRepository.findByIdInternal.mockResolvedValue(null);

      await expect(
        service.addMember(departmentId, { teacherId }, schoolId),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('removeMember', () => {
    it('should call softDelete on success', async () => {
      departmentRepository.findById.mockResolvedValue(mockDepartment as any);
      memberRepository.findById.mockResolvedValue(mockMember as any);
      memberRepository.softDelete.mockResolvedValue(undefined);

      await service.removeMember(departmentId, memberId, schoolId);

      expect(memberRepository.softDelete).toHaveBeenCalledWith(memberId);
    });

    it('should throw NotFoundException when member not found', async () => {
      departmentRepository.findById.mockResolvedValue(mockDepartment as any);
      memberRepository.findById.mockResolvedValue(null);

      await expect(
        service.removeMember(departmentId, memberId, schoolId),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw NotFoundException when member belongs to different department', async () => {
      departmentRepository.findById.mockResolvedValue(mockDepartment as any);
      memberRepository.findById.mockResolvedValue({
        ...mockMember,
        departmentId: 'other-dept',
      } as any);

      await expect(
        service.removeMember(departmentId, memberId, schoolId),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('updatePositionTitle', () => {
    it('should update position title with valid value', async () => {
      const updatedMember = {
        ...mockMember,
        positionTitle: PositionTitle.GVCN,
      };
      departmentRepository.findById.mockResolvedValue(mockDepartment as any);
      memberRepository.findById.mockResolvedValue(mockMember as any);
      memberRepository.updatePositionTitle.mockResolvedValue(
        updatedMember as any,
      );

      const result = await service.updatePositionTitle(
        departmentId,
        memberId,
        { positionTitle: PositionTitle.GVCN },
        schoolId,
      );

      expect(memberRepository.updatePositionTitle).toHaveBeenCalledWith(
        memberId,
        PositionTitle.GVCN,
      );
      expect(result.positionTitle).toBe(PositionTitle.GVCN);
    });

    it('should update to PCN position title', async () => {
      const updatedMember = { ...mockMember, positionTitle: PositionTitle.PCN };
      departmentRepository.findById.mockResolvedValue(mockDepartment as any);
      memberRepository.findById.mockResolvedValue(mockMember as any);
      memberRepository.updatePositionTitle.mockResolvedValue(
        updatedMember as any,
      );

      const result = await service.updatePositionTitle(
        departmentId,
        memberId,
        { positionTitle: PositionTitle.PCN },
        schoolId,
      );

      expect(result.positionTitle).toBe(PositionTitle.PCN);
    });

    it('should throw NotFoundException when member does not belong to department', async () => {
      departmentRepository.findById.mockResolvedValue(mockDepartment as any);
      memberRepository.findById.mockResolvedValue({
        ...mockMember,
        departmentId: 'other-dept',
      } as any);

      await expect(
        service.updatePositionTitle(
          departmentId,
          memberId,
          { positionTitle: PositionTitle.GVCN },
          schoolId,
        ),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('updateManagementLevel', () => {
    it('should update management level with valid value', async () => {
      const updatedMember = {
        ...mockMember,
        managementLevel: ManagementLevel.TO_TRUONG,
      };
      departmentRepository.findById.mockResolvedValue(mockDepartment as any);
      memberRepository.findById.mockResolvedValue(mockMember as any);
      memberRepository.updateManagementLevel.mockResolvedValue(
        updatedMember as any,
      );

      const result = await service.updateManagementLevel(
        departmentId,
        memberId,
        { managementLevel: ManagementLevel.TO_TRUONG },
        schoolId,
      );

      expect(memberRepository.updateManagementLevel).toHaveBeenCalledWith(
        memberId,
        ManagementLevel.TO_TRUONG,
      );
      expect(result.managementLevel).toBe(ManagementLevel.TO_TRUONG);
    });

    it('should update management level to null (clear level)', async () => {
      const updatedMember = { ...mockMember, managementLevel: null };
      departmentRepository.findById.mockResolvedValue(mockDepartment as any);
      memberRepository.findById.mockResolvedValue(mockMember as any);
      memberRepository.updateManagementLevel.mockResolvedValue(
        updatedMember as any,
      );

      const result = await service.updateManagementLevel(
        departmentId,
        memberId,
        { managementLevel: null },
        schoolId,
      );

      expect(memberRepository.updateManagementLevel).toHaveBeenCalledWith(
        memberId,
        null,
      );
      expect(result.managementLevel).toBeNull();
    });

    it('should throw NotFoundException when member not found', async () => {
      departmentRepository.findById.mockResolvedValue(mockDepartment as any);
      memberRepository.findById.mockResolvedValue(null);

      await expect(
        service.updateManagementLevel(
          departmentId,
          memberId,
          { managementLevel: ManagementLevel.TO_PHO },
          schoolId,
        ),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('batchUpdate', () => {
    it('should execute all operations when all pass validation', async () => {
      const newTeacherId = 'teacher-002';
      departmentRepository.findById.mockResolvedValue(mockDepartment as any);
      teacherRepository.findByIdInternal.mockResolvedValue({
        id: newTeacherId,
        schoolId,
      } as any);
      memberRepository.findByTeacherAndDepartment.mockResolvedValue(null);
      memberRepository.findById.mockResolvedValue(mockMember as any);
      memberRepository.findByDepartment.mockResolvedValue([
        [mockMember],
        1,
      ] as any);

      const result = await service.batchUpdate(
        departmentId,
        {
          operations: [
            { action: BatchAction.ADD, teacherId: newTeacherId },
            { action: BatchAction.REMOVE, memberId },
          ],
        },
        schoolId,
      );

      expect(dataSource.transaction).toHaveBeenCalled();
      expect(result).toEqual([mockMember]);
    });

    it('should reject entire batch when one operation fails validation', async () => {
      departmentRepository.findById.mockResolvedValue(mockDepartment as any);
      // First operation: teacher not found
      teacherRepository.findByIdInternal.mockResolvedValue(null);
      // Second operation: valid member
      memberRepository.findById.mockResolvedValue(mockMember as any);

      await expect(
        service.batchUpdate(
          departmentId,
          {
            operations: [
              { action: BatchAction.ADD, teacherId: 'non-existent-teacher' },
              { action: BatchAction.REMOVE, memberId },
            ],
          },
          schoolId,
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException when more than 50 operations', async () => {
      const operations = Array.from({ length: 51 }, (_, i) => ({
        action: BatchAction.ADD,
        teacherId: `teacher-${i}`,
      }));

      await expect(
        service.batchUpdate(departmentId, { operations }, schoolId),
      ).rejects.toThrow(BadRequestException);
    });

    it('should include errors array identifying failed operations by index', async () => {
      departmentRepository.findById.mockResolvedValue(mockDepartment as any);
      teacherRepository.findByIdInternal.mockResolvedValue(null);

      try {
        await service.batchUpdate(
          departmentId,
          {
            operations: [
              { action: BatchAction.ADD, teacherId: 'invalid-teacher' },
            ],
          },
          schoolId,
        );
        fail('Should have thrown BadRequestException');
      } catch (error) {
        expect(error).toBeInstanceOf(BadRequestException);
        const response = (error as BadRequestException).getResponse();
        expect(response).toHaveProperty('errors');
        expect((response as any).errors[0]).toMatchObject({
          index: 0,
          action: BatchAction.ADD,
        });
      }
    });

    it('should reject batch with > 50 operations with correct message', async () => {
      const operations = Array.from({ length: 51 }, (_, i) => ({
        action: BatchAction.ADD,
        teacherId: `teacher-${i}`,
      }));

      try {
        await service.batchUpdate(departmentId, { operations }, schoolId);
        fail('Should have thrown BadRequestException');
      } catch (error) {
        expect(error).toBeInstanceOf(BadRequestException);
        const response = (error as BadRequestException).getResponse() as any;
        expect(response.message).toContain('50');
      }
    });
  });
});
