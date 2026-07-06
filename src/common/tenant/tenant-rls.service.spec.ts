import { Test, TestingModule } from '@nestjs/testing';
import { DataSource } from 'typeorm';

import { TenantRlsService, RlsHealthCheckResult } from './tenant-rls.service';

describe('TenantRlsService', () => {
  let service: TenantRlsService;
  let mockDataSource: jest.Mocked<Pick<DataSource, 'query'>>;

  beforeEach(async () => {
    mockDataSource = {
      query: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TenantRlsService,
        { provide: DataSource, useValue: mockDataSource },
      ],
    }).compile();

    service = module.get<TenantRlsService>(TenantRlsService);
  });

  describe('setSessionSchoolId', () => {
    it('should execute SET LOCAL with the provided schoolId', async () => {
      const schoolId = '550e8400-e29b-41d4-a716-446655440000';
      mockDataSource.query.mockResolvedValue(undefined);

      await service.setSessionSchoolId(schoolId);

      expect(mockDataSource.query).toHaveBeenCalledWith(
        `SET LOCAL app.current_school_id = '${schoolId}'`,
      );
    });

    it('should execute SET LOCAL with BYPASS for super admin mode', async () => {
      mockDataSource.query.mockResolvedValue(undefined);

      await service.setSessionSchoolId('BYPASS');

      expect(mockDataSource.query).toHaveBeenCalledWith(
        `SET LOCAL app.current_school_id = 'BYPASS'`,
      );
    });
  });

  describe('clearSessionSchoolId', () => {
    it('should execute RESET on the session variable', async () => {
      mockDataSource.query.mockResolvedValue(undefined);

      await service.clearSessionSchoolId();

      expect(mockDataSource.query).toHaveBeenCalledWith(
        'RESET app.current_school_id',
      );
    });
  });

  describe('verifyRlsPolicies', () => {
    it('should return healthy when all tables have RLS enabled', async () => {
      const allTables = [
        'campuses',
        'academic_years',
        'semesters',
        'weeks',
        'sessions',
        'period_definitions',
        'grades',
        'classes',
        'teachers',
        'subjects',
        'rooms',
        'departments',
        'subject_grades',
        'timetable_versions',
        'timetable_slots',
        'actual_timetable_slots',
        'teaching_assignments',
        'events',
        'pay_components',
        'compensation_variables',
        'formulas',
        'compensation_rules',
        'pay_periods',
      ];
      mockDataSource.query.mockResolvedValue(
        allTables.map((t) => ({ tablename: t })),
      );

      const result: RlsHealthCheckResult = await service.verifyRlsPolicies();

      expect(result.healthy).toBe(true);
      expect(result.tablesChecked).toBe(23);
      expect(result.tablesWithRls).toBe(23);
      expect(result.tablesMissingRls).toEqual([]);
      expect(result.checkedAt).toBeInstanceOf(Date);
    });

    it('should return unhealthy when some tables are missing RLS', async () => {
      mockDataSource.query.mockResolvedValue([
        { tablename: 'campuses' },
        { tablename: 'teachers' },
      ]);

      const result: RlsHealthCheckResult = await service.verifyRlsPolicies();

      expect(result.healthy).toBe(false);
      expect(result.tablesChecked).toBe(23);
      expect(result.tablesWithRls).toBe(2);
      expect(result.tablesMissingRls).toContain('academic_years');
      expect(result.tablesMissingRls).toContain('subjects');
      expect(result.tablesMissingRls).not.toContain('campuses');
      expect(result.tablesMissingRls).not.toContain('teachers');
    });

    it('should return unhealthy with all tables missing when query fails', async () => {
      mockDataSource.query.mockRejectedValue(new Error('Connection error'));

      const result: RlsHealthCheckResult = await service.verifyRlsPolicies();

      expect(result.healthy).toBe(false);
      expect(result.tablesChecked).toBe(23);
      expect(result.tablesWithRls).toBe(0);
      expect(result.tablesMissingRls.length).toBe(23);
      expect(result.checkedAt).toBeInstanceOf(Date);
    });
  });
});
