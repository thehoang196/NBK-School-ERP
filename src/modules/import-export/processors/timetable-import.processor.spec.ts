import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import {
  TimetableImportProcessor,
  TeacherResolveResult,
} from './timetable-import.processor';
import { TeacherEntity } from '../../teacher/entities/teacher.entity';
import { SchoolEntity } from '../../school/entities/school.entity';
import { TeacherSchoolAssignmentEntity } from '../../teacher-school-assignment/entities/teacher-school-assignment.entity';
import { AssignmentStatus } from '../../teacher-school-assignment/enums/assignment-status.enum';

describe('TimetableImportProcessor', () => {
  let processor: TimetableImportProcessor;

  const mockTeacherRepo = {
    findOne: jest.fn(),
  };

  const mockSchoolRepo = {
    find: jest.fn(),
  };

  const mockTsaRepo = {
    findOne: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TimetableImportProcessor,
        {
          provide: getRepositoryToken(TeacherEntity),
          useValue: mockTeacherRepo,
        },
        {
          provide: getRepositoryToken(SchoolEntity),
          useValue: mockSchoolRepo,
        },
        {
          provide: getRepositoryToken(TeacherSchoolAssignmentEntity),
          useValue: mockTsaRepo,
        },
      ],
    }).compile();

    processor = module.get<TimetableImportProcessor>(TimetableImportProcessor);

    jest.clearAllMocks();
  });

  describe('resolveTeacher', () => {
    const employeeCode = 'GV001';
    const importingSchoolId = 'school-importing-id';
    const organizationId = 'org-root-id';

    it('should return teacher when found in importing school (step 1)', async () => {
      const localTeacher = createMockTeacher({
        id: 'teacher-1',
        employeeCode,
        schoolId: importingSchoolId,
        fullName: 'Nguyễn Văn A',
      });

      mockTeacherRepo.findOne.mockResolvedValueOnce(localTeacher);

      const result = await processor.resolveTeacher(
        employeeCode,
        importingSchoolId,
        organizationId,
      );

      expect(result.success).toBe(true);
      expect(result.teacher).toBe(localTeacher);
      expect(result.error).toBeUndefined();
      // Should NOT query for org schools or TSA
      expect(mockSchoolRepo.find).not.toHaveBeenCalled();
      expect(mockTsaRepo.findOne).not.toHaveBeenCalled();
    });

    it('should return teacher when found in another school with active TSA (steps 2-4)', async () => {
      const crossSchoolTeacher = createMockTeacher({
        id: 'teacher-2',
        employeeCode,
        schoolId: 'school-other-id',
        fullName: 'Trần Thị B',
        school: { id: 'school-other-id', name: 'Trường THCS' } as SchoolEntity,
      });

      // Step 1: Not found in importing school
      mockTeacherRepo.findOne.mockResolvedValueOnce(null);

      // Step 2: Found in org schools
      mockSchoolRepo.find.mockResolvedValueOnce([
        { id: organizationId },
        { id: importingSchoolId },
        { id: 'school-other-id' },
      ]);
      mockTeacherRepo.findOne.mockResolvedValueOnce(crossSchoolTeacher);

      // Step 3: Active TSA exists
      mockTsaRepo.findOne.mockResolvedValueOnce({
        id: 'tsa-1',
        teacherId: crossSchoolTeacher.id,
        schoolId: importingSchoolId,
        status: AssignmentStatus.ACTIVE,
      });

      const result = await processor.resolveTeacher(
        employeeCode,
        importingSchoolId,
        organizationId,
      );

      expect(result.success).toBe(true);
      expect(result.teacher).toBe(crossSchoolTeacher);
      expect(result.error).toBeUndefined();
    });

    it('should return NO_ASSIGNMENT error when teacher found but no TSA (step 5)', async () => {
      const crossSchoolTeacher = createMockTeacher({
        id: 'teacher-3',
        employeeCode,
        schoolId: 'school-other-id',
        fullName: 'Lê Văn C',
        school: {
          id: 'school-other-id',
          name: 'Trường Tiểu học',
        } as SchoolEntity,
      });

      // Step 1: Not found in importing school
      mockTeacherRepo.findOne.mockResolvedValueOnce(null);

      // Step 2: Found in org
      mockSchoolRepo.find.mockResolvedValueOnce([
        { id: organizationId },
        { id: importingSchoolId },
        { id: 'school-other-id' },
      ]);
      mockTeacherRepo.findOne.mockResolvedValueOnce(crossSchoolTeacher);

      // Step 3: No TSA found
      mockTsaRepo.findOne.mockResolvedValueOnce(null);

      const result = await processor.resolveTeacher(
        employeeCode,
        importingSchoolId,
        organizationId,
      );

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
      expect(result.error!.code).toBe('NO_ASSIGNMENT');
      expect(result.error!.message).toContain('Lê Văn C');
      expect(result.error!.message).toContain(employeeCode);
      expect(result.error!.message).toContain('Trường Tiểu học');
      expect(result.error!.suggestion).toContain('Tạo phân công liên trường');
    });

    it('should return ASSIGNMENT_INACTIVE error when TSA exists but inactive', async () => {
      const crossSchoolTeacher = createMockTeacher({
        id: 'teacher-4',
        employeeCode,
        schoolId: 'school-other-id',
        fullName: 'Phạm Thị D',
        school: { id: 'school-other-id', name: 'Trường THPT' } as SchoolEntity,
      });

      // Step 1: Not found in importing school
      mockTeacherRepo.findOne.mockResolvedValueOnce(null);

      // Step 2: Found in org
      mockSchoolRepo.find.mockResolvedValueOnce([
        { id: organizationId },
        { id: importingSchoolId },
        { id: 'school-other-id' },
      ]);
      mockTeacherRepo.findOne.mockResolvedValueOnce(crossSchoolTeacher);

      // Step 3: TSA exists but inactive
      mockTsaRepo.findOne.mockResolvedValueOnce({
        id: 'tsa-2',
        teacherId: crossSchoolTeacher.id,
        schoolId: importingSchoolId,
        status: AssignmentStatus.INACTIVE,
      });

      const result = await processor.resolveTeacher(
        employeeCode,
        importingSchoolId,
        organizationId,
      );

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
      expect(result.error!.code).toBe('ASSIGNMENT_INACTIVE');
      expect(result.error!.message).toContain('Phạm Thị D');
      expect(result.error!.message).toContain('vô hiệu hóa');
      expect(result.error!.suggestion).toContain('Kích hoạt lại');
    });

    it('should return NOT_FOUND error when teacher not found anywhere (step 6)', async () => {
      // Step 1: Not found in importing school
      mockTeacherRepo.findOne.mockResolvedValueOnce(null);

      // Step 2: org schools exist but teacher not found
      mockSchoolRepo.find.mockResolvedValueOnce([
        { id: organizationId },
        { id: importingSchoolId },
      ]);
      mockTeacherRepo.findOne.mockResolvedValueOnce(null);

      const result = await processor.resolveTeacher(
        employeeCode,
        importingSchoolId,
        organizationId,
      );

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
      expect(result.error!.code).toBe('NOT_FOUND');
      expect(result.error!.message).toContain(employeeCode);
      expect(result.error!.message).toContain('Không tìm thấy');
    });

    it('should return NOT_FOUND when organization has no schools', async () => {
      // Step 1: Not found in importing school
      mockTeacherRepo.findOne.mockResolvedValueOnce(null);

      // Step 2: No schools in org
      mockSchoolRepo.find.mockResolvedValueOnce([]);

      const result = await processor.resolveTeacher(
        employeeCode,
        importingSchoolId,
        organizationId,
      );

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
      expect(result.error!.code).toBe('NOT_FOUND');
      expect(result.error!.message).toContain(employeeCode);
    });
  });
});

function createMockTeacher(
  overrides: Partial<TeacherEntity> = {},
): TeacherEntity {
  return {
    id: 'teacher-default-id',
    schoolId: 'school-default-id',
    employeeCode: 'GV000',
    fullName: 'Test Teacher',
    shortName: null,
    citizenId: null,
    gender: null,
    dateOfBirth: null,
    phone: null,
    email: null,
    gradeId: null,
    departmentId: null,
    jobTitle: null,
    managementLevel: null,
    position: null,
    teacherType: 'FULL_TIME' as any,
    maxPeriodsPerWeek: 20,
    minPeriodsPerWeek: 0,
    maxPeriodsPerDay: 6,
    unavailableSlots: null,
    status: 'ACTIVE' as any,
    createdAt: new Date(),
    updatedAt: new Date(),
    deletedAt: null,
    ...overrides,
  } as TeacherEntity;
}
