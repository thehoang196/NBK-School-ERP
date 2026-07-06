import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Job } from 'bullmq';
import {
  TimetableGenerationProcessor,
  GenerationJobResult,
  PipelineStage,
} from './timetable-generation.processor';
import { TimetableVersionEntity } from '../entities/timetable-version.entity';
import { TimetableVersionStatus } from '../../../common/enums/status.enum';
import { TimetableVersionStateMachineService } from '../services/timetable-version-state-machine.service';
import { FetInputDataCollectorService } from '../services/fet-input-data-collector.service';
import { FetInputExporterService } from '../services/fet-input-exporter.service';
import { FetEngineAdapterService } from '../services/fet-engine-adapter.service';
import { FetOutputParserService } from '../services/fet-output-parser.service';
import { ResultMapperService } from '../services/result-mapper.service';
import { ConflictDetectionService } from '../services/conflict-detection.service';
import { TimetableSlotRepository } from '../repositories/timetable-slot.repository';
import { GenerationJobPayload } from '../services/generation-pipeline.service';
import {
  FetInputData,
  FetExportResult,
  FetSolveResult,
  FetParseResult,
  ActivityMetadata,
  ParsedSlotDto,
} from '../interfaces/fet-dto.interface';
import { ResultMapperOutcome } from '../interfaces/generation-pipeline.interface';

