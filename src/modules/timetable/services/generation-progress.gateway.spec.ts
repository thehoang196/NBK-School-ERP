import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { firstValueFrom, take, toArray, lastValueFrom } from 'rxjs';
import { GenerationProgressGatewayService } from './generation-progress-gateway.service';
import { TimetableVersionEntity } from '../entities/timetable-version.entity';
import { TimetableVersionStatus } from '../../../common/enums/status.enum';
import { ProgressEvent } from '../interfaces/generation-pipeline.interface';

describe('GenerationProgressGatewayService', () => {
  let gateway: GenerationProgressGatewayService;
  let mockVersionRepo: jest.Mocked<
    Pick<Repository<TimetableVersionEntity>, 'findOne'>
  >;

  const schoolId = 'school-001';
  const versionId = 'version-001';

  const createMockVersion = (
    overrides?: Partial<TimetableVersionEntity>,
  ): TimetableVersionEntity => {
    const version = new TimetableVersionEntity();
    version.id = versionId;
    version.schoolId = schoolId;
    version.semesterId = 'semester-001';
    version.name = 'TKB lần 1';
    version.versionNumber = 1;
    version.status = TimetableVersionStatus.GENERATING;
    version.errorMessage = null;
    Object.assign(version, overrides);
    return version;
  };

  beforeEach(async () => {
    mockVersionRepo = {
      findOne: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        GenerationProgressGatewayService,
        {
          provide: getRepositoryToken(TimetableVersionEntity),
          useValue: mockVersionRepo,
        },
      ],
    }).compile();

    gateway = module.get<GenerationProgressGatewayService>(
      GenerationProgressGatewayService,
    );
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(gateway).toBeDefined();
  });

  describe('streamProgress', () => {
    it('should emit initial state immediately on connection', async () => {
      const version = createMockVersion({
        status: TimetableVersionStatus.GENERATING,
      });
      mockVersionRepo.findOne.mockResolvedValue(version);

      const observable = gateway.streamProgress(versionId, schoolId);
      const firstEvent = await firstValueFrom(observable.pipe(take(1)));

      expect(firstEvent).toEqual(
        expect.objectContaining({
          versionId,
          stage: 'generating',
          progress: 5,
          message: 'Đang sinh thời khóa biểu...',
        }),
      );
      expect(firstEvent.timestamp).toBeInstanceOf(Date);
    });

    it('should throw NotFoundException when version does not exist', async () => {
      mockVersionRepo.findOne.mockResolvedValue(null);

      const observable = gateway.streamProgress(versionId, schoolId);

      await expect(firstValueFrom(observable)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should throw ForbiddenException when schoolId does not match (multi-tenant)', async () => {
      const version = createMockVersion({ schoolId: 'different-school' });
      mockVersionRepo.findOne.mockResolvedValue(version);

      const observable = gateway.streamProgress(versionId, schoolId);

      await expect(firstValueFrom(observable)).rejects.toThrow(
        ForbiddenException,
      );
    });

    it('should emit progress events from emitProgress', async () => {
      const version = createMockVersion({
        status: TimetableVersionStatus.GENERATING,
      });
      mockVersionRepo.findOne.mockResolvedValue(version);

      const observable = gateway.streamProgress(versionId, schoolId);

      // Collect first 3 events (initial + 2 emitted)
      const eventsPromise = lastValueFrom(observable.pipe(take(3), toArray()));

      // Wait a tick to let the async init complete
      await new Promise((resolve) => setImmediate(resolve));

      // Emit progress events
      gateway.emitProgress(versionId, {
        versionId,
        stage: 'input_export',
        progress: 10,
        message: 'Đang xuất dữ liệu đầu vào',
        timestamp: new Date(),
      });

      gateway.emitProgress(versionId, {
        versionId,
        stage: 'fet_running',
        progress: 50,
        message: 'FET đang chạy',
        timestamp: new Date(),
      });

      const events = await eventsPromise;

      expect(events).toHaveLength(3);
      expect(events[0].stage).toBe('generating'); // initial state
      expect(events[1].stage).toBe('input_export');
      expect(events[1].progress).toBe(10);
      expect(events[2].stage).toBe('fet_running');
      expect(events[2].progress).toBe(50);
    });

    it('should complete stream when terminal event (completed) is emitted', async () => {
      const version = createMockVersion({
        status: TimetableVersionStatus.GENERATING,
      });
      mockVersionRepo.findOne.mockResolvedValue(version);

      const observable = gateway.streamProgress(versionId, schoolId);

      const eventsPromise = lastValueFrom(observable.pipe(toArray()));

      // Wait a tick for initialization
      await new Promise((resolve) => setImmediate(resolve));

      gateway.emitProgress(versionId, {
        versionId,
        stage: 'completed',
        progress: 100,
        message: 'Hoàn thành',
        timestamp: new Date(),
      });

      const events = await eventsPromise;

      // Should include initial + terminal event
      expect(events.length).toBeGreaterThanOrEqual(2);
      const lastEvent = events[events.length - 1];
      expect(lastEvent.stage).toBe('completed');
      expect(lastEvent.progress).toBe(100);
    });

    it('should complete stream when terminal event (failed) is emitted', async () => {
      const version = createMockVersion({
        status: TimetableVersionStatus.GENERATING,
      });
      mockVersionRepo.findOne.mockResolvedValue(version);

      const observable = gateway.streamProgress(versionId, schoolId);

      const eventsPromise = lastValueFrom(observable.pipe(toArray()));

      await new Promise((resolve) => setImmediate(resolve));

      gateway.emitProgress(versionId, {
        versionId,
        stage: 'failed',
        progress: 0,
        message: 'Lỗi sinh TKB',
        timestamp: new Date(),
      });

      const events = await eventsPromise;

      const lastEvent = events[events.length - 1];
      expect(lastEvent.stage).toBe('failed');
    });

    it('should return cached last event on late client connection', async () => {
      const version = createMockVersion({
        status: TimetableVersionStatus.GENERATING,
      });
      mockVersionRepo.findOne.mockResolvedValue(version);

      // Emit some progress before any client connects
      gateway.emitProgress(versionId, {
        versionId,
        stage: 'fet_running',
        progress: 60,
        message: 'FET đang tính toán',
        timestamp: new Date(),
      });

      // Now a client connects — should get the last cached event
      const observable = gateway.streamProgress(versionId, schoolId);
      const firstEvent = await firstValueFrom(observable.pipe(take(1)));

      expect(firstEvent.stage).toBe('fet_running');
      expect(firstEvent.progress).toBe(60);
    });

    it('should emit initial state for DRAFT version', async () => {
      const version = createMockVersion({
        status: TimetableVersionStatus.DRAFT,
      });
      mockVersionRepo.findOne.mockResolvedValue(version);

      const observable = gateway.streamProgress(versionId, schoolId);
      const firstEvent = await firstValueFrom(observable.pipe(take(1)));

      expect(firstEvent.stage).toBe('queued');
      expect(firstEvent.progress).toBe(0);
      expect(firstEvent.message).toBe('Đang chờ xử lý');
    });

    it('should emit initial state for GENERATED version', async () => {
      const version = createMockVersion({
        status: TimetableVersionStatus.GENERATED,
      });
      mockVersionRepo.findOne.mockResolvedValue(version);

      const observable = gateway.streamProgress(versionId, schoolId);
      const firstEvent = await firstValueFrom(observable.pipe(take(1)));

      expect(firstEvent.stage).toBe('completed');
      expect(firstEvent.progress).toBe(100);
    });

    it('should emit error message from version when FAILED', async () => {
      const version = createMockVersion({
        status: TimetableVersionStatus.FAILED,
        errorMessage: 'FET engine vượt quá thời gian cho phép',
      });
      mockVersionRepo.findOne.mockResolvedValue(version);

      const observable = gateway.streamProgress(versionId, schoolId);
      const firstEvent = await firstValueFrom(observable.pipe(take(1)));

      expect(firstEvent.stage).toBe('failed');
      expect(firstEvent.message).toBe('FET engine vượt quá thời gian cho phép');
    });
  });

  describe('emitProgress', () => {
    it('should store event as last known event for replay', () => {
      const event: ProgressEvent = {
        versionId,
        stage: 'input_export',
        progress: 10,
        message: 'Đang xuất dữ liệu',
        timestamp: new Date(),
      };

      gateway.emitProgress(versionId, event);

      const latest = gateway.getLatestProgress(versionId);
      expect(latest).toEqual(event);
    });

    it('should emit to subscribers of the version subject', async () => {
      const version = createMockVersion({
        status: TimetableVersionStatus.GENERATING,
      });
      mockVersionRepo.findOne.mockResolvedValue(version);

      // Subscribe first
      const observable = gateway.streamProgress(versionId, schoolId);
      const eventPromise = lastValueFrom(observable.pipe(take(2), toArray()));

      await new Promise((resolve) => setImmediate(resolve));

      expect(gateway.getActiveStreamCount()).toBe(1);

      // Emit
      gateway.emitProgress(versionId, {
        versionId,
        stage: 'input_export',
        progress: 10,
        message: 'Xuất input',
        timestamp: new Date(),
      });

      const events = await eventPromise;
      expect(events).toHaveLength(2);
      expect(events[1].stage).toBe('input_export');
    });
  });

  describe('completeVersion', () => {
    it('should complete the subject and clean up resources', async () => {
      const version = createMockVersion({
        status: TimetableVersionStatus.GENERATING,
      });
      mockVersionRepo.findOne.mockResolvedValue(version);

      // Create a subscriber
      const observable = gateway.streamProgress(versionId, schoolId);
      const eventsPromise = lastValueFrom(observable.pipe(toArray()));

      await new Promise((resolve) => setImmediate(resolve));

      expect(gateway.getActiveStreamCount()).toBe(1);

      // Complete the version
      gateway.completeVersion(versionId);

      const events = await eventsPromise;
      expect(events).toHaveLength(1); // Only initial event
      expect(gateway.getActiveStreamCount()).toBe(0);
    });

    it('should be a no-op for unknown versionId', () => {
      expect(() => gateway.completeVersion('unknown-id')).not.toThrow();
      expect(gateway.getActiveStreamCount()).toBe(0);
    });
  });

  describe('getActiveStreamCount', () => {
    it('should return 0 when no active streams', () => {
      expect(gateway.getActiveStreamCount()).toBe(0);
    });
  });

  describe('getLatestProgress', () => {
    it('should return null for unknown version', () => {
      expect(gateway.getLatestProgress('unknown')).toBeNull();
    });

    it('should return the last emitted event', () => {
      const event: ProgressEvent = {
        versionId,
        stage: 'output_parsing',
        progress: 85,
        message: 'Đang phân tích kết quả',
        timestamp: new Date(),
      };

      gateway.emitProgress(versionId, event);
      expect(gateway.getLatestProgress(versionId)).toEqual(event);
    });
  });
});
