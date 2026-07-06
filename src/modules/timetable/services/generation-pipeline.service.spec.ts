import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { ConfigService } from '@nestjs/config';
import { NotFoundException, ForbiddenException } from '@nestjs/common';
import {
  GenerationPipelineService,
  IGenerationQueue,
} from './generation-pipeline.service';
import { TimetableVersionStateMachineService } from './timetable-version-state-machine.service';
import { TimetableVersionEntity } from '../entities/timetable-version.entity';
import { TimetableVersionStatus } from '../../../common/enums/status.enum';
import { DuplicateGenerationException } from '../exceptions/duplicate-generation.exception';
import { CurrentUserPayload } from '../../../common/decorators/current-user.decorator';
import { SubmitGenerationDto } from '../dto/submit-generation.dto';

describe('GenerationPipelineService', () => {
  let service: GenerationPipelineService;
  let mockRepository: Record<string, jest.Mock>;
  let mockStateMachine: Record<string, jest.Mock>;
  let mockConfigService: Record<string, jest.Mock>;
  let mockQueue: IGenerationQueue;

  const schoolId = 'school-uuid-1';
  const semesterId = 'semester-uuid-1';
  const userId = 'user-uuid-1';
  const versionId = 'version-uuid-1';
  const jobId = 'job-uuid-1';

  const mockUser: CurrentUserPayload = {
    id: userId,
    email: 'scheduler@nbk.edu.vn',
    role: 'scheduler',
    schoolId,
  };

  const mockDto: SubmitGenerationDto = {
    semesterId,
    name: 'TKB HK1 lần 1',
  };

  beforeEach(async () => {
    mockRepository = {
      findOne: jest.fn(),
      create: jest.fn(),
      save: jest.fn(),
      createQueryBuilder: jest.fn(),
    };

    mockStateMachine = {
      transition: jest.fn(),
      canTransition: jest.fn(),
    };

    mockConfigService = {
      get: jest.fn().mockReturnValue({
        engine: { defaultTimeoutSeconds: 300 },
        queue: { concurrency: 2, perSchoolLimit: 1 },
      }),
    };

    mockQueue = {
      add: jest.fn().mockResolvedValue({ id: jobId }),
      getJob: jest.fn(),
      remove: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        GenerationPipelineService,
        {
          provide: getRepositoryToken(TimetableVersionEntity),
          useValue: mockRepository,
        },
        {
          provide: TimetableVersionStateMachineService,
          useValue: mockStateMachine,
        },
        {
          provide: ConfigService,
          useValue: mockConfigService,
        },
      ],
    }).compile();

    service = module.get<GenerationPipelineService>(GenerationPipelineService);
    service.setGenerationQueue(mockQueue);
  });

  describe('submitGeneration', () => {
    it('should successfully submit generation and return result', async () => {
      // No duplicate found
      mockRepository.findOne.mockResolvedValue(null);

      // Next version number
      const qb = {
        select: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        getRawOne: jest.fn().mockResolvedValue({ maxVersion: 2 }),
      };
      mockRepository.createQueryBuilder.mockReturnValue(qb);

      // Create version
      const draftVersion = {
        id: versionId,
        schoolId,
        semesterId,
        name: 'TKB HK1 lần 1',
        versionNumber: 3,
        status: TimetableVersionStatus.DRAFT,
        jobId: null,
      } as unknown as TimetableVersionEntity;

      mockRepository.create.mockReturnValue(draftVersion);
      mockRepository.save.mockResolvedValue(draftVersion);

      // Transition to GENERATING
      const generatingVersion = {
        ...draftVersion,
        status: TimetableVersionStatus.GENERATING,
      } as unknown as TimetableVersionEntity;
      mockStateMachine.transition.mockResolvedValue(generatingVersion);

      const result = await service.submitGeneration(mockDto, mockUser);

      expect(result.jobId).toBe(jobId);
      expect(result.versionId).toBe(versionId);
      expect(result.status).toBe(TimetableVersionStatus.GENERATING);
      expect(mockQueue.add).toHaveBeenCalledWith('generate-timetable', {
        versionId,
        semesterId,
        schoolId,
        userId,
        timeoutSeconds: 300,
        name: 'TKB HK1 lần 1',
      });
      // jobId should be saved on version
      expect(mockRepository.save).toHaveBeenCalledTimes(2);
    });

    it('should throw DuplicateGenerationException when a generating version exists', async () => {
      // Duplicate found
      mockRepository.findOne.mockResolvedValue({
        id: 'existing-version-id',
        status: TimetableVersionStatus.GENERATING,
      });

      await expect(service.submitGeneration(mockDto, mockUser)).rejects.toThrow(
        DuplicateGenerationException,
      );
    });

    it('should throw ForbiddenException when user has no schoolId', async () => {
      const userNoSchool: CurrentUserPayload = {
        ...mockUser,
        schoolId: null,
      };

      await expect(
        service.submitGeneration(mockDto, userNoSchool),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should auto-generate name when not provided in DTO', async () => {
      const dtoWithoutName: SubmitGenerationDto = { semesterId };

      mockRepository.findOne.mockResolvedValue(null);

      const qb = {
        select: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        getRawOne: jest.fn().mockResolvedValue({ maxVersion: 0 }),
      };
      mockRepository.createQueryBuilder.mockReturnValue(qb);

      const draftVersion = {
        id: versionId,
        schoolId,
        semesterId,
        name: 'TKB lần 1',
        versionNumber: 1,
        status: TimetableVersionStatus.DRAFT,
        jobId: null,
      } as unknown as TimetableVersionEntity;

      mockRepository.create.mockReturnValue(draftVersion);
      mockRepository.save.mockResolvedValue(draftVersion);

      const generatingVersion = {
        ...draftVersion,
        status: TimetableVersionStatus.GENERATING,
      } as unknown as TimetableVersionEntity;
      mockStateMachine.transition.mockResolvedValue(generatingVersion);

      await service.submitGeneration(dtoWithoutName, mockUser);

      expect(mockRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({ name: 'TKB lần 1' }),
      );
    });

    it('should handle missing BullMQ queue gracefully', async () => {
      service.setGenerationQueue(null as unknown as IGenerationQueue);
      // Trick: set to null
      (service as unknown as { generationQueue: null }).generationQueue = null;

      mockRepository.findOne.mockResolvedValue(null);
      const qb = {
        select: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        getRawOne: jest.fn().mockResolvedValue({ maxVersion: 0 }),
      };
      mockRepository.createQueryBuilder.mockReturnValue(qb);

      const draftVersion = {
        id: versionId,
        schoolId,
        semesterId,
        name: 'TKB lần 1',
        versionNumber: 1,
        status: TimetableVersionStatus.DRAFT,
        jobId: null,
      } as unknown as TimetableVersionEntity;

      mockRepository.create.mockReturnValue(draftVersion);
      mockRepository.save.mockResolvedValue(draftVersion);

      const generatingVersion = {
        ...draftVersion,
        status: TimetableVersionStatus.GENERATING,
      } as unknown as TimetableVersionEntity;
      mockStateMachine.transition.mockResolvedValue(generatingVersion);

      const result = await service.submitGeneration({ semesterId }, mockUser);

      expect(result.jobId).toContain('local-');
      expect(result.versionId).toBe(versionId);
    });
  });

  describe('getJobStatus', () => {
    it('should return combined status from version and queue', async () => {
      const version = {
        id: versionId,
        jobId,
        schoolId,
        status: TimetableVersionStatus.GENERATING,
        errorMessage: null,
        generationCompletedAt: null,
      } as unknown as TimetableVersionEntity;

      mockRepository.findOne.mockResolvedValue(version);

      const mockJob = {
        id: jobId,
        getState: jest.fn().mockResolvedValue('active'),
        progress: 45,
        data: { versionId },
        finishedOn: undefined,
        failedReason: undefined,
      };
      (mockQueue.getJob as jest.Mock).mockResolvedValue(mockJob);

      const result = await service.getJobStatus(jobId, schoolId);

      expect(result.jobId).toBe(jobId);
      expect(result.versionId).toBe(versionId);
      expect(result.status).toBe('active');
      expect(result.progress).toBe(45);
    });

    it('should throw NotFoundException when version not found for school', async () => {
      mockRepository.findOne.mockResolvedValue(null);

      await expect(service.getJobStatus(jobId, schoolId)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should fallback to version status when queue is unavailable', async () => {
      (service as unknown as { generationQueue: null }).generationQueue = null;

      const version = {
        id: versionId,
        jobId,
        schoolId,
        status: TimetableVersionStatus.GENERATED,
        errorMessage: null,
        generationCompletedAt: new Date('2024-01-01'),
      } as unknown as TimetableVersionEntity;

      mockRepository.findOne.mockResolvedValue(version);

      const result = await service.getJobStatus(jobId, schoolId);

      expect(result.status).toBe('completed');
      expect(result.stage).toBe('completed');
      expect(result.completedAt).toEqual(new Date('2024-01-01'));
    });
  });

  describe('cancelJob', () => {
    it('should remove job from queue and transition version to FAILED', async () => {
      const version = {
        id: versionId,
        jobId,
        schoolId,
        status: TimetableVersionStatus.GENERATING,
      } as unknown as TimetableVersionEntity;

      mockRepository.findOne.mockResolvedValue(version);
      mockStateMachine.transition.mockResolvedValue({
        ...version,
        status: TimetableVersionStatus.FAILED,
      });

      await service.cancelJob(jobId, schoolId);

      expect(mockQueue.remove).toHaveBeenCalledWith(jobId);
      expect(mockStateMachine.transition).toHaveBeenCalledWith(
        version,
        TimetableVersionStatus.FAILED,
        { errorMessage: 'Đã hủy bởi người dùng' },
      );
    });

    it('should throw NotFoundException when version not found', async () => {
      mockRepository.findOne.mockResolvedValue(null);

      await expect(service.cancelJob(jobId, schoolId)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should not transition if version is not in GENERATING status', async () => {
      const version = {
        id: versionId,
        jobId,
        schoolId,
        status: TimetableVersionStatus.FAILED,
      } as unknown as TimetableVersionEntity;

      mockRepository.findOne.mockResolvedValue(version);

      await service.cancelJob(jobId, schoolId);

      expect(mockStateMachine.transition).not.toHaveBeenCalled();
    });

    it('should handle queue remove failure gracefully', async () => {
      const version = {
        id: versionId,
        jobId,
        schoolId,
        status: TimetableVersionStatus.GENERATING,
      } as unknown as TimetableVersionEntity;

      mockRepository.findOne.mockResolvedValue(version);
      (mockQueue.remove as jest.Mock).mockRejectedValue(
        new Error('Job is active'),
      );
      mockStateMachine.transition.mockResolvedValue({
        ...version,
        status: TimetableVersionStatus.FAILED,
      });

      // Should not throw
      await expect(service.cancelJob(jobId, schoolId)).resolves.toBeUndefined();

      // Should still transition
      expect(mockStateMachine.transition).toHaveBeenCalled();
    });
  });
});
