import { Test, TestingModule } from '@nestjs/testing';
import { DataSource, EntityManager } from 'typeorm';
import { ResultMapperService } from './result-mapper.service';
import { TimetableSlotEntity } from '../entities/timetable-slot.entity';
import { ParsedSlotDto } from '../interfaces/fet-dto.interface';
import { ResultMappingException } from '../exceptions';

describe('ResultMapperService', () => {
  let service: ResultMapperService;
  let mockManager: jest.Mocked<Pick<EntityManager, 'save'>>;
  let mockDataSource: { transaction: jest.Mock };

  const versionId = '11111111-1111-1111-1111-111111111111';
  const schoolId = '22222222-2222-2222-2222-222222222222';

  const sampleSlots: ParsedSlotDto[] = [
    {
      teacherId: 'teacher-001',
      classId: 'class-001',
      subjectId: 'subject-001',
      roomId: 'room-001',
      dayOfWeek: 2,
      periodId: 'period-001',
      isDoublePeriod: false,
    },
    {
      teacherId: 'teacher-002',
      classId: 'class-002',
      subjectId: 'subject-002',
      roomId: null,
      dayOfWeek: 3,
      periodId: 'period-002',
      isDoublePeriod: true,
    },
  ];

  beforeEach(async () => {
    mockManager = {
      save: jest.fn(),
    };

    mockDataSource = {
      transaction: jest.fn(
        async (callback: (manager: EntityManager) => Promise<unknown>) => {
          return callback(mockManager as unknown as EntityManager);
        },
      ),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ResultMapperService,
        {
          provide: DataSource,
          useValue: mockDataSource,
        },
      ],
    }).compile();

    service = module.get<ResultMapperService>(ResultMapperService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('persistSlots', () => {
    it('should persist all slots within a transaction and return success', async () => {
      const savedEntities = sampleSlots.map((dto) => {
        const entity = new TimetableSlotEntity();
        entity.versionId = versionId;
        entity.schoolId = schoolId;
        entity.teacherId = dto.teacherId;
        entity.classId = dto.classId;
        entity.subjectId = dto.subjectId;
        entity.roomId = dto.roomId;
        entity.dayOfWeek = dto.dayOfWeek;
        entity.periodId = dto.periodId;
        entity.isDoublePeriod = dto.isDoublePeriod;
        return entity;
      });

      mockManager.save.mockResolvedValue(savedEntities);

      const result = await service.persistSlots(
        versionId,
        sampleSlots,
        schoolId,
      );

      expect(result).toEqual({
        success: true,
        slotCount: 2,
        errors: [],
      });
      expect(mockDataSource.transaction).toHaveBeenCalledTimes(1);
      expect(mockManager.save).toHaveBeenCalledTimes(1);
      expect(mockManager.save).toHaveBeenCalledWith(
        TimetableSlotEntity,
        expect.arrayContaining([
          expect.objectContaining({
            versionId,
            schoolId,
            teacherId: 'teacher-001',
            classId: 'class-001',
            subjectId: 'subject-001',
            roomId: 'room-001',
            dayOfWeek: 2,
            periodId: 'period-001',
            isDoublePeriod: false,
          }),
          expect.objectContaining({
            versionId,
            schoolId,
            teacherId: 'teacher-002',
            classId: 'class-002',
            subjectId: 'subject-002',
            roomId: null,
            dayOfWeek: 3,
            periodId: 'period-002',
            isDoublePeriod: true,
          }),
        ]),
      );
    });

    it('should return success with slotCount 0 for empty slots array', async () => {
      const result = await service.persistSlots(versionId, [], schoolId);

      expect(result).toEqual({
        success: true,
        slotCount: 0,
        errors: [],
      });
      expect(mockDataSource.transaction).not.toHaveBeenCalled();
    });

    it('should throw ResultMappingException when database transaction fails', async () => {
      const dbError = new Error('Connection refused');
      mockDataSource.transaction.mockRejectedValue(dbError);

      await expect(
        service.persistSlots(versionId, sampleSlots, schoolId),
      ).rejects.toThrow(ResultMappingException);

      await expect(
        service.persistSlots(versionId, sampleSlots, schoolId),
      ).rejects.toThrow(/Lỗi ánh xạ kết quả TKB/);
    });

    it('should set versionId and schoolId on every slot entity', async () => {
      mockManager.save.mockImplementation(
        async (_entityClass, entities) => entities,
      );

      await service.persistSlots(versionId, sampleSlots, schoolId);

      const savedEntities = mockManager.save.mock
        .calls[0][1] as TimetableSlotEntity[];

      for (const entity of savedEntities) {
        expect(entity.versionId).toBe(versionId);
        expect(entity.schoolId).toBe(schoolId);
      }
    });

    it('should map all DTO fields correctly to entity instances', async () => {
      mockManager.save.mockImplementation(
        async (_entityClass, entities) => entities,
      );

      await service.persistSlots(versionId, sampleSlots, schoolId);

      const savedEntities = mockManager.save.mock
        .calls[0][1] as TimetableSlotEntity[];

      expect(savedEntities[0].teacherId).toBe('teacher-001');
      expect(savedEntities[0].classId).toBe('class-001');
      expect(savedEntities[0].subjectId).toBe('subject-001');
      expect(savedEntities[0].roomId).toBe('room-001');
      expect(savedEntities[0].dayOfWeek).toBe(2);
      expect(savedEntities[0].periodId).toBe('period-001');
      expect(savedEntities[0].isDoublePeriod).toBe(false);

      expect(savedEntities[1].roomId).toBeNull();
      expect(savedEntities[1].isDoublePeriod).toBe(true);
    });

    it('should throw ResultMappingException wrapping the original error cause', async () => {
      const originalError = new Error('unique constraint violation');
      mockDataSource.transaction.mockRejectedValue(originalError);

      try {
        await service.persistSlots(versionId, sampleSlots, schoolId);
        fail('Expected ResultMappingException to be thrown');
      } catch (error: unknown) {
        expect(error).toBeInstanceOf(ResultMappingException);
        const mappingError = error as ResultMappingException;
        expect(mappingError.cause).toBe(originalError);
      }
    });
  });
});
