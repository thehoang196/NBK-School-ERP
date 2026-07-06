/**
 * Feature: fet-generation-pipeline, Property 1: Duplicate Generation Rejection
 *
 * **Validates: Requirements 1.2**
 *
 * Property: For any school and semester combination where a TimetableVersion
 * already exists in "generating" status, submitting a new generation request
 * SHALL be rejected with a descriptive error, and no new TimetableVersion or
 * job SHALL be created.
 */
import * as fc from 'fast-check';
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { ConfigService } from '@nestjs/config';
import {
  GenerationPipelineService,
  IGenerationQueue,
} from '../generation-pipeline.service';
import { TimetableVersionStateMachineService } from '../timetable-version-state-machine.service';
import { TimetableVersionEntity } from '../../entities/timetable-version.entity';
import { TimetableVersionStatus } from '../../../../common/enums/status.enum';
import { DuplicateGenerationException } from '../../exceptions/duplicate-generation.exception';
import { CurrentUserPayload } from '../../../../common/decorators/current-user.decorator';
import { SubmitGenerationDto } from '../../dto/submit-generation.dto';

describe('Feature: fet-generation-pipeline, Property 1: Duplicate Generation Rejection', () => {
  let service: GenerationPipelineService;
  let mockRepository: Record<string, jest.Mock>;
  let mockStateMachine: Record<string, jest.Mock>;
  let mockConfigService: Record<string, jest.Mock>;
  let mockQueue: IGenerationQueue;

  // Arbitrary: generate a valid UUID v4
  const uuidArb = fc.uuid();

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
      add: jest.fn().mockResolvedValue({ id: 'job-id' }),
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

  it('should reject with DuplicateGenerationException when a version in GENERATING status already exists for the same school/semester', async () => {
    await fc.assert(
      fc.asyncProperty(
        uuidArb, // schoolId
        uuidArb, // semesterId
        uuidArb, // userId
        uuidArb, // existing version id
        fc.option(fc.string({ minLength: 1, maxLength: 50 }), {
          nil: undefined,
        }),
        async (
          schoolId: string,
          semesterId: string,
          userId: string,
          existingVersionId: string,
          optionalName: string | undefined,
        ) => {
          // Mock: an existing version in GENERATING status is found
          mockRepository.findOne.mockResolvedValue({
            id: existingVersionId,
            schoolId,
            semesterId,
            status: TimetableVersionStatus.GENERATING,
          });

          const dto: SubmitGenerationDto = { semesterId, name: optionalName };
          const user: CurrentUserPayload = {
            id: userId,
            email: 'test@nbk.edu.vn',
            role: 'scheduler',
            schoolId,
          };

          // ACT & ASSERT: must throw DuplicateGenerationException
          await expect(service.submitGeneration(dto, user)).rejects.toThrow(
            DuplicateGenerationException,
          );

          // ASSERT: no new version was created (create/save never called)
          expect(mockRepository.create).not.toHaveBeenCalled();
          expect(mockRepository.save).not.toHaveBeenCalled();

          // ASSERT: no job was enqueued
          expect(mockQueue.add).not.toHaveBeenCalled();

          // Reset mocks for next iteration
          jest.clearAllMocks();
        },
      ),
      { numRuns: 100 },
    );
  });

  it('should check for duplicates using the correct schoolId and semesterId from the request', async () => {
    await fc.assert(
      fc.asyncProperty(
        uuidArb, // schoolId
        uuidArb, // semesterId
        uuidArb, // userId
        async (schoolId: string, semesterId: string, userId: string) => {
          // Mock: existing version found
          mockRepository.findOne.mockResolvedValue({
            id: 'existing-id',
            schoolId,
            semesterId,
            status: TimetableVersionStatus.GENERATING,
          });

          const dto: SubmitGenerationDto = { semesterId };
          const user: CurrentUserPayload = {
            id: userId,
            email: 'test@nbk.edu.vn',
            role: 'scheduler',
            schoolId,
          };

          await expect(service.submitGeneration(dto, user)).rejects.toThrow(
            DuplicateGenerationException,
          );

          // Verify findOne was called with the correct school + semester + GENERATING filter
          expect(mockRepository.findOne).toHaveBeenCalledWith({
            where: expect.objectContaining({
              schoolId,
              semesterId,
              status: TimetableVersionStatus.GENERATING,
            }),
          });

          jest.clearAllMocks();
        },
      ),
      { numRuns: 100 },
    );
  });

  it('should return a descriptive error message in Vietnamese when duplicate is rejected', async () => {
    await fc.assert(
      fc.asyncProperty(
        uuidArb, // schoolId
        uuidArb, // semesterId
        uuidArb, // userId
        async (schoolId: string, semesterId: string, userId: string) => {
          mockRepository.findOne.mockResolvedValue({
            id: 'existing-id',
            schoolId,
            semesterId,
            status: TimetableVersionStatus.GENERATING,
          });

          const dto: SubmitGenerationDto = { semesterId };
          const user: CurrentUserPayload = {
            id: userId,
            email: 'test@nbk.edu.vn',
            role: 'scheduler',
            schoolId,
          };

          try {
            await service.submitGeneration(dto, user);
            // Should not reach here
            expect(true).toBe(false);
          } catch (error) {
            expect(error).toBeInstanceOf(DuplicateGenerationException);
            const response = (
              error as DuplicateGenerationException
            ).getResponse();
            expect(response).toHaveProperty('message');
            const message =
              typeof response === 'object' && response !== null
                ? (response as Record<string, unknown>).message
                : response;
            expect(message).toContain('Đang có quá trình sinh TKB');
          }

          jest.clearAllMocks();
        },
      ),
      { numRuns: 100 },
    );
  });
});
