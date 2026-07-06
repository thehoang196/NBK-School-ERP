import { Test, TestingModule } from '@nestjs/testing';
import { TenantHealthController } from './tenant-health.controller';
import {
  TenantRlsService,
  RlsHealthCheckResult,
} from '../../common/tenant/tenant-rls.service';

describe('TenantHealthController', () => {
  let controller: TenantHealthController;
  let tenantRlsService: jest.Mocked<TenantRlsService>;

  beforeEach(async () => {
    const mockTenantRlsService = {
      verifyRlsPolicies: jest.fn(),
      setSessionSchoolId: jest.fn(),
      clearSessionSchoolId: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [TenantHealthController],
      providers: [
        {
          provide: TenantRlsService,
          useValue: mockTenantRlsService,
        },
      ],
    }).compile();

    controller = module.get<TenantHealthController>(TenantHealthController);
    tenantRlsService = module.get(TenantRlsService);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('checkTenantHealth', () => {
    it('should return healthy result when all tables have RLS', async () => {
      const healthyResult: RlsHealthCheckResult = {
        healthy: true,
        tablesChecked: 24,
        tablesWithRls: 24,
        tablesMissingRls: [],
        checkedAt: new Date('2024-01-01T00:00:00Z'),
      };

      tenantRlsService.verifyRlsPolicies.mockResolvedValue(healthyResult);

      const result = await controller.checkTenantHealth();

      expect(result).toEqual(healthyResult);
      expect(tenantRlsService.verifyRlsPolicies).toHaveBeenCalledTimes(1);
    });

    it('should return unhealthy result when tables are missing RLS', async () => {
      const unhealthyResult: RlsHealthCheckResult = {
        healthy: false,
        tablesChecked: 24,
        tablesWithRls: 22,
        tablesMissingRls: ['campuses', 'teachers'],
        checkedAt: new Date('2024-01-01T00:00:00Z'),
      };

      tenantRlsService.verifyRlsPolicies.mockResolvedValue(unhealthyResult);

      const result = await controller.checkTenantHealth();

      expect(result).toEqual(unhealthyResult);
      expect(result.healthy).toBe(false);
      expect(result.tablesMissingRls).toContain('campuses');
      expect(result.tablesMissingRls).toContain('teachers');
    });

    it('should return error result when health check fails', async () => {
      const errorResult: RlsHealthCheckResult = {
        healthy: false,
        tablesChecked: 24,
        tablesWithRls: 0,
        tablesMissingRls: [
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
        ],
        checkedAt: new Date('2024-01-01T00:00:00Z'),
      };

      tenantRlsService.verifyRlsPolicies.mockResolvedValue(errorResult);

      const result = await controller.checkTenantHealth();

      expect(result.healthy).toBe(false);
      expect(result.tablesWithRls).toBe(0);
      expect(result.tablesMissingRls.length).toBe(23);
    });
  });
});
