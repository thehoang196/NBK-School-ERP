import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException, BadRequestException } from '@nestjs/common';
import { DataSource, EntityManager } from 'typeorm';
import { TimetableVersionService } from '../../../src/modules/timetable/services/timetable-version.service';
import { TimetableVersionRepository } from '../../../src/modules/timetable/repositories/timetable-version.repository';
import { TimetableSlotRepository } from '../../../src/modules/timetable/repositories/timetable-slot.repository';
import { TimetableVersionEntity } from '../../../src/modules/timetable/entities/timetable-version.entity';
import { TimetableSlotEntity } from '../../../src/modules/timetable/entities/timetable-slot.entity';
import { CreateTimetableVersionDto } from '../../../src/modules/timetable/dto/create-timetable-version.dto';
import { UpdateTimetableVersionDto } from '../../../src/modules/timetable/dto/update-timetable-version.dto';
import { TimetableVersionQueryDto } from '../../../src/modules/timetable/dto/timetable-query.dto';
import { TimetableStatus } from '../../../src/common/enums/status.enum';

type TransactionCallback = (entityManager: EntityManager) => Promise<unknown>;

describe('TimetableVersionService', () => {
  let service: TimetableVersionService;
  let versionRepo: jest.Mocked<TimetableVersionRepository>;
  let slotRepo: jest.Mocked<TimetableSlotRepository>;
  let dataSource: jest.Mocked<DataSource>;

  const mockVersion: TimetableVersionEntity = {
    id: '11111111-1111-1111-1111-111111111111',
    semesterId: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
    semester: {} as TimetableVersionEntity['semester'],
    name: 'TKB v1 - HK1 2025-2026',
    versionNumber: 1,
    status: TimetableStatus.DRAFT,
    effectiveDate: '2025-09-01',
    publishedAt: null,
    publishedBy: null,
    note: null,
    slots: [],
    createdAt: new Date('2025-01-01'),
    updatedAt: new Date('2025-01-01'),
    deletedAt: null,
  };

  const mockPublishedVersion: TimetableVersionEntity = {
    ...mockVersion,
    id: '22222222-2222-2222-2222-222222222222',
    versionNumber: 2,
    status: TimetableStatus.PUBLISHED,
    publishedAt: new Date('2025-01-15'),
    publishedBy: 'user-1',
  };

  beforeEach(async () => {
    const mockVersionRepo = {
      create: jest.fn(),
      findAll: jest.fn(),
      findById: jest.fn(),
      findByIdWithSlots: jest.fn(),
      findPublished: jest.fn(),
      update: jest.fn(),
      publish: jest.fn(),
      softDelete: jest.fn(),
      getNextVersionNumber: jest.fn(),
    };

    const mockSlotRepo = {
      findByVersion: jest.fn(),
      create: jest.fn(),
      createMany: jest.fn(),
    };

    const mockDataSource = {
      transaction: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TimetableVersionService,
        { provide: TimetableVersionRepository, useValue: mockVersionRepo },
        { provide: TimetableSlotRepository, useValue: mockSlotRepo },
        { provide: DataSource, useValue: mockDataSource },
      ],
    }).compile();

    service = module.get<TimetableVersionService>(TimetableVersionService);
    versionRepo = module.get(TimetableVersionRepository);
    slotRepo = module.get(TimetableSlotRepository);
    dataSource = module.get(DataSource);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  // === CREATE ===
  describe('create()', () => {
    it('should auto-assign versionNumber and create with DRAFT status', async () => {
      const dto: CreateTimetableVersionDto = {
        semesterId: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
        name: 'TKB v1 - HK1 2025-2026',
        effectiveDate: '2025-09-01',
        note: 'Ghi chú',
      };

      versionRepo.getNextVersionNumber.mockResolvedValue(3);
      versionRepo.create.mockResolvedValue({
        ...mockVersion,
        versionNumber: 3,
        note: 'Ghi chú',
      });

      const result = await service.create(dto);

      expect(versionRepo.getNextVersionNumber).toHaveBeenCalledWith(dto.semesterId);
      expect(versionRepo.create).toHaveBeenCalledWith({
        semesterId: dto.semesterId,
        name: dto.name,
        versionNumber: 3,
        status: TimetableStatus.DRAFT,
        effectiveDate: '2025-09-01',
        note: 'Ghi chú',
      });
      expect(result.versionNumber).toBe(3);
      expect(result.status).toBe(TimetableStatus.DRAFT);
    });

    it('should handle optional fields as null', async () => {
      const dto: CreateTimetableVersionDto = {
        semesterId: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
        name: 'TKB v1',
      };

      versionRepo.getNextVersionNumber.mockResolvedValue(1);
      versionRepo.create.mockResolvedValue(mockVersion);

      await service.create(dto);

      expect(versionRepo.create).toHaveBeenCalledWith({
        semesterId: dto.semesterId,
        name: dto.name,
        versionNumber: 1,
        status: TimetableStatus.DRAFT,
        effectiveDate: null,
        note: null,
      });
    });
  });

  // === FIND ALL ===
  describe('findAll()', () => {
    it('should return paginated results', async () => {
      const query: TimetableVersionQueryDto = {
        page: 1,
        limit: 20,
        sortOrder: 'ASC',
      };

      const versions = [mockVersion, { ...mockVersion, id: '33333333-3333-3333-3333-333333333333', versionNumber: 2 }];
      versionRepo.findAll.mockResolvedValue([versions, 2]);

      const result = await service.findAll(query);

      expect(versionRepo.findAll).toHaveBeenCalledWith(query);
      expect(result.success).toBe(true);
      expect(result.data).toHaveLength(2);
      expect(result.meta).toEqual({
        page: 1,
        limit: 20,
        total: 2,
        totalPages: 1,
      });
    });

    it('should calculate totalPages correctly', async () => {
      const query: TimetableVersionQueryDto = {
        page: 1,
        limit: 10,
        sortOrder: 'ASC',
      };

      versionRepo.findAll.mockResolvedValue([[mockVersion], 25]);

      const result = await service.findAll(query);

      expect(result.meta.totalPages).toBe(3); // ceil(25/10)
    });
  });

  // === FIND BY ID ===
  describe('findById()', () => {
    it('should return version when found', async () => {
      versionRepo.findById.mockResolvedValue(mockVersion);

      const result = await service.findById(mockVersion.id);

      expect(versionRepo.findById).toHaveBeenCalledWith(mockVersion.id);
      expect(result).toEqual(mockVersion);
    });

    it('should throw NotFoundException if not found', async () => {
      versionRepo.findById.mockResolvedValue(null);

      await expect(service.findById('non-existent-id')).rejects.toThrow(NotFoundException);
      await expect(service.findById('non-existent-id')).rejects.toThrow('Không tìm thấy phiên bản TKB');
    });
  });

  // === UPDATE ===
  describe('update()', () => {
    it('should update draft version successfully', async () => {
      const dto: UpdateTimetableVersionDto = {
        name: 'TKB v1 - Updated',
        note: 'Cập nhật',
      };

      const updatedVersion: TimetableVersionEntity = { ...mockVersion, name: 'TKB v1 - Updated', note: 'Cập nhật' };
      versionRepo.findById.mockResolvedValue(mockVersion);
      versionRepo.update.mockResolvedValue(updatedVersion);

      const result = await service.update(mockVersion.id, dto);

      expect(versionRepo.update).toHaveBeenCalledWith(mockVersion.id, {
        name: 'TKB v1 - Updated',
        note: 'Cập nhật',
      });
      expect(result.name).toBe('TKB v1 - Updated');
    });

    it('should throw BadRequestException if version is not DRAFT', async () => {
      versionRepo.findById.mockResolvedValue(mockPublishedVersion);

      const dto: UpdateTimetableVersionDto = { name: 'New name' };

      await expect(service.update(mockPublishedVersion.id, dto)).rejects.toThrow(BadRequestException);
      await expect(service.update(mockPublishedVersion.id, dto)).rejects.toThrow(
        'Chỉ có thể cập nhật phiên bản ở trạng thái nháp',
      );
    });

    it('should only include provided fields in the update payload', async () => {
      const dto: UpdateTimetableVersionDto = { name: 'Only name' };

      versionRepo.findById.mockResolvedValue(mockVersion);
      versionRepo.update.mockResolvedValue({ ...mockVersion, name: 'Only name' });

      await service.update(mockVersion.id, dto);

      expect(versionRepo.update).toHaveBeenCalledWith(mockVersion.id, {
        name: 'Only name',
      });
    });
  });

  // === DELETE ===
  describe('delete()', () => {
    it('should soft-delete draft version', async () => {
      versionRepo.findById.mockResolvedValue(mockVersion);
      versionRepo.softDelete.mockResolvedValue(undefined);

      await service.delete(mockVersion.id);

      expect(versionRepo.softDelete).toHaveBeenCalledWith(mockVersion.id);
    });

    it('should throw BadRequestException if version is not DRAFT', async () => {
      versionRepo.findById.mockResolvedValue(mockPublishedVersion);

      await expect(service.delete(mockPublishedVersion.id)).rejects.toThrow(BadRequestException);
      await expect(service.delete(mockPublishedVersion.id)).rejects.toThrow(
        'Chỉ có thể xóa phiên bản ở trạng thái nháp',
      );
    });
  });

  // === PUBLISH ===
  describe('publish()', () => {
    const userId = 'user-uuid-1234';

    it('should publish DRAFT version successfully', async () => {
      const publishedResult = {
        ...mockVersion,
        status: TimetableStatus.PUBLISHED,
        publishedAt: new Date(),
        publishedBy: userId,
      };

      versionRepo.findById.mockResolvedValue(mockVersion);
      versionRepo.findPublished.mockResolvedValue(null);
      versionRepo.publish.mockResolvedValue(publishedResult);

      const result = await service.publish(mockVersion.id, userId);

      expect(versionRepo.publish).toHaveBeenCalledWith(mockVersion.id, userId);
      expect(result.status).toBe(TimetableStatus.PUBLISHED);
    });

    it('should archive existing published version before publishing', async () => {
      const existingPublished: TimetableVersionEntity = {
        ...mockPublishedVersion,
        semesterId: mockVersion.semesterId,
      };

      versionRepo.findById.mockResolvedValue(mockVersion);
      versionRepo.findPublished.mockResolvedValue(existingPublished);
      versionRepo.update.mockResolvedValue({
        ...existingPublished,
        status: TimetableStatus.ARCHIVED,
      });
      versionRepo.publish.mockResolvedValue({
        ...mockVersion,
        status: TimetableStatus.PUBLISHED,
        publishedAt: new Date(),
        publishedBy: userId,
      });

      await service.publish(mockVersion.id, userId);

      expect(versionRepo.update).toHaveBeenCalledWith(existingPublished.id, {
        status: TimetableStatus.ARCHIVED,
      });
      expect(versionRepo.publish).toHaveBeenCalledWith(mockVersion.id, userId);
    });

    it('should throw BadRequestException if version is not DRAFT', async () => {
      versionRepo.findById.mockResolvedValue(mockPublishedVersion);

      await expect(service.publish(mockPublishedVersion.id, userId)).rejects.toThrow(BadRequestException);
      await expect(service.publish(mockPublishedVersion.id, userId)).rejects.toThrow(
        'Chỉ có thể công bố phiên bản ở trạng thái nháp',
      );
    });
  });

  // === ROLLBACK ===
  describe('rollback()', () => {
    const sourceSlots: Partial<TimetableSlotEntity>[] = [
      {
        id: 'slot-1',
        versionId: mockVersion.id,
        dayOfWeek: 2,
        periodId: 'period-1',
        classId: 'class-1',
        teacherId: 'teacher-1',
        subjectId: 'subject-1',
        roomId: 'room-1',
        isDoublePeriod: false,
      },
      {
        id: 'slot-2',
        versionId: mockVersion.id,
        dayOfWeek: 3,
        periodId: 'period-2',
        classId: 'class-2',
        teacherId: 'teacher-2',
        subjectId: 'subject-2',
        roomId: null,
        isDoublePeriod: true,
      },
    ];

    const sourceVersionWithSlots: TimetableVersionEntity = {
      ...mockVersion,
      versionNumber: 2,
      slots: sourceSlots as TimetableSlotEntity[],
    };

    it('should create new version from source', async () => {
      const newVersion = {
        ...mockVersion,
        id: 'new-version-id',
        versionNumber: 3,
        name: `Rollback từ v2 - ${mockVersion.name}`,
        note: 'Rollback từ phiên bản #2',
      };

      versionRepo.findByIdWithSlots.mockResolvedValue(sourceVersionWithSlots);
      versionRepo.getNextVersionNumber.mockResolvedValue(3);

      const mockManager: Partial<EntityManager> = {
        create: jest.fn().mockImplementation((_entity, data) => data),
        save: jest.fn().mockImplementation((_entity, data) => {
          if (Array.isArray(data)) return data;
          return { ...data, id: 'new-version-id' };
        }),
      };

      (dataSource.transaction as jest.Mock).mockImplementation(async (cb: TransactionCallback) => {
        return cb(mockManager as EntityManager);
      });

      const result = await service.rollback(mockVersion.id);

      expect(versionRepo.findByIdWithSlots).toHaveBeenCalledWith(mockVersion.id);
      expect(versionRepo.getNextVersionNumber).toHaveBeenCalledWith(sourceVersionWithSlots.semesterId);
      expect(mockManager.create).toHaveBeenCalledWith(TimetableVersionEntity, expect.objectContaining({
        semesterId: sourceVersionWithSlots.semesterId,
        versionNumber: 3,
        status: TimetableStatus.DRAFT,
      }));
      expect(result).toBeDefined();
    });

    it('should copy slots from source version', async () => {
      versionRepo.findByIdWithSlots.mockResolvedValue(sourceVersionWithSlots);
      versionRepo.getNextVersionNumber.mockResolvedValue(3);

      const savedSlots: Partial<TimetableSlotEntity>[] = [];
      const mockManager: Partial<EntityManager> = {
        create: jest.fn().mockImplementation((_entity, data) => data),
        save: jest.fn().mockImplementation((_entity, data) => {
          if (Array.isArray(data)) {
            savedSlots.push(...data);
            return data;
          }
          return { ...data, id: 'new-version-id' };
        }),
      };

      (dataSource.transaction as jest.Mock).mockImplementation(async (cb: TransactionCallback) => {
        return cb(mockManager as EntityManager);
      });

      await service.rollback(mockVersion.id);

      // Verify slots were created (save called with array of slots)
      expect(mockManager.save).toHaveBeenCalledWith(
        TimetableSlotEntity,
        expect.arrayContaining([
          expect.objectContaining({
            versionId: 'new-version-id',
            dayOfWeek: 2,
            periodId: 'period-1',
            classId: 'class-1',
            teacherId: 'teacher-1',
            subjectId: 'subject-1',
            roomId: 'room-1',
            isDoublePeriod: false,
          }),
          expect.objectContaining({
            versionId: 'new-version-id',
            dayOfWeek: 3,
            periodId: 'period-2',
            classId: 'class-2',
            teacherId: 'teacher-2',
            subjectId: 'subject-2',
            roomId: null,
            isDoublePeriod: true,
          }),
        ]),
      );
    });

    it('should throw NotFoundException if source version not found', async () => {
      versionRepo.findByIdWithSlots.mockResolvedValue(null);

      await expect(service.rollback('non-existent-id')).rejects.toThrow(NotFoundException);
      await expect(service.rollback('non-existent-id')).rejects.toThrow(
        'Không tìm thấy phiên bản TKB nguồn',
      );
    });

    it('should handle source version with no slots', async () => {
      const sourceWithoutSlots: TimetableVersionEntity = {
        ...mockVersion,
        slots: [],
      };

      versionRepo.findByIdWithSlots.mockResolvedValue(sourceWithoutSlots);
      versionRepo.getNextVersionNumber.mockResolvedValue(2);

      const mockManager: Partial<EntityManager> = {
        create: jest.fn().mockImplementation((_entity, data) => data),
        save: jest.fn().mockImplementation((_entity, data) => {
          return { ...data, id: 'new-version-id' };
        }),
      };

      (dataSource.transaction as jest.Mock).mockImplementation(async (cb: TransactionCallback) => {
        return cb(mockManager as EntityManager);
      });

      await service.rollback(mockVersion.id);

      // save should only be called once (for version), not for slots
      expect(mockManager.save).toHaveBeenCalledTimes(1);
      expect(mockManager.save).toHaveBeenCalledWith(TimetableVersionEntity, expect.anything());
    });
  });
});
