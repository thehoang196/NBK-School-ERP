import { ConflictException } from '@nestjs/common';
import { Repository } from 'typeorm';
import { TimetableVersionStateMachineService } from './timetable-version-state-machine.service';
import { TimetableVersionEntity } from '../entities/timetable-version.entity';
import { TimetableVersionStatus } from '../../../common/enums/status.enum';
import { InvalidStateTransitionException } from '../exceptions/invalid-state-transition.exception';
import { PublishedVersionImmutableException } from '../exceptions/published-version-immutable.exception';
import { TransitionMetadata } from '../interfaces/generation-pipeline.interface';

describe('TimetableVersionStateMachineService', () => {
  let service: TimetableVersionStateMachineService;
  let mockRepository: jest.Mocked<
    Pick<Repository<TimetableVersionEntity>, 'save'>
  >;

  beforeEach(() => {
    mockRepository = {
      save: jest.fn(),
    };
    service = new TimetableVersionStateMachineService(
      mockRepository as unknown as Repository<TimetableVersionEntity>,
    );
  });

  function createMockVersion(
    status: TimetableVersionStatus,
    overrides?: Partial<TimetableVersionEntity>,
  ): TimetableVersionEntity {
    const version = new TimetableVersionEntity();
    version.id = 'version-uuid-1';
    version.status = status;
    version.schoolId = 'school-uuid-1';
    version.semesterId = 'semester-uuid-1';
    version.name = 'Test Version';
    version.versionNumber = 1;
    version.version = 1;
    version.generationStartedAt = null;
    version.generationCompletedAt = null;
    version.generationDurationMs = null;
    version.errorMessage = null;
    version.errorStack = null;
    version.publishedAt = null;
    version.publishedBy = null;
    version.hasConflicts = false;
    version.conflictCount = 0;
    Object.assign(version, overrides);
    return version;
  }

  describe('canTransition()', () => {
    const validTransitions: [TimetableVersionStatus, TimetableVersionStatus][] =
      [
        [TimetableVersionStatus.DRAFT, TimetableVersionStatus.GENERATING],
        [TimetableVersionStatus.GENERATING, TimetableVersionStatus.GENERATED],
        [TimetableVersionStatus.GENERATING, TimetableVersionStatus.FAILED],
        [TimetableVersionStatus.GENERATED, TimetableVersionStatus.REVIEWING],
        [TimetableVersionStatus.REVIEWING, TimetableVersionStatus.PUBLISHED],
        [TimetableVersionStatus.REVIEWING, TimetableVersionStatus.DRAFT],
        [TimetableVersionStatus.PUBLISHED, TimetableVersionStatus.ARCHIVED],
        [TimetableVersionStatus.FAILED, TimetableVersionStatus.DRAFT],
      ];

    it.each(validTransitions)(
      'should return true for valid transition %s → %s',
      (current, target) => {
        expect(service.canTransition(current, target)).toBe(true);
      },
    );

    const invalidTransitions: [
      TimetableVersionStatus,
      TimetableVersionStatus,
    ][] = [
      [TimetableVersionStatus.DRAFT, TimetableVersionStatus.PUBLISHED],
      [TimetableVersionStatus.DRAFT, TimetableVersionStatus.FAILED],
      [TimetableVersionStatus.DRAFT, TimetableVersionStatus.GENERATED],
      [TimetableVersionStatus.GENERATING, TimetableVersionStatus.PUBLISHED],
      [TimetableVersionStatus.GENERATING, TimetableVersionStatus.DRAFT],
      [TimetableVersionStatus.GENERATED, TimetableVersionStatus.PUBLISHED],
      [TimetableVersionStatus.GENERATED, TimetableVersionStatus.DRAFT],
      [TimetableVersionStatus.PUBLISHED, TimetableVersionStatus.DRAFT],
      [TimetableVersionStatus.PUBLISHED, TimetableVersionStatus.GENERATING],
      [TimetableVersionStatus.ARCHIVED, TimetableVersionStatus.DRAFT],
      [TimetableVersionStatus.ARCHIVED, TimetableVersionStatus.PUBLISHED],
      [TimetableVersionStatus.FAILED, TimetableVersionStatus.GENERATING],
      [TimetableVersionStatus.FAILED, TimetableVersionStatus.PUBLISHED],
    ];

    it.each(invalidTransitions)(
      'should return false for invalid transition %s → %s',
      (current, target) => {
        expect(service.canTransition(current, target)).toBe(false);
      },
    );
  });

  describe('transition()', () => {
    describe('valid transitions', () => {
      it('should transition draft → generating and set generationStartedAt', async () => {
        const version = createMockVersion(TimetableVersionStatus.DRAFT);
        mockRepository.save.mockResolvedValue({
          ...version,
          status: TimetableVersionStatus.GENERATING,
        } as TimetableVersionEntity);

        const result = await service.transition(
          version,
          TimetableVersionStatus.GENERATING,
        );

        expect(version.status).toBe(TimetableVersionStatus.GENERATING);
        expect(version.generationStartedAt).toBeInstanceOf(Date);
        expect(version.generationCompletedAt).toBeNull();
        expect(version.generationDurationMs).toBeNull();
        expect(mockRepository.save).toHaveBeenCalledWith(version);
        expect(result.status).toBe(TimetableVersionStatus.GENERATING);
      });

      it('should transition generating → generated and calculate duration', async () => {
        const startedAt = new Date(Date.now() - 5000);
        const version = createMockVersion(TimetableVersionStatus.GENERATING, {
          generationStartedAt: startedAt,
        });
        mockRepository.save.mockResolvedValue(version);

        const metadata: TransitionMetadata = {
          conflictCount: 3,
          warningFlag: true,
        };
        await service.transition(
          version,
          TimetableVersionStatus.GENERATED,
          metadata,
        );

        expect(version.status).toBe(TimetableVersionStatus.GENERATED);
        expect(version.generationCompletedAt).toBeInstanceOf(Date);
        expect(version.generationDurationMs).toBeGreaterThan(0);
        expect(version.conflictCount).toBe(3);
        expect(version.hasConflicts).toBe(true);
      });

      it('should transition generating → failed and store error info', async () => {
        const startedAt = new Date(Date.now() - 2000);
        const version = createMockVersion(TimetableVersionStatus.GENERATING, {
          generationStartedAt: startedAt,
        });
        mockRepository.save.mockResolvedValue(version);

        const metadata: TransitionMetadata = {
          errorMessage: 'FET timeout exceeded',
          errorStack: 'Error: timeout\n  at FetEngine.solve()',
        };
        await service.transition(
          version,
          TimetableVersionStatus.FAILED,
          metadata,
        );

        expect(version.status).toBe(TimetableVersionStatus.FAILED);
        expect(version.generationCompletedAt).toBeInstanceOf(Date);
        expect(version.generationDurationMs).toBeGreaterThan(0);
        expect(version.errorMessage).toBe('FET timeout exceeded');
        expect(version.errorStack).toBe(
          'Error: timeout\n  at FetEngine.solve()',
        );
      });

      it('should transition reviewing → published and set publishedBy/publishedAt', async () => {
        const version = createMockVersion(TimetableVersionStatus.REVIEWING);
        mockRepository.save.mockResolvedValue(version);

        const metadata: TransitionMetadata = { userId: 'user-uuid-123' };
        await service.transition(
          version,
          TimetableVersionStatus.PUBLISHED,
          metadata,
        );

        expect(version.status).toBe(TimetableVersionStatus.PUBLISHED);
        expect(version.publishedAt).toBeInstanceOf(Date);
        expect(version.publishedBy).toBe('user-uuid-123');
      });

      it('should transition published → archived', async () => {
        const version = createMockVersion(TimetableVersionStatus.PUBLISHED);
        mockRepository.save.mockResolvedValue(version);

        await service.transition(version, TimetableVersionStatus.ARCHIVED);

        expect(version.status).toBe(TimetableVersionStatus.ARCHIVED);
        expect(mockRepository.save).toHaveBeenCalledWith(version);
      });

      it('should transition failed → draft and clear error fields', async () => {
        const version = createMockVersion(TimetableVersionStatus.FAILED, {
          errorMessage: 'some error',
          errorStack: 'stack trace',
        });
        mockRepository.save.mockResolvedValue(version);

        await service.transition(version, TimetableVersionStatus.DRAFT);

        expect(version.status).toBe(TimetableVersionStatus.DRAFT);
        expect(version.errorMessage).toBeNull();
        expect(version.errorStack).toBeNull();
      });

      it('should transition reviewing → draft and clear error fields', async () => {
        const version = createMockVersion(TimetableVersionStatus.REVIEWING);
        mockRepository.save.mockResolvedValue(version);

        await service.transition(version, TimetableVersionStatus.DRAFT);

        expect(version.status).toBe(TimetableVersionStatus.DRAFT);
        expect(version.errorMessage).toBeNull();
        expect(version.errorStack).toBeNull();
      });
    });

    describe('invalid transitions', () => {
      it('should throw InvalidStateTransitionException for invalid transition', async () => {
        const version = createMockVersion(TimetableVersionStatus.DRAFT);

        await expect(
          service.transition(version, TimetableVersionStatus.PUBLISHED),
        ).rejects.toThrow(InvalidStateTransitionException);
        expect(mockRepository.save).not.toHaveBeenCalled();
      });

      it('should throw PublishedVersionImmutableException for mutations on published version', async () => {
        const version = createMockVersion(TimetableVersionStatus.PUBLISHED);

        await expect(
          service.transition(version, TimetableVersionStatus.DRAFT),
        ).rejects.toThrow(PublishedVersionImmutableException);
        expect(mockRepository.save).not.toHaveBeenCalled();
      });

      it('should throw PublishedVersionImmutableException for generating transition on published', async () => {
        const version = createMockVersion(TimetableVersionStatus.PUBLISHED);

        await expect(
          service.transition(version, TimetableVersionStatus.GENERATING),
        ).rejects.toThrow(PublishedVersionImmutableException);
        expect(mockRepository.save).not.toHaveBeenCalled();
      });
    });

    describe('Vietnamese error messages', () => {
      it('should include Vietnamese message in InvalidStateTransitionException', async () => {
        const version = createMockVersion(TimetableVersionStatus.DRAFT);

        try {
          await service.transition(version, TimetableVersionStatus.PUBLISHED);
          fail('Expected InvalidStateTransitionException');
        } catch (error) {
          expect(error).toBeInstanceOf(InvalidStateTransitionException);
          const response = (
            error as InvalidStateTransitionException
          ).getResponse() as Record<string, unknown>;
          expect(response.message).toBe(
            "Không thể chuyển trạng thái từ 'draft' sang 'published'.",
          );
          expect(response.currentStatus).toBe('draft');
          expect(response.targetStatus).toBe('published');
        }
      });

      it('should include Vietnamese message in PublishedVersionImmutableException', async () => {
        const version = createMockVersion(TimetableVersionStatus.PUBLISHED);

        try {
          await service.transition(version, TimetableVersionStatus.DRAFT);
          fail('Expected PublishedVersionImmutableException');
        } catch (error) {
          expect(error).toBeInstanceOf(PublishedVersionImmutableException);
          const response = (
            error as PublishedVersionImmutableException
          ).getResponse() as Record<string, unknown>;
          expect(response.message).toBe(
            'Phiên bản TKB đã công bố không thể chỉnh sửa.',
          );
        }
      });

      it('should include Vietnamese message in ConflictException for optimistic lock', async () => {
        const version = createMockVersion(TimetableVersionStatus.DRAFT);
        const optimisticError = new Error(
          'The optimistic lock on entity TimetableVersionEntity failed',
        );
        optimisticError.name = 'OptimisticLockVersionMismatchError';
        mockRepository.save.mockRejectedValue(optimisticError);

        try {
          await service.transition(version, TimetableVersionStatus.GENERATING);
          fail('Expected ConflictException');
        } catch (error) {
          expect(error).toBeInstanceOf(ConflictException);
          const response = (error as ConflictException).getResponse() as Record<
            string,
            unknown
          >;
          expect(response.message).toBe(
            'Phiên bản TKB đã được cập nhật bởi người khác. Vui lòng tải lại và thử lại.',
          );
        }
      });
    });

    describe('optimistic locking', () => {
      it('should throw ConflictException when optimistic lock error occurs', async () => {
        const version = createMockVersion(TimetableVersionStatus.DRAFT);
        const optimisticError = new Error(
          'The optimistic lock on entity TimetableVersionEntity failed',
        );
        optimisticError.name = 'OptimisticLockVersionMismatchError';
        mockRepository.save.mockRejectedValue(optimisticError);

        await expect(
          service.transition(version, TimetableVersionStatus.GENERATING),
        ).rejects.toThrow(ConflictException);
      });

      it('should rethrow non-optimistic-lock errors', async () => {
        const version = createMockVersion(TimetableVersionStatus.DRAFT);
        const dbError = new Error('Connection refused');
        mockRepository.save.mockRejectedValue(dbError);

        await expect(
          service.transition(version, TimetableVersionStatus.GENERATING),
        ).rejects.toThrow('Connection refused');
      });
    });

    describe('metadata handling', () => {
      it('should handle transition without metadata', async () => {
        const version = createMockVersion(TimetableVersionStatus.GENERATED);
        mockRepository.save.mockResolvedValue(version);

        await service.transition(version, TimetableVersionStatus.REVIEWING);

        expect(version.status).toBe(TimetableVersionStatus.REVIEWING);
        expect(mockRepository.save).toHaveBeenCalled();
      });

      it('should set hasConflicts to false when conflictCount is 0', async () => {
        const startedAt = new Date(Date.now() - 1000);
        const version = createMockVersion(TimetableVersionStatus.GENERATING, {
          generationStartedAt: startedAt,
        });
        mockRepository.save.mockResolvedValue(version);

        await service.transition(version, TimetableVersionStatus.GENERATED, {
          conflictCount: 0,
        });

        expect(version.hasConflicts).toBe(false);
        expect(version.conflictCount).toBe(0);
      });
    });
  });
});
