import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException, BadRequestException } from '@nestjs/common';
import { DataSource, EntityManager, UpdateQueryBuilder } from 'typeorm';
import { TimetableVersionService } from '../../../src/modules/timetable/services/timetable-version.service';
import { TimetableVersionRepository } from '../../../src/modules/timetable/repositories/timetable-version.repository';
import { TimetableSlotRepository } from '../../../src/modules/timetable/repositories/timetable-slot.repository';
import { TimetableVersionEntity } from '../../../src/modules/timetable/entities/timetable-version.entity';
import { TimetableSlotEntity } from '../../../src/modules/timetable/entities/timetable-slot.entity';
import { CreateTimetableVersionDto } from '../../../src/modules/timetable/dto/create-timetable-version.dto';
import { UpdateTimetableVersionDto } from '../../../src/modules/timetable/dto/update-timetable-version.dto';
import { SaveTimetableVersionDto } from '../../../src/modules/timetable/dto/save-timetable-version.dto';
import { CreateSlotDto } from '../../../src/modules/timetable/dto/create-slot.dto';
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
    schoolId: null,
    school: null,
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

  // === SAVE AS NEW VERSION ===
  // Validates: Requirements 3.2, 3.4
  describe('saveAsNewVersion()', () => {
    const schoolId = 'school-uuid-1234';

    const validSlot: CreateSlotDto = {
      classId: 'class-uuid-1',
      dayOfWeek: 2,
      periodId: 'period-uuid-1',
      subjectId: 'subject-uuid-1',
      teacherId: 'teacher-uuid-1',
      roomId: 'room-uuid-1',
      isDoublePeriod: false,
    };

    const validDto: SaveTimetableVersionDto = {
      name: 'TKB v2 - HK1 2025-2026',
      semesterId: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
      effectiveDate: '2025-09-01',
      note: 'Ghi chú',
      slots: [validSlot],
    };

    // --- Name validation tests ---

    it('should reject empty name', async () => {
      const dto = { ...validDto, name: '' };

      await expect(service.saveAsNewVersion(dto, schoolId))
        .rejects.toThrow(BadRequestException);
      await expect(service.saveAsNewVersion(dto, schoolId))
        .rejects.toThrow('Tên phiên bản không được để trống');
    });

    it('should reject whitespace-only name', async () => {
      const dto = { ...validDto, name: '   \t\n  ' };

      await expect(service.saveAsNewVersion(dto, schoolId))
        .rejects.toThrow(BadRequestException);
      await expect(service.saveAsNewVersion(dto, schoolId))
        .rejects.toThrow('Tên phiên bản không được để trống');
    });


    it('should reject name longer than 100 characters', async () => {
      const dto = { ...validDto, name: 'A'.repeat(101) };

      await expect(service.saveAsNewVersion(dto, schoolId))
        .rejects.toThrow(BadRequestException);
      await expect(service.saveAsNewVersion(dto, schoolId))
        .rejects.toThrow('Tên phiên bản tối đa 100 ký tự');
    });

    it('should accept name with exactly 100 characters', async () => {
      const dto = { ...validDto, name: 'A'.repeat(100) };

      versionRepo.getNextVersionNumber.mockResolvedValue(1);
      const mockManager: Partial<EntityManager> = {
        create: jest.fn().mockImplementation((_entity, data) => data),
        save: jest.fn().mockImplementation((_entity, data) => {
          if (Array.isArray(data)) return data;
          return { ...data, id: 'new-version-id' };
        }),
      };
      (dataSource.transaction as jest.Mock).mockImplementation(
        async (cb: TransactionCallback) => cb(mockManager as EntityManager),
      );

      await expect(service.saveAsNewVersion(dto, schoolId)).resolves.toBeDefined();
    });

    // --- Slots validation tests ---

    it('should reject empty slots array', async () => {
      const dto = { ...validDto, slots: [] };

      await expect(service.saveAsNewVersion(dto, schoolId))
        .rejects.toThrow(BadRequestException);
      await expect(service.saveAsNewVersion(dto, schoolId))
        .rejects.toThrow('TKB trống không thể lưu phiên bản');
    });

    it('should reject undefined slots', async () => {
      const dto = { ...validDto, slots: undefined as unknown as CreateSlotDto[] };

      await expect(service.saveAsNewVersion(dto, schoolId))
        .rejects.toThrow(BadRequestException);
      await expect(service.saveAsNewVersion(dto, schoolId))
        .rejects.toThrow('TKB trống không thể lưu phiên bản');
    });

    // --- Transaction and version_number auto-increment tests ---

    it('should auto-increment version_number using getNextVersionNumber', async () => {
      versionRepo.getNextVersionNumber.mockResolvedValue(5);

      const mockManager: Partial<EntityManager> = {
        create: jest.fn().mockImplementation((_entity, data) => data),
        save: jest.fn().mockImplementation((_entity, data) => {
          if (Array.isArray(data)) return data;
          return { ...data, id: 'new-version-id' };
        }),
      };
      (dataSource.transaction as jest.Mock).mockImplementation(
        async (cb: TransactionCallback) => cb(mockManager as EntityManager),
      );

      await service.saveAsNewVersion(validDto, schoolId);

      expect(versionRepo.getNextVersionNumber).toHaveBeenCalledWith(validDto.semesterId);
      expect(mockManager.create).toHaveBeenCalledWith(
        TimetableVersionEntity,
        expect.objectContaining({ versionNumber: 5 }),
      );
    });

    it('should execute in a transaction', async () => {
      versionRepo.getNextVersionNumber.mockResolvedValue(1);

      const mockManager: Partial<EntityManager> = {
        create: jest.fn().mockImplementation((_entity, data) => data),
        save: jest.fn().mockImplementation((_entity, data) => {
          if (Array.isArray(data)) return data;
          return { ...data, id: 'new-version-id' };
        }),
      };
      (dataSource.transaction as jest.Mock).mockImplementation(
        async (cb: TransactionCallback) => cb(mockManager as EntityManager),
      );

      await service.saveAsNewVersion(validDto, schoolId);

      expect(dataSource.transaction).toHaveBeenCalledTimes(1);
      // Version saved first, then slots
      expect(mockManager.save).toHaveBeenCalledWith(TimetableVersionEntity, expect.anything());
      expect(mockManager.save).toHaveBeenCalledWith(TimetableSlotEntity, expect.any(Array));
    });

    it('should create version with DRAFT status and trimmed name', async () => {
      const dto = { ...validDto, name: '  TKB mới  ' };
      versionRepo.getNextVersionNumber.mockResolvedValue(3);

      const mockManager: Partial<EntityManager> = {
        create: jest.fn().mockImplementation((_entity, data) => data),
        save: jest.fn().mockImplementation((_entity, data) => {
          if (Array.isArray(data)) return data;
          return { ...data, id: 'new-version-id' };
        }),
      };
      (dataSource.transaction as jest.Mock).mockImplementation(
        async (cb: TransactionCallback) => cb(mockManager as EntityManager),
      );

      await service.saveAsNewVersion(dto, schoolId);

      expect(mockManager.create).toHaveBeenCalledWith(
        TimetableVersionEntity,
        expect.objectContaining({
          name: 'TKB mới',
          status: TimetableStatus.DRAFT,
          semesterId: validDto.semesterId,
          versionNumber: 3,
        }),
      );
    });

    it('should copy all slot fields correctly', async () => {
      const slotWithAllFields: CreateSlotDto = {
        classId: 'class-uuid-1',
        dayOfWeek: 5,
        periodId: 'period-uuid-3',
        subjectId: 'subject-uuid-2',
        teacherId: 'teacher-uuid-4',
        roomId: 'room-uuid-7',
        isDoublePeriod: true,
      };
      const slotWithoutRoom: CreateSlotDto = {
        classId: 'class-uuid-2',
        dayOfWeek: 3,
        periodId: 'period-uuid-1',
        subjectId: 'subject-uuid-3',
        teacherId: 'teacher-uuid-2',
        isDoublePeriod: false,
      };
      const dto = { ...validDto, slots: [slotWithAllFields, slotWithoutRoom] };
      versionRepo.getNextVersionNumber.mockResolvedValue(1);

      const createdSlots: unknown[] = [];
      const mockManager: Partial<EntityManager> = {
        create: jest.fn().mockImplementation((_entity, data) => {
          if (_entity === TimetableSlotEntity) createdSlots.push(data);
          return data;
        }),
        save: jest.fn().mockImplementation((_entity, data) => {
          if (Array.isArray(data)) return data;
          return { ...data, id: 'new-version-id' };
        }),
      };
      (dataSource.transaction as jest.Mock).mockImplementation(
        async (cb: TransactionCallback) => cb(mockManager as EntityManager),
      );

      await service.saveAsNewVersion(dto, schoolId);

      expect(mockManager.save).toHaveBeenCalledWith(
        TimetableSlotEntity,
        expect.arrayContaining([
          expect.objectContaining({
            versionId: 'new-version-id',
            classId: 'class-uuid-1',
            dayOfWeek: 5,
            periodId: 'period-uuid-3',
            subjectId: 'subject-uuid-2',
            teacherId: 'teacher-uuid-4',
            roomId: 'room-uuid-7',
            isDoublePeriod: true,
          }),
          expect.objectContaining({
            versionId: 'new-version-id',
            classId: 'class-uuid-2',
            dayOfWeek: 3,
            periodId: 'period-uuid-1',
            subjectId: 'subject-uuid-3',
            teacherId: 'teacher-uuid-2',
            roomId: null,
            isDoublePeriod: false,
          }),
        ]),
      );
    });
  });

  // === CLONE VERSION ===
  // Validates: Requirements 4.5, 4.6
  describe('cloneVersion()', () => {
    const publishedVersionWithSlots: TimetableVersionEntity = {
      ...mockPublishedVersion,
      name: 'TKB chính thức',
      versionNumber: 2,
      slots: [
        {
          id: 'slot-1',
          versionId: mockPublishedVersion.id,
          dayOfWeek: 2,
          periodId: 'period-1',
          classId: 'class-1',
          teacherId: 'teacher-1',
          subjectId: 'subject-1',
          roomId: 'room-1',
          isDoublePeriod: false,
        } as TimetableSlotEntity,
        {
          id: 'slot-2',
          versionId: mockPublishedVersion.id,
          dayOfWeek: 4,
          periodId: 'period-3',
          classId: 'class-2',
          teacherId: 'teacher-2',
          subjectId: 'subject-2',
          roomId: null,
          isDoublePeriod: true,
        } as TimetableSlotEntity,
      ],
    };

    const archivedVersionWithSlots: TimetableVersionEntity = {
      ...mockVersion,
      id: '33333333-3333-3333-3333-333333333333',
      name: 'TKB cũ',
      versionNumber: 1,
      status: TimetableStatus.ARCHIVED,
      slots: [
        {
          id: 'slot-a',
          versionId: '33333333-3333-3333-3333-333333333333',
          dayOfWeek: 3,
          periodId: 'period-2',
          classId: 'class-1',
          teacherId: 'teacher-1',
          subjectId: 'subject-1',
          roomId: null,
          isDoublePeriod: false,
        } as TimetableSlotEntity,
      ],
    };

    it('should clone PUBLISHED version successfully', async () => {
      versionRepo.findByIdWithSlots.mockResolvedValue(publishedVersionWithSlots);
      versionRepo.getNextVersionNumber.mockResolvedValue(3);

      const mockManager: Partial<EntityManager> = {
        create: jest.fn().mockImplementation((_entity, data) => data),
        save: jest.fn().mockImplementation((_entity, data) => {
          if (Array.isArray(data)) return data;
          return { ...data, id: 'cloned-version-id' };
        }),
      };
      (dataSource.transaction as jest.Mock).mockImplementation(
        async (cb: TransactionCallback) => cb(mockManager as EntityManager),
      );

      const result = await service.cloneVersion(publishedVersionWithSlots.id);

      expect(result).toBeDefined();
      expect(mockManager.create).toHaveBeenCalledWith(
        TimetableVersionEntity,
        expect.objectContaining({
          status: TimetableStatus.DRAFT,
          versionNumber: 3,
        }),
      );
    });

    it('should clone ARCHIVED version successfully', async () => {
      versionRepo.findByIdWithSlots.mockResolvedValue(archivedVersionWithSlots);
      versionRepo.getNextVersionNumber.mockResolvedValue(4);

      const mockManager: Partial<EntityManager> = {
        create: jest.fn().mockImplementation((_entity, data) => data),
        save: jest.fn().mockImplementation((_entity, data) => {
          if (Array.isArray(data)) return data;
          return { ...data, id: 'cloned-version-id' };
        }),
      };
      (dataSource.transaction as jest.Mock).mockImplementation(
        async (cb: TransactionCallback) => cb(mockManager as EntityManager),
      );

      const result = await service.cloneVersion(archivedVersionWithSlots.id);

      expect(result).toBeDefined();
      expect(mockManager.create).toHaveBeenCalledWith(
        TimetableVersionEntity,
        expect.objectContaining({
          status: TimetableStatus.DRAFT,
          versionNumber: 4,
        }),
      );
    });

    it('should reject cloning DRAFT version', async () => {
      const draftVersionWithSlots: TimetableVersionEntity = {
        ...mockVersion,
        status: TimetableStatus.DRAFT,
        slots: [],
      };
      versionRepo.findByIdWithSlots.mockResolvedValue(draftVersionWithSlots);

      await expect(service.cloneVersion(mockVersion.id))
        .rejects.toThrow(BadRequestException);
      await expect(service.cloneVersion(mockVersion.id))
        .rejects.toThrow('Chỉ có thể tạo bản sao từ phiên bản đã công bố hoặc lưu trữ');
    });

    it('should reject non-existent version', async () => {
      versionRepo.findByIdWithSlots.mockResolvedValue(null);

      await expect(service.cloneVersion('non-existent-id'))
        .rejects.toThrow(NotFoundException);
      await expect(service.cloneVersion('non-existent-id'))
        .rejects.toThrow('Không tìm thấy phiên bản TKB');
    });

    it('should copy all slots from source to new version', async () => {
      versionRepo.findByIdWithSlots.mockResolvedValue(publishedVersionWithSlots);
      versionRepo.getNextVersionNumber.mockResolvedValue(3);

      const mockManager: Partial<EntityManager> = {
        create: jest.fn().mockImplementation((_entity, data) => data),
        save: jest.fn().mockImplementation((_entity, data) => {
          if (Array.isArray(data)) return data;
          return { ...data, id: 'cloned-version-id' };
        }),
      };
      (dataSource.transaction as jest.Mock).mockImplementation(
        async (cb: TransactionCallback) => cb(mockManager as EntityManager),
      );

      await service.cloneVersion(publishedVersionWithSlots.id);

      expect(mockManager.save).toHaveBeenCalledWith(
        TimetableSlotEntity,
        expect.arrayContaining([
          expect.objectContaining({
            versionId: 'cloned-version-id',
            classId: 'class-1',
            dayOfWeek: 2,
            periodId: 'period-1',
            subjectId: 'subject-1',
            teacherId: 'teacher-1',
            roomId: 'room-1',
            isDoublePeriod: false,
          }),
          expect.objectContaining({
            versionId: 'cloned-version-id',
            classId: 'class-2',
            dayOfWeek: 4,
            periodId: 'period-3',
            subjectId: 'subject-2',
            teacherId: 'teacher-2',
            roomId: null,
            isDoublePeriod: true,
          }),
        ]),
      );
    });

    it('should auto-generate name from source version', async () => {
      versionRepo.findByIdWithSlots.mockResolvedValue(publishedVersionWithSlots);
      versionRepo.getNextVersionNumber.mockResolvedValue(3);

      const mockManager: Partial<EntityManager> = {
        create: jest.fn().mockImplementation((_entity, data) => data),
        save: jest.fn().mockImplementation((_entity, data) => {
          if (Array.isArray(data)) return data;
          return { ...data, id: 'cloned-version-id' };
        }),
      };
      (dataSource.transaction as jest.Mock).mockImplementation(
        async (cb: TransactionCallback) => cb(mockManager as EntityManager),
      );

      await service.cloneVersion(publishedVersionWithSlots.id);

      expect(mockManager.create).toHaveBeenCalledWith(
        TimetableVersionEntity,
        expect.objectContaining({
          name: 'Bản sao từ v2 - TKB chính thức',
        }),
      );
    });

    it('should have incremented version_number', async () => {
      versionRepo.findByIdWithSlots.mockResolvedValue(publishedVersionWithSlots);
      versionRepo.getNextVersionNumber.mockResolvedValue(7);

      const mockManager: Partial<EntityManager> = {
        create: jest.fn().mockImplementation((_entity, data) => data),
        save: jest.fn().mockImplementation((_entity, data) => {
          if (Array.isArray(data)) return data;
          return { ...data, id: 'cloned-version-id' };
        }),
      };
      (dataSource.transaction as jest.Mock).mockImplementation(
        async (cb: TransactionCallback) => cb(mockManager as EntityManager),
      );

      await service.cloneVersion(publishedVersionWithSlots.id);

      expect(versionRepo.getNextVersionNumber).toHaveBeenCalledWith(
        publishedVersionWithSlots.semesterId,
      );
      expect(mockManager.create).toHaveBeenCalledWith(
        TimetableVersionEntity,
        expect.objectContaining({ versionNumber: 7 }),
      );
    });
  });

  // === OVERWRITE SLOTS ===
  // Validates: Requirements 4.4, 4.5, 4.6
  describe('overwriteSlots()', () => {
    const newSlots: CreateSlotDto[] = [
      {
        classId: 'class-new-1',
        dayOfWeek: 2,
        periodId: 'period-new-1',
        subjectId: 'subject-new-1',
        teacherId: 'teacher-new-1',
        roomId: 'room-new-1',
        isDoublePeriod: false,
      },
      {
        classId: 'class-new-2',
        dayOfWeek: 4,
        periodId: 'period-new-2',
        subjectId: 'subject-new-2',
        teacherId: 'teacher-new-2',
        isDoublePeriod: true,
      },
    ];

    it('should allow overwrite on DRAFT version', async () => {
      versionRepo.findById.mockResolvedValue(mockVersion); // DRAFT

      const mockQueryBuilder = {
        update: jest.fn().mockReturnThis(),
        set: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        execute: jest.fn().mockResolvedValue({ affected: 3 }),
      };
      const mockManager: Partial<EntityManager> = {
        createQueryBuilder: jest.fn().mockReturnValue(mockQueryBuilder),
        create: jest.fn().mockImplementation((_entity, data) => data),
        save: jest.fn().mockResolvedValue([]),
      };
      (dataSource.transaction as jest.Mock).mockImplementation(
        async (cb: TransactionCallback) => cb(mockManager as EntityManager),
      );

      await expect(service.overwriteSlots(mockVersion.id, newSlots))
        .resolves.toBeUndefined();
    });

    it('should reject overwrite on PUBLISHED version', async () => {
      versionRepo.findById.mockResolvedValue(mockPublishedVersion);

      await expect(service.overwriteSlots(mockPublishedVersion.id, newSlots))
        .rejects.toThrow(BadRequestException);
      await expect(service.overwriteSlots(mockPublishedVersion.id, newSlots))
        .rejects.toThrow('Chỉ có thể chỉnh sửa phiên bản ở trạng thái nháp');
    });

    it('should reject overwrite on ARCHIVED version', async () => {
      const archivedVersion: TimetableVersionEntity = {
        ...mockVersion,
        id: '44444444-4444-4444-4444-444444444444',
        status: TimetableStatus.ARCHIVED,
      };
      versionRepo.findById.mockResolvedValue(archivedVersion);

      await expect(service.overwriteSlots(archivedVersion.id, newSlots))
        .rejects.toThrow(BadRequestException);
      await expect(service.overwriteSlots(archivedVersion.id, newSlots))
        .rejects.toThrow('Chỉ có thể chỉnh sửa phiên bản ở trạng thái nháp');
    });

    it('should reject non-existent version', async () => {
      versionRepo.findById.mockResolvedValue(null);

      await expect(service.overwriteSlots('non-existent-id', newSlots))
        .rejects.toThrow(NotFoundException);
      await expect(service.overwriteSlots('non-existent-id', newSlots))
        .rejects.toThrow('Không tìm thấy phiên bản TKB');
    });

    it('should soft-delete existing slots and insert new slots in transaction', async () => {
      versionRepo.findById.mockResolvedValue(mockVersion); // DRAFT

      const mockQueryBuilder = {
        update: jest.fn().mockReturnThis(),
        set: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        execute: jest.fn().mockResolvedValue({ affected: 2 }),
      };
      const mockManager: Partial<EntityManager> = {
        createQueryBuilder: jest.fn().mockReturnValue(mockQueryBuilder),
        create: jest.fn().mockImplementation((_entity, data) => data),
        save: jest.fn().mockResolvedValue([]),
      };
      (dataSource.transaction as jest.Mock).mockImplementation(
        async (cb: TransactionCallback) => cb(mockManager as EntityManager),
      );

      await service.overwriteSlots(mockVersion.id, newSlots);

      // Verify transaction was used
      expect(dataSource.transaction).toHaveBeenCalledTimes(1);

      // Verify soft-delete query was built
      expect(mockManager.createQueryBuilder).toHaveBeenCalled();
      expect(mockQueryBuilder.update).toHaveBeenCalledWith(TimetableSlotEntity);
      expect(mockQueryBuilder.set).toHaveBeenCalledWith({
        deletedAt: expect.any(Date),
      });
      expect(mockQueryBuilder.where).toHaveBeenCalledWith(
        'version_id = :versionId AND deleted_at IS NULL',
        { versionId: mockVersion.id },
      );
      expect(mockQueryBuilder.execute).toHaveBeenCalled();

      // Verify new slots were inserted
      expect(mockManager.save).toHaveBeenCalledWith(
        TimetableSlotEntity,
        expect.arrayContaining([
          expect.objectContaining({
            versionId: mockVersion.id,
            classId: 'class-new-1',
            dayOfWeek: 2,
            periodId: 'period-new-1',
            subjectId: 'subject-new-1',
            teacherId: 'teacher-new-1',
            roomId: 'room-new-1',
            isDoublePeriod: false,
          }),
          expect.objectContaining({
            versionId: mockVersion.id,
            classId: 'class-new-2',
            dayOfWeek: 4,
            periodId: 'period-new-2',
            subjectId: 'subject-new-2',
            teacherId: 'teacher-new-2',
            roomId: null,
            isDoublePeriod: true,
          }),
        ]),
      );
    });

    it('should accept empty slots array (clear all slots)', async () => {
      versionRepo.findById.mockResolvedValue(mockVersion); // DRAFT

      const mockQueryBuilder = {
        update: jest.fn().mockReturnThis(),
        set: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        execute: jest.fn().mockResolvedValue({ affected: 5 }),
      };
      const mockManager: Partial<EntityManager> = {
        createQueryBuilder: jest.fn().mockReturnValue(mockQueryBuilder),
        create: jest.fn().mockImplementation((_entity, data) => data),
        save: jest.fn().mockResolvedValue([]),
      };
      (dataSource.transaction as jest.Mock).mockImplementation(
        async (cb: TransactionCallback) => cb(mockManager as EntityManager),
      );

      await expect(service.overwriteSlots(mockVersion.id, []))
        .resolves.toBeUndefined();

      // Soft-delete still called
      expect(mockQueryBuilder.execute).toHaveBeenCalled();
      // Save NOT called with slots (empty array)
      expect(mockManager.save).not.toHaveBeenCalledWith(
        TimetableSlotEntity,
        expect.any(Array),
      );
    });
  });
});
