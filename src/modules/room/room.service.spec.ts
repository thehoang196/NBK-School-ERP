import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { RoomService } from './room.service';
import { RoomRepository } from './room.repository';
import { RoomEntity } from './entities/room.entity';
import { DuplicateRoomCodeException } from './exceptions/duplicate-room-code.exception';
import { RoomType, RoomStatus } from '../../common/enums/status.enum';

describe('RoomService', () => {
  let service: RoomService;
  let repository: jest.Mocked<RoomRepository>;

  const schoolId = 'school-uuid';

  const mockRoom: RoomEntity = {
    id: 'room-uuid',
    schoolId,
    code: 'P101',
    name: 'Phòng 101',
    building: 'A',
    floor: 1,
    capacity: 40,
    roomType: RoomType.STANDARD,
    facilities: ['Máy chiếu', 'Điều hòa'],
    status: RoomStatus.AVAILABLE,
    campusId: null,
    campus: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    deletedAt: null,
    createdBy: null,
    updatedBy: null,
    version: 1,
    school: undefined as never,
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RoomService,
        {
          provide: RoomRepository,
          useValue: {
            findBySchool: jest.fn(),
            findAll: jest.fn(),
            findById: jest.fn(),
            findByCode: jest.fn(),
            create: jest.fn(),
            update: jest.fn(),
            softDelete: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<RoomService>(RoomService);
    repository = module.get(RoomRepository);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('findAll', () => {
    it('should return paginated rooms', async () => {
      const query = { page: 1, limit: 10, sortOrder: 'ASC' as const };
      repository.findAll.mockResolvedValue([[mockRoom], 1]);

      const result = await service.findAll(query, schoolId);

      expect(result.success).toBe(true);
      expect(result.data).toHaveLength(1);
      expect(result.meta.total).toBe(1);
      expect(repository.findAll).toHaveBeenCalledWith(query, schoolId);
    });
  });

  describe('findById', () => {
    it('should return room by id', async () => {
      repository.findById.mockResolvedValue(mockRoom);
      const result = await service.findById('room-uuid', schoolId);
      expect(result).toEqual(mockRoom);
      expect(repository.findById).toHaveBeenCalledWith('room-uuid', schoolId);
    });

    it('should throw NotFoundException if not found', async () => {
      repository.findById.mockResolvedValue(null);
      await expect(service.findById('nonexistent', schoolId)).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('create', () => {
    it('should create a room successfully', async () => {
      const dto = {
        schoolId,
        code: 'P101',
        name: 'Phòng 101',
        facilities: ['Máy chiếu', 'Điều hòa'],
      };
      repository.findByCode.mockResolvedValue(null);
      repository.create.mockResolvedValue(mockRoom);

      const result = await service.create(dto, schoolId);

      expect(result).toEqual(mockRoom);
      expect(repository.findByCode).toHaveBeenCalledWith('P101', schoolId);
      expect(repository.create).toHaveBeenCalledWith({ ...dto, schoolId });
    });

    it('should throw DuplicateRoomCodeException if code already exists', async () => {
      const dto = {
        schoolId,
        code: 'P101',
        name: 'Phòng 101',
      };
      repository.findByCode.mockResolvedValue(mockRoom);

      await expect(service.create(dto, schoolId)).rejects.toThrow(
        DuplicateRoomCodeException,
      );
    });
  });

  describe('update', () => {
    it('should update a room successfully', async () => {
      const dto = { name: 'Phòng 102' };
      const updated = { ...mockRoom, name: 'Phòng 102' };

      repository.findById.mockResolvedValue(mockRoom);
      repository.update.mockResolvedValue(updated);

      const result = await service.update('room-uuid', schoolId, dto);
      expect(result.name).toBe('Phòng 102');
      expect(repository.update).toHaveBeenCalledWith(
        'room-uuid',
        schoolId,
        dto,
      );
    });

    it('should throw NotFoundException if room not found', async () => {
      repository.findById.mockResolvedValue(null);
      await expect(
        service.update('nonexistent', schoolId, { name: 'Test' }),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw DuplicateRoomCodeException if code already exists on another room', async () => {
      const anotherRoom = { ...mockRoom, id: 'another-room-uuid' };
      repository.findById.mockResolvedValue(mockRoom);
      repository.findByCode.mockResolvedValue(anotherRoom);

      await expect(
        service.update('room-uuid', schoolId, { code: 'P101' }),
      ).rejects.toThrow(DuplicateRoomCodeException);
    });

    it('should allow updating with the same code (same room)', async () => {
      const dto = { code: 'P101', name: 'Updated' };
      const updated = { ...mockRoom, name: 'Updated' };

      repository.findById.mockResolvedValue(mockRoom);
      repository.findByCode.mockResolvedValue(mockRoom); // same room
      repository.update.mockResolvedValue(updated);

      const result = await service.update('room-uuid', schoolId, dto);
      expect(result.name).toBe('Updated');
    });
  });

  describe('remove', () => {
    it('should soft delete a room', async () => {
      repository.findById.mockResolvedValue(mockRoom);
      repository.softDelete.mockResolvedValue(undefined);

      await service.remove('room-uuid', schoolId);
      expect(repository.softDelete).toHaveBeenCalledWith('room-uuid', schoolId);
    });

    it('should throw NotFoundException if room not found', async () => {
      repository.findById.mockResolvedValue(null);
      await expect(service.remove('nonexistent', schoolId)).rejects.toThrow(
        NotFoundException,
      );
    });
  });
});
