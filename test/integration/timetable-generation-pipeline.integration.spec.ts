import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { getRepositoryToken } from '@nestjs/typeorm';
import { NotFoundException } from '@nestjs/common';
import { Repository } from 'typeorm';
import { TimetableVersionEntity } from '../../src/modules/timetable/entities/timetable-version.entity';
import { TimetableVersionStatus } from '../../src/common/enums/status.enum';
import { GenerationPipelineService } from '../../src/modules/timetable/services/generation-pipeline.service';
import { TimetableVersionStateMachineService } from '../../src/modules/timetable/services/timetable-version-state-machine.service';
import { TimetableGenerationProcessor } from '../../src/modules/timetable/processors/timetable-generation.processor';
import { FetInputDataCollectorService } from '../../src/modules/timetable/services/fet-input-data-collector.service';
import { FetInputExporterService } from '../../src/modules/timetable/services/fet-input-exporter.service';
import { FetEngineAdapterService } from '../../src/modules/timetable/services/fet-engine-adapter.service';
import { FetOutputParserService } from '../../src/modules/timetable/services/fet-output-parser.service';
import { ResultMapperService } from '../../src/modules/timetable/services/result-mapper.service';
import { ConflictDetectionService } from '../../src/modules/timetable/services/conflict-detection.service';
import { TimetableSlotRepository } from '../../src/modules/timetable/repositories/timetable-slot.repository';
import { TimetableVersionRepository } from '../../src/modules/timetable/repositories/timetable-version.repository';
import { DuplicateGenerationException } from '../../src/modules/timetable/exceptions/duplicate-generation.exception';
import { CurrentUserPayload } from '../../src/common/decorators/current-user.decorator';
import {
  FetInputData,
  ParsedSlotDto,
} from '../../src/modules/timetable/interfaces/fet-dto.interface';
import { TeacherEntity } from '../../src/modules/teacher/entities/teacher.entity';

/**
 * Integration Tests: FET Generation Pipeline
 *
 * Tests the orchestration flow end-to-end with mocked external dependencies
 * (database, Docker, Redis). Validates service interactions and state transitions.
 *
 * Requirements validated: 1.1, 1.2, 4.2, 9.1, 9.3, 11.1, 11.3
 */

// ─── Test Constants ─────────────────────────────────────────────────────────

const SCHOOL_A_ID = 'aaaaaaaa-1111-4aaa-aaaa-aaaaaaaaaaaa';
const SCHOOL_B_ID = 'bbbbbbbb-2222-4bbb-bbbb-bbbbbbbbbbbb';
const SEMESTER_ID = 'cccccccc-3333-4ccc-cccc-cccccccccccc';
const VERSION_ID = 'dddddddd-4444-4ddd-dddd-dddddddddddd';
const JOB_ID = 'job-12345';

const userSchoolA: CurrentUserPayload = {
  id: 'user-a-id-0001',
  email: 'scheduler@schoola.edu.vn',
  role: 'scheduler',
  schoolId: SCHOOL_A_ID,
};

const userSchoolB: CurrentUserPayload = {
  id: 'user-b-id-0002',
  email: 'scheduler@schoolb.edu.vn',
  role: 'scheduler',
  schoolId: SCHOOL_B_ID,
};

// ─── Mock FET Input Data ────────────────────────────────────────────────────

const mockFetInputData: FetInputData = {
  institution: 'Trường THPT Nguyễn Bỉnh Khiêm',
  schoolId: SCHOOL_A_ID,
  semesterId: SEMESTER_ID,
  teachingAssignments: [
    {
      id: 'ta-1',
      teacherId: 't-1',
      classId: 'c-1',
      subjectId: 's-1',
      periodsPerWeek: 4,
    },
  ],
  teachers: [{ id: 't-1', name: 'Nguyễn Văn A', maxPeriodsPerDay: 5 }],
  classes: [{ id: 'c-1', name: '10A1', gradeId: 'g-1' }],
  subjects: [{ id: 's-1', name: 'Toán' }],
  rooms: [{ id: 'r-1', name: 'Phòng 101', capacity: 40 }],
  periodDefinitions: [
    { id: 'p-1', periodNumber: 1, name: 'Tiết 1', sessionId: 'ses-1' },
    { id: 'p-2', periodNumber: 2, name: 'Tiết 2', sessionId: 'ses-1' },
  ],
  days: ['Thứ 2', 'Thứ 3', 'Thứ 4', 'Thứ 5', 'Thứ 6', 'Thứ 7'],
  teacherAvailability: [],
  roomConstraints: [],
};

