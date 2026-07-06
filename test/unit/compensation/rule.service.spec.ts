import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { RuleService } from '../../../src/modules/compensation/services/rule.service';
import { RuleEvaluator } from '../../../src/modules/compensation/services/rule-evaluator';
import { RuleRepository } from '../../../src/modules/compensation/repositories/rule.repository';
import { AuditLogRepository } from '../../../src/modules/compensation/repositories/audit-log.repository';
import { RuleActionType } from '../../../src/modules/compensation/enums';
import { EntityStatus } from '../../../src/modules/compensation/enums/../../../common/enums/status.enum';
import { RuleCondition } from '../../../src/modules/compensation/interfaces';

describe('RuleService', () => {
  let service: RuleService;
  let ruleRepository: jest.Mocked<RuleRepository>;
  let auditLogRepository: jest.Mocked<AuditLogRepository>;

  const mockRule = {
    id: '550e8400-e29b-41d4-a716-446655440010',
    schoolId: 'school-1',
    name: 'Đơn giá IELTS',
    conditions: [
      { field: 'subject', operator: '==', value: 'IELTS' },
      { field: 'school_level', operator: '==', value: 'THPT', logicOp: 'AND' },
    ] as RuleCondition[],
    actionType: RuleActionType.SET_VARIABLE,
    actionTarget: 'LESSON_RATE',
    actionValue: '350000',
    priority: 10,
    status: EntityStatus.ACTIVE,
    createdAt: new Date(),
    updatedAt: new Date(),
    deletedAt: null,
  };

  beforeEach(async () => {
    const mockRuleRepo = {
      findAll: jest.fn(),
      findById: jest.fn(),
      findActiveBySchool: jest.fn(),
      findByPriorityAndSchool: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      softDelete: jest.fn(),
    };

    const mockAuditLogRepo = {
      create: jest.fn(),
      findByEntity: jest.fn(),
      findByEntityType: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RuleService,
        { provide: RuleRepository, useValue: mockRuleRepo },
        { provide: AuditLogRepository, useValue: mockAuditLogRepo },
      ],
    }).compile();

    service = module.get<RuleService>(RuleService);
    ruleRepository = module.get(RuleRepository);
    auditLogRepository = module.get(AuditLogRepository);
  });

  describe('findAll', () => {
    it('should return paginated rules', async () => {
      ruleRepository.findAll.mockResolvedValue([[mockRule as any], 1]);

      const result = await service.findAll({
        page: 1,
        limit: 10,
        sortOrder: 'ASC',
      });

      expect(result.success).toBe(true);
      expect(result.data).toHaveLength(1);
      expect(result.meta.total).toBe(1);
    });
  });

  describe('findById', () => {
    it('should return rule by id', async () => {
      ruleRepository.findById.mockResolvedValue(mockRule as any);
      const result = await service.findById(mockRule.id);
      expect(result.name).toBe('Đơn giá IELTS');
    });

    it('should throw NotFoundException', async () => {
      ruleRepository.findById.mockResolvedValue(null);
      await expect(service.findById('nonexistent')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('create', () => {
    it('should create rule and detect conflicts', async () => {
      ruleRepository.findByPriorityAndSchool.mockResolvedValue([]);
      ruleRepository.create.mockResolvedValue(mockRule as any);

      const result = await service.create({
        schoolId: 'school-1',
        name: 'Đơn giá IELTS',
        conditions: [{ field: 'subject', operator: '==', value: 'IELTS' }],
        actionType: RuleActionType.SET_VARIABLE,
        actionTarget: 'LESSON_RATE',
        actionValue: '350000',
        priority: 10,
      });

      expect(result.rule.name).toBe('Đơn giá IELTS');
      expect(result.warnings).toHaveLength(0);
    });

    it('should return warnings when conflicts exist', async () => {
      ruleRepository.findByPriorityAndSchool.mockResolvedValue([
        mockRule as any,
      ]);
      ruleRepository.create.mockResolvedValue(mockRule as any);

      const result = await service.create({
        schoolId: 'school-1',
        name: 'Another IELTS rule',
        conditions: [{ field: 'subject', operator: '==', value: 'TOEFL' }],
        actionType: RuleActionType.SET_VARIABLE,
        actionTarget: 'LESSON_RATE',
        actionValue: '400000',
        priority: 10,
      });

      expect(result.warnings.length).toBeGreaterThan(0);
    });
  });
});

describe('RuleEvaluator', () => {
  let evaluator: RuleEvaluator;
  let ruleRepository: jest.Mocked<RuleRepository>;

  const activeRules = [
    {
      id: 'rule-1',
      schoolId: 'school-1',
      name: 'IELTS THPT rate',
      conditions: [
        { field: 'subject', operator: '==', value: 'IELTS' },
        {
          field: 'school_level',
          operator: '==',
          value: 'THPT',
          logicOp: 'AND',
        },
      ] as RuleCondition[],
      actionType: RuleActionType.SET_VARIABLE,
      actionTarget: 'LESSON_RATE',
      actionValue: '350000',
      priority: 10,
      status: EntityStatus.ACTIVE,
    },
    {
      id: 'rule-2',
      schoolId: 'school-1',
      name: 'Default THPT rate',
      conditions: [
        { field: 'school_level', operator: '==', value: 'THPT' },
      ] as RuleCondition[],
      actionType: RuleActionType.SET_VARIABLE,
      actionTarget: 'LESSON_RATE',
      actionValue: '200000',
      priority: 5,
      status: EntityStatus.ACTIVE,
    },
  ];

  beforeEach(async () => {
    const mockRuleRepo = {
      findAll: jest.fn(),
      findById: jest.fn(),
      findActiveBySchool: jest.fn(),
      findByPriorityAndSchool: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      softDelete: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RuleEvaluator,
        { provide: RuleRepository, useValue: mockRuleRepo },
      ],
    }).compile();

    evaluator = module.get<RuleEvaluator>(RuleEvaluator);
    ruleRepository = module.get(RuleRepository);
  });

  describe('evaluate', () => {
    it('should return matched rules sorted by priority', async () => {
      ruleRepository.findActiveBySchool.mockResolvedValue(activeRules as any);

      const results = await evaluator.evaluate('school-1', {
        schoolId: 'school-1',
        schoolLevel: 'THPT',
        subject: 'IELTS',
      });

      expect(results).toHaveLength(2);
      expect(results[0].ruleName).toBe('IELTS THPT rate');
      expect(results[0].priority).toBe(10);
      expect(results[1].ruleName).toBe('Default THPT rate');
    });

    it('should not match rules with unmet conditions', async () => {
      ruleRepository.findActiveBySchool.mockResolvedValue(activeRules as any);

      const results = await evaluator.evaluate('school-1', {
        schoolId: 'school-1',
        schoolLevel: 'THCS',
        subject: 'Math',
      });

      expect(results).toHaveLength(0);
    });

    it('should handle IN operator', () => {
      const conditions: RuleCondition[] = [
        { field: 'subject', operator: 'IN', value: ['IELTS', 'TOEFL', 'SAT'] },
      ];

      const result = evaluator.evaluateConditions(conditions, {
        schoolId: 'school-1',
        subject: 'IELTS',
      });

      expect(result).toBe(true);
    });

    it('should handle NOT_IN operator', () => {
      const conditions: RuleCondition[] = [
        { field: 'subject', operator: 'NOT_IN', value: ['IELTS', 'TOEFL'] },
      ];

      const result = evaluator.evaluateConditions(conditions, {
        schoolId: 'school-1',
        subject: 'Math',
      });

      expect(result).toBe(true);
    });

    it('should handle OR logic', () => {
      const conditions: RuleCondition[] = [
        { field: 'subject', operator: '==', value: 'IELTS', logicOp: 'OR' },
        { field: 'subject', operator: '==', value: 'TOEFL' },
      ];

      const result = evaluator.evaluateConditions(conditions, {
        schoolId: 'school-1',
        subject: 'TOEFL',
      });

      expect(result).toBe(true);
    });
  });
});
