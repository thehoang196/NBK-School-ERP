import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { FormulaVersionService } from './formula-version.service';
import { FormulaVersionEntity } from '../entities/formula-version.entity';
import { FormulaStatus } from '../enums';

describe('FormulaVersionService', () => {
  let service: FormulaVersionService;

  const mockRepo = {
    create: jest.fn(),
    save: jest.fn(),
    find: jest.fn(),
    findOne: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        FormulaVersionService,
        {
          provide: getRepositoryToken(FormulaVersionEntity),
          useValue: mockRepo,
        },
      ],
    }).compile();

    service = module.get<FormulaVersionService>(FormulaVersionService);
    jest.clearAllMocks();
  });

  describe('recordVersion', () => {
    it('should create a version record from formula entity', async () => {
      const formula = {
        id: 'formula-1',
        schoolId: 'school-1',
        formulaVersion: 3,
        expression: 'A + B * C',
        parsedAst: { type: 'binary' },
        effectiveFrom: '2026-07-01',
        effectiveTo: null,
        changelog: 'Updated formula',
        status: FormulaStatus.PUBLISHED,
        createdBy: 'user-1',
      };

      mockRepo.create.mockReturnValue({ ...formula, id: 'version-1' });
      mockRepo.save.mockResolvedValue({ id: 'version-1', versionNumber: 3 });

      const result = await service.recordVersion(formula as any);

      expect(mockRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          formulaId: 'formula-1',
          versionNumber: 3,
          expression: 'A + B * C',
        }),
      );
      expect(mockRepo.save).toHaveBeenCalled();
    });
  });

  describe('findByFormulaId', () => {
    it('should return versions ordered by versionNumber DESC', async () => {
      const versions = [
        { versionNumber: 3, expression: 'v3' },
        { versionNumber: 2, expression: 'v2' },
        { versionNumber: 1, expression: 'v1' },
      ];
      mockRepo.find.mockResolvedValue(versions);

      const result = await service.findByFormulaId('formula-1');

      expect(result).toHaveLength(3);
      expect(mockRepo.find).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { formulaId: 'formula-1', deletedAt: expect.anything() },
          order: { versionNumber: 'DESC' },
        }),
      );
    });
  });

  describe('findVersion', () => {
    it('should find specific version number', async () => {
      mockRepo.findOne.mockResolvedValue({ versionNumber: 2, expression: 'X * Y' });

      const result = await service.findVersion('formula-1', 2);

      expect(result).not.toBeNull();
      expect(result!.versionNumber).toBe(2);
    });

    it('should return null when version not found', async () => {
      mockRepo.findOne.mockResolvedValue(null);

      const result = await service.findVersion('formula-1', 99);
      expect(result).toBeNull();
    });
  });

  describe('getVersionsMap', () => {
    it('should return map of formula id → version number', async () => {
      const formulas = [
        { id: 'f-1', formulaVersion: 2 },
        { id: 'f-2', formulaVersion: 5 },
      ];

      const result = await service.getVersionsMap(formulas as any);

      expect(result['f-1']).toBe(2);
      expect(result['f-2']).toBe(5);
    });
  });
});
