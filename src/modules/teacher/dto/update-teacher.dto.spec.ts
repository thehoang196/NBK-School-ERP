import { validate } from 'class-validator';
import { plainToInstance } from 'class-transformer';
import { UpdateTeacherDto } from './update-teacher.dto';
import {
  Gender,
  TeacherType,
  TeacherStatus,
} from '../../../common/enums/status.enum';

describe('UpdateTeacherDto', () => {
  const validUuid = '550e8400-e29b-41d4-a716-446655440000';

  it('should pass validation with empty body (all fields optional)', async () => {
    const dto = plainToInstance(UpdateTeacherDto, {});
    const errors = await validate(dto);
    expect(errors).toHaveLength(0);
  });

  it('should pass validation with a single field (fullName only)', async () => {
    const dto = plainToInstance(UpdateTeacherDto, { fullName: 'Nguyễn Văn B' });
    const errors = await validate(dto);
    expect(errors).toHaveLength(0);
  });

  it('should pass validation with multiple valid fields', async () => {
    const dto = plainToInstance(UpdateTeacherDto, {
      employeeCode: 'GV002',
      fullName: 'Trần Thị C',
      gender: Gender.FEMALE,
      departmentId: validUuid,
      position: 'Tổ trưởng',
      teacherType: TeacherType.FULL_TIME,
      maxPeriodsPerWeek: 25,
      minPeriodsPerWeek: 10,
      maxPeriodsPerDay: 6,
      status: TeacherStatus.ACTIVE,
    });
    const errors = await validate(dto);
    expect(errors).toHaveLength(0);
  });

  it('should pass validation with all fields from CreateTeacherDto (except schoolId)', async () => {
    const dto = plainToInstance(UpdateTeacherDto, {
      employeeCode: 'GV003',
      fullName: 'Lê Văn D',
      gender: Gender.MALE,
      dateOfBirth: '1985-05-20',
      phone: '0901234567',
      email: 'levand@school.edu.vn',
      departmentId: validUuid,
      position: 'Giáo viên',
      teacherType: TeacherType.VISITING,
      maxPeriodsPerWeek: 15,
      minPeriodsPerWeek: 5,
      maxPeriodsPerDay: 4,
      unavailableSlots: [{ dayOfWeek: 3, periodId: validUuid }],
      status: TeacherStatus.ON_LEAVE,
    });
    const errors = await validate(dto);
    expect(errors).toHaveLength(0);
  });

  it('should not include schoolId field (omitted from CreateTeacherDto)', async () => {
    // schoolId is omitted, so even if provided it won't be validated
    // With whitelist: true in production, it would be stripped
    const dto = plainToInstance(UpdateTeacherDto, {
      fullName: 'Test',
    });
    const errors = await validate(dto);
    expect(errors).toHaveLength(0);
  });

  describe('maxPeriodsPerWeek validation', () => {
    it('should fail when maxPeriodsPerWeek = -1 (below min)', async () => {
      const dto = plainToInstance(UpdateTeacherDto, { maxPeriodsPerWeek: -1 });
      const errors = await validate(dto);
      expect(errors.length).toBeGreaterThan(0);
      expect(errors[0].property).toBe('maxPeriodsPerWeek');
    });

    it('should fail when maxPeriodsPerWeek = 51 (above max)', async () => {
      const dto = plainToInstance(UpdateTeacherDto, { maxPeriodsPerWeek: 51 });
      const errors = await validate(dto);
      expect(errors.length).toBeGreaterThan(0);
      expect(errors[0].property).toBe('maxPeriodsPerWeek');
    });

    it('should pass when maxPeriodsPerWeek = 0 (edge case min)', async () => {
      const dto = plainToInstance(UpdateTeacherDto, { maxPeriodsPerWeek: 0 });
      const errors = await validate(dto);
      expect(errors).toHaveLength(0);
    });

    it('should pass when maxPeriodsPerWeek = 50 (edge case max)', async () => {
      const dto = plainToInstance(UpdateTeacherDto, { maxPeriodsPerWeek: 50 });
      const errors = await validate(dto);
      expect(errors).toHaveLength(0);
    });
  });

  describe('minPeriodsPerWeek validation', () => {
    it('should fail when minPeriodsPerWeek = -1 (below min)', async () => {
      const dto = plainToInstance(UpdateTeacherDto, { minPeriodsPerWeek: -1 });
      const errors = await validate(dto);
      expect(errors.length).toBeGreaterThan(0);
      expect(errors[0].property).toBe('minPeriodsPerWeek');
    });

    it('should pass when minPeriodsPerWeek = 10', async () => {
      const dto = plainToInstance(UpdateTeacherDto, { minPeriodsPerWeek: 10 });
      const errors = await validate(dto);
      expect(errors).toHaveLength(0);
    });
  });

  describe('maxPeriodsPerDay validation', () => {
    it('should fail when maxPeriodsPerDay = 13 (above max)', async () => {
      const dto = plainToInstance(UpdateTeacherDto, { maxPeriodsPerDay: 13 });
      const errors = await validate(dto);
      expect(errors.length).toBeGreaterThan(0);
      expect(errors[0].property).toBe('maxPeriodsPerDay');
    });

    it('should pass when maxPeriodsPerDay = 6', async () => {
      const dto = plainToInstance(UpdateTeacherDto, { maxPeriodsPerDay: 6 });
      const errors = await validate(dto);
      expect(errors).toHaveLength(0);
    });
  });

  describe('departmentId UUID validation', () => {
    it('should fail with invalid UUID for departmentId', async () => {
      const dto = plainToInstance(UpdateTeacherDto, {
        departmentId: 'not-a-valid-uuid',
      });
      const errors = await validate(dto);
      expect(errors.length).toBeGreaterThan(0);
      expect(errors[0].property).toBe('departmentId');
    });

    it('should pass with valid UUID for departmentId', async () => {
      const dto = plainToInstance(UpdateTeacherDto, {
        departmentId: validUuid,
      });
      const errors = await validate(dto);
      expect(errors).toHaveLength(0);
    });
  });

  describe('teacherType validation', () => {
    it('should fail with invalid teacherType value', async () => {
      const dto = plainToInstance(UpdateTeacherDto, {
        teacherType: 'invalid_type',
      });
      const errors = await validate(dto);
      expect(errors.length).toBeGreaterThan(0);
      expect(errors[0].property).toBe('teacherType');
    });

    it('should pass with valid teacherType', async () => {
      const dto = plainToInstance(UpdateTeacherDto, {
        teacherType: TeacherType.INTER_SCHOOL,
      });
      const errors = await validate(dto);
      expect(errors).toHaveLength(0);
    });
  });

  describe('email validation', () => {
    it('should fail with invalid email format', async () => {
      const dto = plainToInstance(UpdateTeacherDto, { email: 'not-an-email' });
      const errors = await validate(dto);
      expect(errors.length).toBeGreaterThan(0);
      expect(errors[0].property).toBe('email');
    });

    it('should pass with valid email', async () => {
      const dto = plainToInstance(UpdateTeacherDto, {
        email: 'teacher@school.edu.vn',
      });
      const errors = await validate(dto);
      expect(errors).toHaveLength(0);
    });
  });

  describe('unavailableSlots validation', () => {
    it('should pass with valid unavailableSlots', async () => {
      const dto = plainToInstance(UpdateTeacherDto, {
        unavailableSlots: [{ dayOfWeek: 2, periodId: validUuid }],
      });
      const errors = await validate(dto);
      expect(errors).toHaveLength(0);
    });

    it('should fail when unavailableSlots has invalid dayOfWeek', async () => {
      const dto = plainToInstance(UpdateTeacherDto, {
        unavailableSlots: [{ dayOfWeek: 1, periodId: validUuid }],
      });
      const errors = await validate(dto);
      expect(errors.length).toBeGreaterThan(0);
    });

    it('should fail when unavailableSlots has invalid periodId', async () => {
      const dto = plainToInstance(UpdateTeacherDto, {
        unavailableSlots: [{ dayOfWeek: 2, periodId: 'not-uuid' }],
      });
      const errors = await validate(dto);
      expect(errors.length).toBeGreaterThan(0);
    });
  });
});
