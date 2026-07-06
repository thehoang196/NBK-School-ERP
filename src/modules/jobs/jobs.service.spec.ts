import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { JobsService, CreateJobInput } from './jobs.service';
import { JobsRepository } from './jobs.repository';
import { JobRecordEntity, JobStatus, JobType } from './entities/job-record.entity';

describe('JobsService', () => {
  let service: JobsService;
  let repository: jest.Mocked<JobsRepository>;

  const mockJob: JobRecordEntity = {
    id: 'job-uuid-1',
    schoolId: 'school-uuid-1',
    jobType: JobType.TIMETABLE_GENERATION,
    status: JobStatus.PENDING,
    progress: 0,
    bullJobId: null,
    queueName: 'timetable-generation',
    payload: { versionId: 'v-1' },
    result: null,
    errorMessage: null,
    createdBy: 'user-uuid-1',
    attempts: 0,
    maxAttempts: 3,
    startedAt: null,
    completedAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        JobsService,
        {
          provide: JobsRepository,
          useValue: {
            create: jest.fn(),
            findById: jest.fn(),
            findAll: jest.fn(),
            updateStatus: jest.fn(),
            updateProgress: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<JobsService>(JobsService);
    repository = module.get(JobsRepository);
  });

  describe('createJob', () => {
    it('should create a new job record', async () => {
      repository.create.mockResolvedValue(mockJob);

      const input: CreateJobInput = {
        schoolId: 'school-uuid-1',
        jobType: JobType.TIMETABLE_GENERATION,
        queueName: 'timetable-generation',
        payload: { versionId: 'v-1' },
        createdBy: 'user-uuid-1',
      };

      const result = await service.createJob(input);

      expect(result).toEqual(mockJob);
      expect(repository.create).toHaveBeenCalledWith({
        schoolId: 'school-uuid-1',
        jobType: JobType.TIMETABLE_GENERATION,
        queueName: 'timetable-generation',
        bullJobId: null,
        payload: { versionId: 'v-1' },
        createdBy: 'user-uuid-1',
        maxAttempts: 3,
        status: JobStatus.PENDING,
        progress: 0,
      });
    });
  });

  describe('getJobById', () => {
    it('should return job when found', async () => {
      repository.findById.mockResolvedValue(mockJob);
      const result = await service.getJobById('job-uuid-1');
      expect(result).toEqual(mockJob);
    });

    it('should throw NotFoundException when not found', async () => {
      repository.findById.mockResolvedValue(null);
      await expect(service.getJobById('non-existent')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('getJobs', () => {
    it('should return paginated jobs', async () => {
      repository.findAll.mockResolvedValue([[mockJob], 1]);

      const result = await service.getJobs(
        { page: 1, limit: 20 },
        'school-uuid-1',
      );

      expect(result.success).toBe(true);
      expect(result.data).toHaveLength(1);
      expect(result.meta.total).toBe(1);
    });
  });

  describe('markActive', () => {
    it('should update job status to active', async () => {
      repository.updateStatus.mockResolvedValue(undefined);
      await service.markActive('job-uuid-1', 'bull-123');

      expect(repository.updateStatus).toHaveBeenCalledWith(
        'job-uuid-1',
        JobStatus.ACTIVE,
        expect.objectContaining({
          startedAt: expect.any(Date),
          bullJobId: 'bull-123',
        }),
      );
    });
  });

  describe('markCompleted', () => {
    it('should update job status to completed with result', async () => {
      repository.updateStatus.mockResolvedValue(undefined);
      const resultData = { slotCount: 100 };
      await service.markCompleted('job-uuid-1', resultData);

      expect(repository.updateStatus).toHaveBeenCalledWith(
        'job-uuid-1',
        JobStatus.COMPLETED,
        expect.objectContaining({
          completedAt: expect.any(Date),
          progress: 100,
          result: resultData,
        }),
      );
    });
  });

  describe('markFailed', () => {
    it('should update job status to failed with error message', async () => {
      repository.updateStatus.mockResolvedValue(undefined);
      await service.markFailed('job-uuid-1', 'FET timeout');

      expect(repository.updateStatus).toHaveBeenCalledWith(
        'job-uuid-1',
        JobStatus.FAILED,
        expect.objectContaining({
          completedAt: expect.any(Date),
          errorMessage: 'FET timeout',
        }),
      );
    });
  });

  describe('updateProgress', () => {
    it('should update progress', async () => {
      repository.updateProgress.mockResolvedValue(undefined);
      await service.updateProgress('job-uuid-1', 50);
      expect(repository.updateProgress).toHaveBeenCalledWith('job-uuid-1', 50);
    });

    it('should clamp progress to 0-100', async () => {
      repository.updateProgress.mockResolvedValue(undefined);
      await service.updateProgress('job-uuid-1', 150);
      expect(repository.updateProgress).toHaveBeenCalledWith('job-uuid-1', 100);

      await service.updateProgress('job-uuid-1', -10);
      expect(repository.updateProgress).toHaveBeenCalledWith('job-uuid-1', 0);
    });
  });
});