describe('TimetableGenerationProcessor', () => {
  let processor: TimetableGenerationProcessor;
  let mockFetInputDataCollector: jest.Mocked<FetInputDataCollectorService>;
  let mockFetInputExporter: jest.Mocked<FetInputExporterService>;
  let mockFetEngineAdapter: jest.Mocked<FetEngineAdapterService>;
  let mockFetOutputParser: jest.Mocked<FetOutputParserService>;
  let mockResultMapper: jest.Mocked<ResultMapperService>;
  let mockConflictDetection: jest.Mocked<ConflictDetectionService>;
  let mockStateMachine: jest.Mocked<TimetableVersionStateMachineService>;
  let mockVersionRepository: {
    findOne: jest.Mock;
    update: jest.Mock;
  };
  let mockSlotRepository: jest.Mocked<Partial<TimetableSlotRepository>>;

  // Shared test data
  const jobPayload: GenerationJobPayload = {
    versionId: 'version-001',
    semesterId: 'semester-001',
    schoolId: 'school-001',
    userId: 'user-001',
    timeoutSeconds: 300,
    name: 'TKB lần 1',
  };

  const mockVersion: Partial<TimetableVersionEntity> = {
    id: 'version-001',
    schoolId: 'school-001',
    semesterId: 'semester-001',
    name: 'TKB lần 1',
    versionNumber: 1,
    status: TimetableVersionStatus.GENERATING,
    jobId: 'job-001',
    generationStartedAt: new Date(),
    generationCompletedAt: null,
    generationDurationMs: null,
    errorMessage: null,
    errorStack: null,
    hasConflicts: false,
    conflictCount: 0,
    conflictDetails: null,
    totalSlots: 0,
    version: 1,
  };

  const mockInputData: FetInputData = {
    institution: 'Test School',
    schoolId: 'school-001',
    semesterId: 'semester-001',
    teachingAssignments: [
      {
        id: 'ta-1',
        teacherId: 't-1',
        classId: 'c-1',
        subjectId: 's-1',
        periodsPerWeek: 3,
      },
    ],
    teachers: [{ id: 't-1', name: 'Nguyễn Văn A', maxPeriodsPerDay: 6 }],
    classes: [{ id: 'c-1', name: '10A1', gradeId: 'g-1' }],
    subjects: [{ id: 's-1', name: 'Toán' }],
    rooms: [{ id: 'r-1', name: 'Phòng 101', capacity: 40 }],
    periodDefinitions: [
      { id: 'pd-1', periodNumber: 1, name: 'Tiết 1', sessionId: 'session-1' },
    ],
    days: ['Thứ 2', 'Thứ 3', 'Thứ 4', 'Thứ 5', 'Thứ 6', 'Thứ 7'],
    teacherAvailability: [],
    roomConstraints: [],
  };

  const mockActivityMap = new Map<string, ActivityMetadata>([
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
  ]);

  const mockExportResult: FetExportResult = {
    xml: '<?xml version="1.0"?><fet></fet>',
    activityMap: mockActivityMap,
  };

  const mockSolveResult: FetSolveResult = {
    success: true,
    outputXml:
      '<fet><Timetable_Data><Activity><Id>1</Id><Day>Thứ 2</Day><Hour>Tiết 1</Hour><Room>Phòng 101</Room></Activity></Timetable_Data></fet>',
    exitCode: 0,
    stderr: '',
    durationMs: 5000,
    timedOut: false,
    partialResult: false,
  };

  const mockParsedSlots: ParsedSlotDto[] = [
    {
      teacherId: 't-1',
      classId: 'c-1',
      subjectId: 's-1',
      roomId: 'r-1',
      dayOfWeek: 0,
      periodId: 'pd-1',
      isDoublePeriod: false,
    },
  ];

  const mockParseResult: FetParseResult = {
    success: true,
    slots: mockParsedSlots,
    errors: [],
    warnings: [],
  };

  const mockMapperOutcome: ResultMapperOutcome = {
    success: true,
    slotCount: 1,
    errors: [],
  };

  function createMockJob(): jest.Mocked<Job<GenerationJobPayload>> {
    return {
      id: 'job-001',
      data: jobPayload,
      updateProgress: jest.fn().mockResolvedValue(undefined),
    } as unknown as jest.Mocked<Job<GenerationJobPayload>>;
  }

  beforeEach(async () => {
    mockFetInputDataCollector = {
      collectForGeneration: jest.fn().mockResolvedValue(mockInputData),
    } as unknown as jest.Mocked<FetInputDataCollectorService>;

    mockFetInputExporter = {
      validate: jest.fn().mockReturnValue({ valid: true, errors: [] }),
      export: jest.fn().mockReturnValue(mockExportResult),
    } as unknown as jest.Mocked<FetInputExporterService>;

    mockFetEngineAdapter = {
      solve: jest.fn().mockResolvedValue(mockSolveResult),
    } as unknown as jest.Mocked<FetEngineAdapterService>;

    mockFetOutputParser = {
      parse: jest.fn().mockReturnValue(mockParseResult),
    } as unknown as jest.Mocked<FetOutputParserService>;

    mockResultMapper = {
      persistSlots: jest.fn().mockResolvedValue(mockMapperOutcome),
    } as unknown as jest.Mocked<ResultMapperService>;

    mockConflictDetection = {
      detectPostGenerationConflicts: jest.fn().mockResolvedValue([]),
    } as unknown as jest.Mocked<ConflictDetectionService>;

    mockStateMachine = {
      transition: jest.fn().mockImplementation(async (version) => version),
      canTransition: jest.fn().mockReturnValue(true),
    } as unknown as jest.Mocked<TimetableVersionStateMachineService>;

    mockVersionRepository = {
      findOne: jest.fn().mockResolvedValue(mockVersion),
      update: jest.fn().mockResolvedValue(undefined),
    };

    mockSlotRepository = {
      deleteByVersion: jest.fn().mockResolvedValue(undefined),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TimetableGenerationProcessor,
        {
          provide: FetInputDataCollectorService,
          useValue: mockFetInputDataCollector,
        },
        { provide: FetInputExporterService, useValue: mockFetInputExporter },
        { provide: FetEngineAdapterService, useValue: mockFetEngineAdapter },
        { provide: FetOutputParserService, useValue: mockFetOutputParser },
        { provide: ResultMapperService, useValue: mockResultMapper },
        { provide: ConflictDetectionService, useValue: mockConflictDetection },
        {
          provide: TimetableVersionStateMachineService,
          useValue: mockStateMachine,
        },
        {
          provide: getRepositoryToken(TimetableVersionEntity),
          useValue: mockVersionRepository,
        },
        { provide: TimetableSlotRepository, useValue: mockSlotRepository },
      ],
    }).compile();

    processor = module.get<TimetableGenerationProcessor>(
      TimetableGenerationProcessor,
    );
  });

  describe('process() — happy path', () => {
    it('should complete full pipeline successfully with zero conflicts', async () => {
      const job = createMockJob();

      const result: GenerationJobResult = await processor.process(job);

      expect(result.versionId).toBe('version-001');
      expect(result.slotCount).toBe(1);
      expect(result.conflictCount).toBe(0);
      expect(result.durationMs).toBeGreaterThanOrEqual(0);
      expect(result.hasWarnings).toBe(false);
    });

    it('should update progress at each pipeline stage', async () => {
      const job = createMockJob();

      await processor.process(job);

      expect(job.updateProgress).toHaveBeenCalledWith(10); // input_export
      expect(job.updateProgress).toHaveBeenCalledWith(80); // fet_running
      expect(job.updateProgress).toHaveBeenCalledWith(85); // output_parsing
      expect(job.updateProgress).toHaveBeenCalledWith(95); // result_mapping
      expect(job.updateProgress).toHaveBeenCalledWith(100); // conflict_detection
    });

    it('should transition version to GENERATED on success', async () => {
      const job = createMockJob();

      await processor.process(job);

      expect(mockStateMachine.transition).toHaveBeenCalledWith(
        mockVersion,
        TimetableVersionStatus.GENERATED,
        expect.objectContaining({ conflictCount: 0 }),
      );
    });

    it('should update totalSlots on version after result_mapping', async () => {
      const job = createMockJob();

      await processor.process(job);

      expect(mockVersionRepository.update).toHaveBeenCalledWith('version-001', {
        totalSlots: 1,
      });
    });

    it('should report hasWarnings=true when conflicts exist', async () => {
      mockConflictDetection.detectPostGenerationConflicts.mockResolvedValue([
        {
          type: 'teacher_double_booking',
          entityId: 't-1',
          dayOfWeek: 0,
          periodId: 'pd-1',
          slotIds: ['slot-1', 'slot-2'],
          message: 'Giáo viên bị trùng lịch',
        },
      ]);

      const job = createMockJob();
      const result = await processor.process(job);

      expect(result.conflictCount).toBe(1);
      expect(result.hasWarnings).toBe(true);
      expect(mockStateMachine.transition).toHaveBeenCalledWith(
        mockVersion,
        TimetableVersionStatus.GENERATED,
        expect.objectContaining({ conflictCount: 1, warningFlag: true }),
      );
    });
  });

  describe('process() — input_export failure', () => {
    it('should transition to FAILED when input validation fails', async () => {
      mockFetInputExporter.validate.mockReturnValue({
        valid: false,
        errors: [
          { field: 'teachers', message: 'Danh sách giáo viên không được rỗng' },
        ],
      });

      const job = createMockJob();

      await expect(processor.process(job)).rejects.toThrow();
      expect(mockStateMachine.transition).toHaveBeenCalledWith(
        mockVersion,
        TimetableVersionStatus.FAILED,
        expect.objectContaining({
          errorMessage: expect.stringContaining('Dữ liệu đầu vào không hợp lệ'),
        }),
      );
    });

    it('should transition to FAILED when data collection throws', async () => {
      mockFetInputDataCollector.collectForGeneration.mockRejectedValue(
        new Error('Database connection error'),
      );

      const job = createMockJob();

      await expect(processor.process(job)).rejects.toThrow(
        'Database connection error',
      );
      expect(mockStateMachine.transition).toHaveBeenCalledWith(
        mockVersion,
        TimetableVersionStatus.FAILED,
        expect.objectContaining({
          errorMessage: 'Database connection error',
        }),
      );
    });

    it('should not attempt cleanup when input_export fails', async () => {
      mockFetInputDataCollector.collectForGeneration.mockRejectedValue(
        new Error('Error'),
      );

      const job = createMockJob();

      await expect(processor.process(job)).rejects.toThrow();
      expect(mockSlotRepository.deleteByVersion).not.toHaveBeenCalled();
    });
  });

  describe('process() — fet_running failure', () => {
    it('should transition to FAILED when FET engine fails', async () => {
      mockFetEngineAdapter.solve.mockResolvedValue({
        success: false,
        outputXml: null,
        exitCode: 1,
        stderr: 'FET infeasible',
        durationMs: 5000,
        timedOut: false,
        partialResult: false,
      });

      const job = createMockJob();

      await expect(processor.process(job)).rejects.toThrow();
      expect(mockStateMachine.transition).toHaveBeenCalledWith(
        mockVersion,
        TimetableVersionStatus.FAILED,
        expect.objectContaining({
          errorMessage: expect.stringContaining('FET engine thất bại'),
        }),
      );
    });

    it('should transition to FAILED on timeout with no output', async () => {
      mockFetEngineAdapter.solve.mockResolvedValue({
        success: false,
        outputXml: null,
        exitCode: -1,
        stderr: '',
        durationMs: 300000,
        timedOut: true,
        partialResult: false,
      });

      const job = createMockJob();

      await expect(processor.process(job)).rejects.toThrow();
      expect(mockStateMachine.transition).toHaveBeenCalledWith(
        mockVersion,
        TimetableVersionStatus.FAILED,
        expect.objectContaining({
          errorMessage: expect.stringContaining('vượt quá thời gian'),
        }),
      );
    });

    it('should continue with partial result when timeout produces output', async () => {
      mockFetEngineAdapter.solve.mockResolvedValue({
        success: false,
        outputXml: '<fet><Timetable_Data></Timetable_Data></fet>',
        exitCode: -1,
        stderr: '',
        durationMs: 300000,
        timedOut: true,
        partialResult: true,
      });

      const job = createMockJob();

      // Should not throw — continues with partial result
      const result = await processor.process(job);
      expect(result).toBeDefined();
    });
  });

  describe('process() — output_parsing failure', () => {
    it('should transition to FAILED when parser reports errors', async () => {
      mockFetOutputParser.parse.mockReturnValue({
        success: false,
        slots: [],
        errors: [
          {
            activityId: '1',
            field: 'Day',
            message: 'Ngày không hợp lệ',
            rawValue: 'InvalidDay',
          },
        ],
        warnings: [],
      });

      const job = createMockJob();

      await expect(processor.process(job)).rejects.toThrow();
      expect(mockStateMachine.transition).toHaveBeenCalledWith(
        mockVersion,
        TimetableVersionStatus.FAILED,
        expect.objectContaining({
          errorMessage: expect.stringContaining('Lỗi phân tích kết quả FET'),
        }),
      );
    });

    it('should not attempt slot deletion when output_parsing fails', async () => {
      mockFetOutputParser.parse.mockImplementation(() => {
        throw new Error('XML parse error');
      });

      const job = createMockJob();

      await expect(processor.process(job)).rejects.toThrow();
      expect(mockSlotRepository.deleteByVersion).not.toHaveBeenCalled();
    });
  });

  describe('process() — result_mapping failure', () => {
    it('should transition to FAILED when slot persistence fails', async () => {
      mockResultMapper.persistSlots.mockRejectedValue(
        new Error('Transaction failed'),
      );

      const job = createMockJob();

      await expect(processor.process(job)).rejects.toThrow(
        'Transaction failed',
      );
      expect(mockStateMachine.transition).toHaveBeenCalledWith(
        mockVersion,
        TimetableVersionStatus.FAILED,
        expect.objectContaining({
          errorMessage: 'Transaction failed',
        }),
      );
    });

    it('should not attempt slot deletion when result_mapping fails (auto-rollback)', async () => {
      mockResultMapper.persistSlots.mockRejectedValue(
        new Error('Transaction failed'),
      );

      const job = createMockJob();

      await expect(processor.process(job)).rejects.toThrow();
      expect(mockSlotRepository.deleteByVersion).not.toHaveBeenCalled();
    });
  });

  describe('process() — conflict_detection failure', () => {
    it('should delete committed slots when conflict_detection fails', async () => {
      mockConflictDetection.detectPostGenerationConflicts.mockRejectedValue(
        new Error('Conflict detection crashed'),
      );

      const job = createMockJob();

      await expect(processor.process(job)).rejects.toThrow(
        'Conflict detection crashed',
      );
      expect(mockSlotRepository.deleteByVersion).toHaveBeenCalledWith(
        'version-001',
      );
    });

    it('should transition to FAILED when conflict_detection fails', async () => {
      mockConflictDetection.detectPostGenerationConflicts.mockRejectedValue(
        new Error('Conflict detection crashed'),
      );

      const job = createMockJob();

      await expect(processor.process(job)).rejects.toThrow();
      expect(mockStateMachine.transition).toHaveBeenCalledWith(
        mockVersion,
        TimetableVersionStatus.FAILED,
        expect.objectContaining({
          errorMessage: 'Conflict detection crashed',
        }),
      );
    });
  });

  describe('process() — edge cases', () => {
    it('should throw when TimetableVersion not found', async () => {
      mockVersionRepository.findOne.mockResolvedValue(null);

      const job = createMockJob();

      await expect(processor.process(job)).rejects.toThrow(
        'Không tìm thấy TimetableVersion: version-001',
      );
    });

    it('should handle state machine transition failure gracefully', async () => {
      // First call: conflict_detection transition to GENERATED fails
      // Second call: safeTransitionToFailed should still attempt transition
      mockStateMachine.transition
        .mockRejectedValueOnce(new Error('Optimistic lock'))
        .mockResolvedValue(mockVersion as TimetableVersionEntity);

      const job = createMockJob();

      await expect(processor.process(job)).rejects.toThrow();
      // Should not crash the entire process
    });

    it('should skip FAILED transition if version not in GENERATING state', async () => {
      // Simulate version already transitioned (e.g., by another process)
      const failedVersion = {
        ...mockVersion,
        status: TimetableVersionStatus.FAILED,
      };
      mockVersionRepository.findOne.mockResolvedValue(failedVersion);
      mockFetInputDataCollector.collectForGeneration.mockRejectedValue(
        new Error('Error'),
      );

      const job = createMockJob();

      await expect(processor.process(job)).rejects.toThrow();
      // Should not attempt transition since already not in GENERATING
      // The first findOne returns a version in GENERATING (for loadVersion),
      // but the second findOne (in safeTransitionToFailed) returns FAILED
      expect(mockStateMachine.transition).not.toHaveBeenCalledWith(
        expect.anything(),
        TimetableVersionStatus.FAILED,
        expect.anything(),
      );
    });
  });

  describe('process() — pipeline orchestration', () => {
    it('should call pipeline stages in correct order', async () => {
      const callOrder: string[] = [];

      mockFetInputDataCollector.collectForGeneration.mockImplementation(
        async () => {
          callOrder.push('collectForGeneration');
          return mockInputData;
        },
      );
      mockFetInputExporter.export.mockImplementation(() => {
        callOrder.push('export');
        return mockExportResult;
      });
      mockFetEngineAdapter.solve.mockImplementation(async () => {
        callOrder.push('solve');
        return mockSolveResult;
      });
      mockFetOutputParser.parse.mockImplementation(() => {
        callOrder.push('parse');
        return mockParseResult;
      });
      mockResultMapper.persistSlots.mockImplementation(async () => {
        callOrder.push('persistSlots');
        return mockMapperOutcome;
      });
      mockConflictDetection.detectPostGenerationConflicts.mockImplementation(
        async () => {
          callOrder.push('detectConflicts');
          return [];
        },
      );

      const job = createMockJob();
      await processor.process(job);

      expect(callOrder).toEqual([
        'collectForGeneration',
        'export',
        'solve',
        'parse',
        'persistSlots',
        'detectConflicts',
      ]);
    });

    it('should pass correct parameters through pipeline stages', async () => {
      const job = createMockJob();
      await processor.process(job);

      // Stage 1: collectForGeneration called with semester + school
      expect(
        mockFetInputDataCollector.collectForGeneration,
      ).toHaveBeenCalledWith('semester-001', 'school-001');

      // Stage 2: solve called with exported XML and timeout
      expect(mockFetEngineAdapter.solve).toHaveBeenCalledWith({
        inputXml: mockExportResult.xml,
        timeoutSeconds: 300,
        jobId: 'job-001',
      });

      // Stage 4: persistSlots called with version, parsed slots, school
      expect(mockResultMapper.persistSlots).toHaveBeenCalledWith(
        'version-001',
        mockParsedSlots,
        'school-001',
      );

      // Stage 5: detectPostGenerationConflicts called with version + school
      expect(
        mockConflictDetection.detectPostGenerationConflicts,
      ).toHaveBeenCalledWith('version-001', 'school-001');
    });
  });
});
