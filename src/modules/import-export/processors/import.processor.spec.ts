import { ImportProcessor, validatePositiveNumber } from './import.processor';

/**
 * Unit tests cho ImportProcessor.getTeacherColumnMappings()
 * Validates: Requirements 2.1, 2.6, 2.7
 */
describe('ImportProcessor', () => {
  let processor: ImportProcessor;

  beforeEach(() => {
    processor = new ImportProcessor();
  });

  describe('getTeacherColumnMappings()', () => {
    it('should return exactly 9 column mappings', () => {
      const mappings = processor.getTeacherColumnMappings();
      expect(mappings).toHaveLength(9);
    });

    it('should return the correct headers in order', () => {
      const mappings = processor.getTeacherColumnMappings();
      const headers = mappings.map((m) => m.header);

      expect(headers).toEqual([
        'Mã NV',
        'Họ và Tên',
        'Tên gọi',
        'Khối',
        'Tổ bộ môn',
        'Chức danh/chức vụ',
        'Cấp bậc quản lý',
        'Giới tính',
        'Max tiết/tuần',
      ]);
    });

    it('should return the correct field names in order', () => {
      const mappings = processor.getTeacherColumnMappings();
      const fields = mappings.map((m) => m.field);

      expect(fields).toEqual([
        'employeeCode',
        'fullName',
        'shortName',
        'gradeName',
        'departmentName',
        'jobTitle',
        'managementLevel',
        'gender',
        'maxPeriodsPerWeek',
      ]);
    });

    it('should have only fullName as required', () => {
      const mappings = processor.getTeacherColumnMappings();
      const requiredFields = mappings.filter((m) => m.required);

      expect(requiredFields).toHaveLength(1);
      expect(requiredFields[0].field).toBe('fullName');
    });

    it('should have a validator assigned to maxPeriodsPerWeek mapping', () => {
      const mappings = processor.getTeacherColumnMappings();
      const maxPeriodsMapping = mappings.find(
        (m) => m.field === 'maxPeriodsPerWeek',
      );

      expect(maxPeriodsMapping).toBeDefined();
      expect(maxPeriodsMapping!.validator).toBeDefined();
      expect(typeof maxPeriodsMapping!.validator).toBe('function');
    });
  });

  describe('validatePositiveNumber()', () => {
    it('should accept 0 as valid', () => {
      expect(validatePositiveNumber(0)).toBeNull();
    });

    it('should accept positive integers as valid', () => {
      expect(validatePositiveNumber(5)).toBeNull();
      expect(validatePositiveNumber(20)).toBeNull();
    });

    it('should reject negative numbers', () => {
      expect(validatePositiveNumber(-1)).toBe('Giá trị phải là số không âm');
    });

    it('should reject non-integer numbers', () => {
      expect(validatePositiveNumber(3.5)).toBe('Giá trị phải là số không âm');
    });

    it('should reject non-numeric strings', () => {
      expect(validatePositiveNumber('abc')).toBe('Giá trị phải là số không âm');
    });

    it('should reject NaN', () => {
      expect(validatePositiveNumber(NaN)).toBe('Giá trị phải là số không âm');
    });
  });
});
