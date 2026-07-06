import { validate } from 'class-validator';
import { plainToInstance } from 'class-transformer';
import { CreateTeacherDto } from './create-teacher.dto';
import {
  Gender,
  TeacherType,
  TeacherStatus,
} from '../../../common/enums/status.enum';

describe('CreateTeacherDto', () => {
  const validUuid = '550e8400-e29b-41d4-a716-446655440000';

  function createValidDto(): Partial<CreateTeacherDto> {
    return {
      schoolId: validUuid,
      employeeCode: 'GV001',
      fullName: 'Nguyễn Văn A',
    };
  }

  describe('Valid DTO', () => {
    it('should pass validation with only required fields (schoolId, employeeCode, fullName)', async () => {
      const dto = plainToInstance(CreateTeacherDto, createValidDto());
      const errors = await validate(dto);
      expect(errors).toHaveLength(0);
    });

    it('should pass validation with all fields', async () => {
      const dto = plainToInstance(CreateTeacherDto, {
        schoolId: validUuid,
        employeeCode: 'GV001',
        fullName: 'Nguyễn Văn A',
        gender: Gender.MALE,
        dateOfBirth: '1990-01-15',
        phone: '0912345678',
        email: 'nguyenvana@school.edu.vn',
        departmentId: validUuid,
        position: 'Tổ trưởng',
        teacherType: TeacherType.FULL_TIME,
        maxPeriodsPerWeek: 20,
        minPeriodsPerWeek: 10,
        maxPeriodsPerDay: 6,
        unavailableSlots: [{ dayOfWeek: 2, periodId: validUuid }],
        status: TeacherStatus.ACTIVE,
      });
      const errors = await validate(dto);
      expect(errors).toHaveLength(0);
    });
  });

  describe('Required fields validation', () => {
    it('should fail when employeeCode is missing', async () => {
      const data = createValidDto();
      delete data.employeeCode;
      const dto = plainToInstance(CreateTeacherDto, data);
      const errors = await validate(dto);
      expect(errors.length).toBeGreaterThan(0);
      expect(errors.some((e) => e.property === 'employeeCode')).toBe(true);
    });

    it('should fail when fullName is missing', async () => {
      const data = createValidDto();
      delete data.fullName;
      const dto = plainToInstance(CreateTeacherDto, data);
      const errors = await validate(dto);
      expect(errors.length).toBeGreaterThan(0);
      expect(errors.some((e) => e.property === 'fullName')).toBe(true);
    });

    it('should fail when schoolId is missing', async () => {
      const data = createValidDto();
      delete data.schoolId;
      const dto = plainToInstance(CreateTeacherDto, data);
      const errors = await validate(dto);
      expect(errors.length).toBeGreaterThan(0);
      expect(errors.some((e) => e.property === 'schoolId')).toBe(true);
    });
  });

  describe('UUID validation', () => {
    it('should fail when schoolId is not a valid UUID', async () => {
      const dto = plainToInstance(CreateTeacherDto, {
        ...createValidDto(),
        schoolId: 'not-a-valid-uuid',
      });
      const errors = await validate(dto);
      expect(errors.length).toBeGreaterThan(0);
      expect(errors.some((e) => e.property === 'schoolId')).toBe(true);
    });

    it('should fail when departmentId is not a valid UUID', async () => {
      const dto = plainToInstance(CreateTeacherDto, {
        ...createValidDto(),
        departmentId: 'not-valid',
      });
      const errors = await validate(dto);
      expect(errors.length).toBeGreaterThan(0);
      expect(errors.some((e) => e.property === 'departmentId')).toBe(true);
    });
  });

  describe('maxPeriodsPerWeek range validation', () => {
    it('should fail when maxPeriodsPerWeek is -1 (below min 0)', async () => {
      const dto = plainToInstance(CreateTeacherDto, {
        ...createValidDto(),
        maxPeriodsPerWeek: -1,
      });
      const errors = await validate(dto);
      expect(errors.length).toBeGreaterThan(0);
      expect(errors.some((e) => e.property === 'maxPeriodsPerWeek')).toBe(true);
    });

    it('should fail when maxPeriodsPerWeek is 51 (above max 50)', async () => {
      const dto = plainToInstance(CreateTeacherDto, {
        ...createValidDto(),
        maxPeriodsPerWeek: 51,
      });
      const errors = await validate(dto);
      expect(errors.length).toBeGreaterThan(0);
      expect(errors.some((e) => e.property === 'maxPeriodsPerWeek')).toBe(true);
    });

    it('should pass when maxPeriodsPerWeek is 25 (within range)', async () => {
      const dto = plainToInstance(CreateTeacherDto, {
        ...createValidDto(),
        maxPeriodsPerWeek: 25,
      });
      const errors = await validate(dto);
      expect(errors).toHaveLength(0);
    });
  });

  describe('minPeriodsPerWeek range validation', () => {
    it('should fail when minPeriodsPerWeek is -1', async () => {
      const dto = plainToInstance(CreateTeacherDto, {
        ...createValidDto(),
        minPeriodsPerWeek: -1,
      });
      const errors = await validate(dto);
      expect(errors.length).toBeGreaterThan(0);
      expect(errors.some((e) => e.property === 'minPeriodsPerWeek')).toBe(true);
    });

    it('should pass when minPeriodsPerWeek is 10', async () => {
      const dto = plainToInstance(CreateTeacherDto, {
        ...createValidDto(),
        minPeriodsPerWeek: 10,
      });
      const errors = await validate(dto);
      expect(errors).toHaveLength(0);
    });
  });

  describe('maxPeriodsPerDay range validation', () => {
    it('should fail when maxPeriodsPerDay is 13 (above max 12)', async () => {
      const dto = plainToInstance(CreateTeacherDto, {
        ...createValidDto(),
        maxPeriodsPerDay: 13,
      });
      const errors = await validate(dto);
      expect(errors.length).toBeGreaterThan(0);
      expect(errors.some((e) => e.property === 'maxPeriodsPerDay')).toBe(true);
    });

    it('should pass when maxPeriodsPerDay is 6', async () => {
      const dto = plainToInstance(CreateTeacherDto, {
        ...createValidDto(),
        maxPeriodsPerDay: 6,
      });
      const errors = await validate(dto);
      expect(errors).toHaveLength(0);
    });
  });

  describe('email validation', () => {
    it('should fail when email format is invalid', async () => {
      const dto = plainToInstance(CreateTeacherDto, {
        ...createValidDto(),
        email: 'not-an-email',
      });
      const errors = await validate(dto);
      expect(errors.length).toBeGreaterThan(0);
      expect(errors.some((e) => e.property === 'email')).toBe(true);
    });

    it('should pass with a valid email', async () => {
      const dto = plainToInstance(CreateTeacherDto, {
        ...createValidDto(),
        email: 'teacher@school.edu.vn',
      });
      const errors = await validate(dto);
      expect(errors).toHaveLength(0);
    });
  });

  describe('unavailableSlots validation', () => {
    it('should pass with valid unavailableSlots array', async () => {
      const dto = plainToInstance(CreateTeacherDto, {
        ...createValidDto(),
        unavailableSlots: [
          { dayOfWeek: 2, periodId: validUuid },
          { dayOfWeek: 6, periodId: validUuid },
        ],
      });
      const errors = await validate(dto);
      expect(errors).toHaveLength(0);
    });

    it('should fail when unavailableSlots has invalid dayOfWeek', async () => {
      const dto = plainToInstance(CreateTeacherDto, {
        ...createValidDto(),
        unavailableSlots: [{ dayOfWeek: 1, periodId: validUuid }],
      });
      const errors = await validate(dto);
      expect(errors.length).toBeGreaterThan(0);
    });

    it('should fail when unavailableSlots has invalid periodId', async () => {
      const dto = plainToInstance(CreateTeacherDto, {
        ...createValidDto(),
        unavailableSlots: [{ dayOfWeek: 2, periodId: 'not-uuid' }],
      });
      const errors = await validate(dto);
      expect(errors.length).toBeGreaterThan(0);
    });
  });

  describe('teacherType validation', () => {
    it('should pass with valid teacherType enum value', async () => {
      const dto = plainToInstance(CreateTeacherDto, {
        ...createValidDto(),
        teacherType: TeacherType.VISITING,
      });
      const errors = await validate(dto);
      expect(errors).toHaveLength(0);
    });

    it('should fail with invalid teacherType value', async () => {
      const dto = plainToInstance(CreateTeacherDto, {
        ...createValidDto(),
        teacherType: 'invalid_type',
      });
      const errors = await validate(dto);
      expect(errors.length).toBeGreaterThan(0);
      expect(errors.some((e) => e.property === 'teacherType')).toBe(true);
    });
  });
});
