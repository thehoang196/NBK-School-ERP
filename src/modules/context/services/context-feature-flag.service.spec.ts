import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { ContextFeatureFlagService } from './context-feature-flag.service';

describe('ContextFeatureFlagService', () => {
  let service: ContextFeatureFlagService;
  let configService: ConfigService;

  const mockConfigService = {
    get: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ContextFeatureFlagService,
        { provide: ConfigService, useValue: mockConfigService },
      ],
    }).compile();

    service = module.get<ContextFeatureFlagService>(ContextFeatureFlagService);
    configService = module.get<ConfigService>(ConfigService);
    jest.clearAllMocks();
  });

  describe('isContextSwitcherEnabled', () => {
    it('should return true when CONTEXT_SWITCHER_ENABLED is "true"', () => {
      mockConfigService.get.mockReturnValue('true');
      expect(service.isContextSwitcherEnabled()).toBe(true);
    });

    it('should return true when CONTEXT_SWITCHER_ENABLED is "TRUE" (case-insensitive)', () => {
      mockConfigService.get.mockReturnValue('TRUE');
      expect(service.isContextSwitcherEnabled()).toBe(true);
    });

    it('should return false when CONTEXT_SWITCHER_ENABLED is "false"', () => {
      mockConfigService.get.mockReturnValue('false');
      expect(service.isContextSwitcherEnabled()).toBe(false);
    });

    it('should return false when CONTEXT_SWITCHER_ENABLED is "FALSE" (case-insensitive)', () => {
      mockConfigService.get.mockReturnValue('FALSE');
      expect(service.isContextSwitcherEnabled()).toBe(false);
    });

    it('should default to true when env variable is not set', () => {
      mockConfigService.get.mockImplementation(
        (key: string, defaultValue?: string) => defaultValue,
      );
      expect(service.isContextSwitcherEnabled()).toBe(true);
    });

    it('should return false for any non-"true" value', () => {
      mockConfigService.get.mockReturnValue('disabled');
      expect(service.isContextSwitcherEnabled()).toBe(false);
    });
  });

  describe('isEnabledForSchool', () => {
    const schoolId1 = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890';
    const schoolId2 = 'b2c3d4e5-f6a7-8901-bcde-f12345678901';
    const schoolId3 = 'c3d4e5f6-a7b8-9012-cdef-123456789012';

    it('should return true when global flag is enabled and school is not in disabled list', () => {
      mockConfigService.get.mockImplementation(
        (key: string, defaultValue?: string) => {
          if (key === 'CONTEXT_SWITCHER_ENABLED') return 'true';
          if (key === 'CONTEXT_SWITCHER_DISABLED_SCHOOLS') return schoolId2;
          return defaultValue;
        },
      );

      expect(service.isEnabledForSchool(schoolId1)).toBe(true);
    });

    it('should return false when global flag is disabled', () => {
      mockConfigService.get.mockImplementation(
        (key: string, defaultValue?: string) => {
          if (key === 'CONTEXT_SWITCHER_ENABLED') return 'false';
          if (key === 'CONTEXT_SWITCHER_DISABLED_SCHOOLS') return '';
          return defaultValue;
        },
      );

      expect(service.isEnabledForSchool(schoolId1)).toBe(false);
    });

    it('should return false when school is in disabled list', () => {
      mockConfigService.get.mockImplementation(
        (key: string, defaultValue?: string) => {
          if (key === 'CONTEXT_SWITCHER_ENABLED') return 'true';
          if (key === 'CONTEXT_SWITCHER_DISABLED_SCHOOLS')
            return `${schoolId1},${schoolId2}`;
          return defaultValue;
        },
      );

      expect(service.isEnabledForSchool(schoolId1)).toBe(false);
      expect(service.isEnabledForSchool(schoolId2)).toBe(false);
    });

    it('should return true when disabled schools list is empty', () => {
      mockConfigService.get.mockImplementation(
        (key: string, defaultValue?: string) => {
          if (key === 'CONTEXT_SWITCHER_ENABLED') return 'true';
          if (key === 'CONTEXT_SWITCHER_DISABLED_SCHOOLS') return '';
          return defaultValue;
        },
      );

      expect(service.isEnabledForSchool(schoolId1)).toBe(true);
    });

    it('should handle whitespace in disabled schools list', () => {
      mockConfigService.get.mockImplementation(
        (key: string, defaultValue?: string) => {
          if (key === 'CONTEXT_SWITCHER_ENABLED') return 'true';
          if (key === 'CONTEXT_SWITCHER_DISABLED_SCHOOLS')
            return ` ${schoolId1} , ${schoolId2} `;
          return defaultValue;
        },
      );

      expect(service.isEnabledForSchool(schoolId1)).toBe(false);
      expect(service.isEnabledForSchool(schoolId3)).toBe(true);
    });

    it('should return true when CONTEXT_SWITCHER_DISABLED_SCHOOLS env is not set', () => {
      mockConfigService.get.mockImplementation(
        (key: string, defaultValue?: string) => {
          if (key === 'CONTEXT_SWITCHER_ENABLED') return 'true';
          if (key === 'CONTEXT_SWITCHER_DISABLED_SCHOOLS') return defaultValue;
          return defaultValue;
        },
      );

      expect(service.isEnabledForSchool(schoolId1)).toBe(true);
    });
  });
});