const mockParsedSlots: ParsedSlotDto[] = [
  {
    teacherId: 't-1',
    classId: 'c-1',
    subjectId: 's-1',
    roomId: 'r-1',
    dayOfWeek: 0,
    periodId: 'p-1',
    isDoublePeriod: false,
  },
  {
    teacherId: 't-1',
    classId: 'c-1',
    subjectId: 's-1',
    roomId: 'r-1',
    dayOfWeek: 1,
    periodId: 'p-1',
    isDoublePeriod: false,
  },
  {
    teacherId: 't-1',
    classId: 'c-1',
    subjectId: 's-1',
    roomId: 'r-1',
    dayOfWeek: 2,
    periodId: 'p-2',
    isDoublePeriod: false,
  },
  {
    teacherId: 't-1',
    classId: 'c-1',
    subjectId: 's-1',
    roomId: 'r-1',
    dayOfWeek: 3,
    periodId: 'p-2',
    isDoublePeriod: false,
  },
];

// ─── Helper: Create a mock version entity ───────────────────────────────────

function createMockVersion(
  overrides: Partial<TimetableVersionEntity> = {},
): TimetableVersionEntity {
  const version = new TimetableVersionEntity();
  version.id = VERSION_ID;
  version.schoolId = SCHOOL_A_ID;
  version.semesterId = SEMESTER_ID;
  version.name = 'TKB lần 1';
  version.versionNumber = 1;
  version.status = TimetableVersionStatus.DRAFT;
  version.jobId = null;
  version.generationStartedAt = null;
  version.generationCompletedAt = null;
  version.generationDurationMs = null;
  version.errorMessage = null;
  version.errorStack = null;
  version.hasConflicts = false;
  version.conflictCount = 0;
  version.conflictDetails = null;
  version.totalSlots = 0;
  version.version = 1;
  version.publishedAt = null;
  version.publishedBy = null;
  version.slots = [];
  Object.assign(version, overrides);
  return version;
}

// ─── Test Suite ─────────────────────────────────────────────────────────────

describe('Timetable Generation Pipeline (Integration)', () => {
  let pipelineService: GenerationPipelineService;
  let processor: TimetableGenerationProcessor;
  let stateMachine: TimetableVersionStateMachineService;
  let mockVersionRepo: jest.Mocked<Repository<TimetableVersionEntity>>;
  let mockFetInputDataCollector: jest.Mocked<FetInputDataCollectorService>;
  let mockFetInputExporter: jest.Mocked<FetInputExporterService>;
  let mockFetEngineAdapter: jest.Mocked<FetEngineAdapterService>;
  let mockFetOutputParser: jest.Mocked<FetOutputParserService>;
  let mockResultMapper: jest.Mocked<ResultMapperService>;
  let mockConflictDetection: jest.Mocked<ConflictDetectionService>;
  let mockSlotRepository: jest.Mocked<TimetableSlotRepository>;

  beforeAll(async () => {
    // Create mock repositories and services
    mockVersionRepo = {
      create: jest.fn(),
      save: jest.fn(),
      findOne: jest.fn(),
      update: jest.fn(),
      createQueryBuilder: jest.fn().mockReturnValue({
        select: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        getRawOne: jest.fn().mockResolvedValue({ maxVersion: 0 }),
      }),
    } as unknown as jest.Mocked<Repository<TimetableVersionEntity>>;

    mockFetInputDataCollector = {
      collectForGeneration: jest.fn(),
    } as unknown as jest.Mocked<FetInputDataCollectorService>;

    mockFetInputExporter = {
      validate: jest.fn(),
      export: jest.fn(),
    } as unknown as jest.Mocked<FetInputExporterService>;

    mockFetEngineAdapter = {
      solve: jest.fn(),
    } as unknown as jest.Mocked<FetEngineAdapterService>;

    mockFetOutputParser = {
      parse: jest.fn(),
    } as unknown as jest.Mocked<FetOutputParserService>;

    mockResultMapper = {
      persistSlots: jest.fn(),
    } as unknown as jest.Mocked<ResultMapperService>;

    mockConflictDetection = {
      detectPostGenerationConflicts: jest.fn(),
    } as unknown as jest.Mocked<ConflictDetectionService>;

    mockSlotRepository = {
      deleteByVersion: jest.fn(),
    } as unknown as jest.Mocked<TimetableSlotRepository>;

    const moduleFixture: TestingModule = await Test.createTestingModule({
      providers: [
        GenerationPipelineService,
        TimetableVersionStateMachineService,
        {
          provide: getRepositoryToken(TimetableVersionEntity),
          useValue: mockVersionRepo,
        },
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn().mockReturnValue({
              engine: { defaultTimeoutSeconds: 300 },
            }),
          },
        },
      ],
    }).compile();

    pipelineService = moduleFixture.get(GenerationPipelineService);
    stateMachine = moduleFixture.get(TimetableVersionStateMachineService);

    // Build the processor manually to inject mocked dependencies
    processor = new TimetableGenerationProcessor(
      mockFetInputDataCollector,
      mockFetInputExporter,
      mockFetEngineAdapter,
      mockFetOutputParser,
      mockResultMapper,
      mockConflictDetection,
      stateMachine,
      mockVersionRepo,
      mockSlotRepository,
    );
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // 1. Happy Path: submit → generating → generated
  // ═══════════════════════════════════════════════════════════════════════════

  describe('Happy Path: submit → generating → generated', () => {
    it('should transition version through DRAFT → GENERATING → GENERATED with no conflicts', async () => {
      // Track status transitions
      const statusTransitions: TimetableVersionStatus[] = [];

      // Mock version repo: no duplicate, create succeeds
      mockVersionRepo.findOne.mockResolvedValue(null); // no duplicate
      mockVersionRepo.create.mockImplementation((data) => {
        const version = createMockVersion(
          data as Partial<TimetableVersionEntity>,
        );
        statusTransitions.push(version.status);
        return version;
      });
      mockVersionRepo.save.mockImplementation(async (entity) => {
        const version = entity as TimetableVersionEntity;
        statusTransitions.push(version.status);
        return version;
      });
      mockVersionRepo.update.mockResolvedValue(undefined as never);

      // Submit generation — this creates DRAFT then transitions to GENERATING
      const result = await pipelineService.submitGeneration(
        { semesterId: SEMESTER_ID },
        userSchoolA,
      );

      expect(result.versionId).toBeDefined();
      expect(result.status).toBe(TimetableVersionStatus.GENERATING);
      // Verify DRAFT was created and transitioned to GENERATING
      expect(statusTransitions).toContain(TimetableVersionStatus.DRAFT);
      expect(statusTransitions).toContain(TimetableVersionStatus.GENERATING);
    });

    it('should complete full pipeline processor with correct slot count and no conflicts', async () => {
      const version = createMockVersion({
        status: TimetableVersionStatus.GENERATING,
      });

      // Mock: version repo returns the version for loading
      mockVersionRepo.findOne.mockResolvedValue(version);
      mockVersionRepo.save.mockImplementation(
        async (entity) => entity as TimetableVersionEntity,
      );
      mockVersionRepo.update.mockResolvedValue(undefined as never);

      // Mock: input data collector returns valid data
      mockFetInputDataCollector.collectForGeneration.mockResolvedValue(
        mockFetInputData,
      );

      // Mock: exporter validates and exports
      mockFetInputExporter.validate.mockReturnValue({
        valid: true,
        errors: [],
      });
      mockFetInputExporter.export.mockReturnValue({
        xml: '<fet><activities/></fet>',
        activityMap: new Map([
          [
            '1',
            {
              teachingAssignmentId: 'ta-1',
              teacherId: 't-1',
              classId: 'c-1',
              subjectId: 's-1',
              duration: 1,
            },
          ],
        ]),
      });

      // Mock: FET engine succeeds
      mockFetEngineAdapter.solve.mockResolvedValue({
        success: true,
        outputXml: '<fet_output/>',
        exitCode: 0,
        stderr: '',
        durationMs: 5000,
        timedOut: false,
        partialResult: false,
      });

      // Mock: output parser returns valid slots
      mockFetOutputParser.parse.mockReturnValue({
        success: true,
        slots: mockParsedSlots,
        errors: [],
        warnings: [],
      });

      // Mock: result mapper persists successfully
      mockResultMapper.persistSlots.mockResolvedValue({
        success: true,
        slotCount: mockParsedSlots.length,
        errors: [],
      });

      // Mock: conflict detection finds no conflicts
      mockConflictDetection.detectPostGenerationConflicts.mockResolvedValue([]);

      // Create a mock BullMQ job
      const mockJob = {
        id: JOB_ID,
        data: {
          versionId: VERSION_ID,
          semesterId: SEMESTER_ID,
          schoolId: SCHOOL_A_ID,
          userId: userSchoolA.id,
          timeoutSeconds: 300,
        },
        updateProgress: jest.fn().mockResolvedValue(undefined),
      };

      // Execute the processor
      const jobResult = await processor.process(mockJob as never);

      // Assert: pipeline completed
      expect(jobResult.versionId).toBe(VERSION_ID);
      expect(jobResult.slotCount).toBe(4);
      expect(jobResult.conflictCount).toBe(0);
      expect(jobResult.hasWarnings).toBe(false);
      expect(jobResult.durationMs).toBeGreaterThanOrEqual(0);

      // Assert: totalSlots was set on the version
      expect(mockVersionRepo.update).toHaveBeenCalledWith(
        VERSION_ID,
        expect.objectContaining({ totalSlots: 4 }),
      );

      // Assert: version transitioned to GENERATED (via stateMachine.transition)
      expect(mockVersionRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({
          status: TimetableVersionStatus.GENERATED,
          hasConflicts: false,
        }),
      );

      // Assert: progress was updated at each stage
      expect(mockJob.updateProgress).toHaveBeenCalledWith(10);
      expect(mockJob.updateProgress).toHaveBeenCalledWith(80);
      expect(mockJob.updateProgress).toHaveBeenCalledWith(85);
      expect(mockJob.updateProgress).toHaveBeenCalledWith(95);
      expect(mockJob.updateProgress).toHaveBeenCalledWith(100);
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // 2. Timeout Handling: FET engine exceeds timeout → FAILED
  // ═══════════════════════════════════════════════════════════════════════════

  describe('Timeout Handling', () => {
    it('should transition version to FAILED when FET engine times out with no output', async () => {
      const version = createMockVersion({
        status: TimetableVersionStatus.GENERATING,
      });

      mockVersionRepo.findOne.mockResolvedValue(version);
      mockVersionRepo.save.mockImplementation(
        async (entity) => entity as TimetableVersionEntity,
      );

      // Mock: input data collector succeeds
      mockFetInputDataCollector.collectForGeneration.mockResolvedValue(
        mockFetInputData,
      );

      // Mock: exporter succeeds
      mockFetInputExporter.validate.mockReturnValue({
        valid: true,
        errors: [],
      });
      mockFetInputExporter.export.mockReturnValue({
        xml: '<fet/>',
        activityMap: new Map(),
      });

      // Mock: FET engine times out with no output
      mockFetEngineAdapter.solve.mockResolvedValue({
        success: false,
        outputXml: null,
        exitCode: -1,
        stderr: 'Process killed: timeout exceeded',
        durationMs: 300000,
        timedOut: true,
        partialResult: false,
      });

      const mockJob = {
        id: JOB_ID,
        data: {
          versionId: VERSION_ID,
          semesterId: SEMESTER_ID,
          schoolId: SCHOOL_A_ID,
          userId: userSchoolA.id,
          timeoutSeconds: 300,
        },
        updateProgress: jest.fn().mockResolvedValue(undefined),
      };

      // Expect the processor to throw (BullMQ marks job as failed)
      await expect(processor.process(mockJob as never)).rejects.toThrow();

      // Assert: version was transitioned to FAILED
      expect(mockVersionRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({
          status: TimetableVersionStatus.FAILED,
        }),
      );

      // Assert: error message mentions timeout (Vietnamese)
      const savedVersion = (mockVersionRepo.save as jest.Mock).mock.calls.find(
        (call) =>
          (call[0] as TimetableVersionEntity).status ===
          TimetableVersionStatus.FAILED,
      );
      expect(savedVersion).toBeDefined();
      const failedEntity = savedVersion![0] as TimetableVersionEntity;
      expect(failedEntity.errorMessage).toContain('vượt quá thời gian');

      // Assert: no slots were persisted
      expect(mockResultMapper.persistSlots).not.toHaveBeenCalled();
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // 3. Rollback on Failure: ResultMapper throws → no partial slots
  // ═══════════════════════════════════════════════════════════════════════════

  describe('Rollback on Failure (result_mapping stage)', () => {
    it('should transition to FAILED with no slots persisted when ResultMapper throws', async () => {
      const version = createMockVersion({
        status: TimetableVersionStatus.GENERATING,
      });

      mockVersionRepo.findOne.mockResolvedValue(version);
      mockVersionRepo.save.mockImplementation(
        async (entity) => entity as TimetableVersionEntity,
      );

      // Mock: all stages before result_mapping succeed
      mockFetInputDataCollector.collectForGeneration.mockResolvedValue(
        mockFetInputData,
      );
      mockFetInputExporter.validate.mockReturnValue({
        valid: true,
        errors: [],
      });
      mockFetInputExporter.export.mockReturnValue({
        xml: '<fet/>',
        activityMap: new Map([
          [
            '1',
            {
              teachingAssignmentId: 'ta-1',
              teacherId: 't-1',
              classId: 'c-1',
              subjectId: 's-1',
              duration: 1,
            },
          ],
        ]),
      });
      mockFetEngineAdapter.solve.mockResolvedValue({
        success: true,
        outputXml: '<fet_output/>',
        exitCode: 0,
        stderr: '',
        durationMs: 5000,
        timedOut: false,
        partialResult: false,
      });
      mockFetOutputParser.parse.mockReturnValue({
        success: true,
        slots: mockParsedSlots,
        errors: [],
        warnings: [],
      });

      // Mock: ResultMapper throws an error (simulating DB transaction failure)
      mockResultMapper.persistSlots.mockRejectedValue(
        new Error('Lỗi lưu slots: database connection lost'),
      );

      const mockJob = {
        id: JOB_ID,
        data: {
          versionId: VERSION_ID,
          semesterId: SEMESTER_ID,
          schoolId: SCHOOL_A_ID,
          userId: userSchoolA.id,
          timeoutSeconds: 300,
        },
        updateProgress: jest.fn().mockResolvedValue(undefined),
      };

      // Expect processor to throw (BullMQ marks job as failed)
      await expect(processor.process(mockJob as never)).rejects.toThrow(
        'Lỗi lưu slots: database connection lost',
      );

      // Assert: version transitioned to FAILED
      expect(mockVersionRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({
          status: TimetableVersionStatus.FAILED,
        }),
      );

      // Assert: no slots remain (transaction rolled back in ResultMapper)
      // The conflict detection should NOT have been called
      expect(
        mockConflictDetection.detectPostGenerationConflicts,
      ).not.toHaveBeenCalled();

      // Assert: totalSlots was NOT set on the version
      expect(mockVersionRepo.update).not.toHaveBeenCalledWith(
        VERSION_ID,
        expect.objectContaining({ totalSlots: expect.any(Number) }),
      );
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // 4. Duplicate Generation Rejection
  // ═══════════════════════════════════════════════════════════════════════════

  describe('Duplicate Generation Rejection', () => {
    it('should reject submission when an existing version is already GENERATING for the same school+semester', async () => {
      // Mock: an existing version in GENERATING status
      const existingVersion = createMockVersion({
        status: TimetableVersionStatus.GENERATING,
        schoolId: SCHOOL_A_ID,
        semesterId: SEMESTER_ID,
      });
      mockVersionRepo.findOne.mockResolvedValue(existingVersion);

      // Act & Assert: expect DuplicateGenerationException
      await expect(
        pipelineService.submitGeneration(
          { semesterId: SEMESTER_ID },
          userSchoolA,
        ),
      ).rejects.toThrow(DuplicateGenerationException);

      // Assert: no new version was created
      expect(mockVersionRepo.create).not.toHaveBeenCalled();
      // Save should not be called for creating a new version
      expect(mockVersionRepo.save).not.toHaveBeenCalled();
    });

    it('should allow submission for a different semester even if one is GENERATING', async () => {
      const differentSemesterId = 'eeeeeeee-5555-4eee-eeee-eeeeeeeeeeee';

      // First call checks duplicate (no existing for the different semester)
      mockVersionRepo.findOne.mockResolvedValueOnce(null);

      // Create returns a new version
      const newVersion = createMockVersion({
        semesterId: differentSemesterId,
        status: TimetableVersionStatus.DRAFT,
      });
      mockVersionRepo.create.mockReturnValue(newVersion);
      mockVersionRepo.save.mockResolvedValue(newVersion);

      const result = await pipelineService.submitGeneration(
        { semesterId: differentSemesterId },
        userSchoolA,
      );

      expect(result.versionId).toBeDefined();
      expect(result.status).toBe(TimetableVersionStatus.GENERATING);
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // 5. Multi-Tenant Isolation
  // ═══════════════════════════════════════════════════════════════════════════

  describe('Multi-Tenant Isolation', () => {
    it('should throw NotFoundException when school A user tries to get status of school B job', async () => {
      // Setup: version belongs to school B, user is from school A
      // getJobStatus searches by jobId AND schoolId — school A won't find school B's job
      mockVersionRepo.findOne.mockResolvedValue(null); // Not found for wrong school

      // Set up the generation queue mock for status checking
      const mockQueue = {
        add: jest.fn().mockResolvedValue({ id: JOB_ID }),
        getJob: jest.fn().mockResolvedValue(null),
        remove: jest.fn(),
      };
      pipelineService.setGenerationQueue(mockQueue);

      // Act & Assert: user from school A cannot access school B's job
      await expect(
        pipelineService.getJobStatus(JOB_ID, SCHOOL_A_ID),
      ).rejects.toThrow(NotFoundException);
    });

    it('should successfully get status when school matches', async () => {
      const version = createMockVersion({
        jobId: JOB_ID,
        schoolId: SCHOOL_A_ID,
        status: TimetableVersionStatus.GENERATING,
      });
      mockVersionRepo.findOne.mockResolvedValue(version);

      const mockQueue = {
        add: jest.fn(),
        getJob: jest.fn().mockResolvedValue({
          id: JOB_ID,
          getState: jest.fn().mockResolvedValue('active'),
          progress: 50,
          data: { versionId: VERSION_ID },
          finishedOn: undefined,
          failedReason: undefined,
        }),
        remove: jest.fn(),
      };
      pipelineService.setGenerationQueue(mockQueue);

      const status = await pipelineService.getJobStatus(JOB_ID, SCHOOL_A_ID);

      expect(status.jobId).toBe(JOB_ID);
      expect(status.versionId).toBe(VERSION_ID);
      expect(status.status).toBe('active');
    });

    it('should scope all input data queries by schoolId in the processor', async () => {
      const version = createMockVersion({
        status: TimetableVersionStatus.GENERATING,
      });

      mockVersionRepo.findOne.mockResolvedValue(version);
      mockVersionRepo.save.mockImplementation(
        async (entity) => entity as TimetableVersionEntity,
      );
      mockVersionRepo.update.mockResolvedValue(undefined as never);

      mockFetInputDataCollector.collectForGeneration.mockResolvedValue(
        mockFetInputData,
      );
      mockFetInputExporter.validate.mockReturnValue({
        valid: true,
        errors: [],
      });
      mockFetInputExporter.export.mockReturnValue({
        xml: '<fet/>',
        activityMap: new Map(),
      });
      mockFetEngineAdapter.solve.mockResolvedValue({
        success: true,
        outputXml: '<out/>',
        exitCode: 0,
        stderr: '',
        durationMs: 1000,
        timedOut: false,
        partialResult: false,
      });
      mockFetOutputParser.parse.mockReturnValue({
        success: true,
        slots: mockParsedSlots,
        errors: [],
        warnings: [],
      });
      mockResultMapper.persistSlots.mockResolvedValue({
        success: true,
        slotCount: 4,
        errors: [],
      });
      mockConflictDetection.detectPostGenerationConflicts.mockResolvedValue([]);

      const mockJob = {
        id: JOB_ID,
        data: {
          versionId: VERSION_ID,
          semesterId: SEMESTER_ID,
          schoolId: SCHOOL_A_ID,
          userId: userSchoolA.id,
          timeoutSeconds: 300,
        },
        updateProgress: jest.fn().mockResolvedValue(undefined),
      };

      await processor.process(mockJob as never);

      // Assert: input data was collected with the correct schoolId
      expect(
        mockFetInputDataCollector.collectForGeneration,
      ).toHaveBeenCalledWith(SEMESTER_ID, SCHOOL_A_ID);

      // Assert: result mapper was called with correct schoolId
      expect(mockResultMapper.persistSlots).toHaveBeenCalledWith(
        VERSION_ID,
        expect.any(Array),
        SCHOOL_A_ID,
      );

      // Assert: conflict detection was scoped to schoolId
      expect(
        mockConflictDetection.detectPostGenerationConflicts,
      ).toHaveBeenCalledWith(VERSION_ID, SCHOOL_A_ID);
    });
  });
});
