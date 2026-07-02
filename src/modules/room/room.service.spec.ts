import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { RoomService } from './room.service';
import { RoomRepository } from './room.repository';
import { RoomEntity } from './entities/room.entity';
import { RoomType, RoomStatus } from '../../common/enums/status.enum';

describe('RoomService', () => {
  let service: RoomService;
  let repository: jest.Mocked<RoomRepository>;

  const mockRoom: RoomEntity = {
    id: 'room-uuid',
    schoolId: 'school-uuid',
    code: 'P101',
    name: 'Phòng 101',
    building: 'A',
    floor: 1,
    capacity: 40,
    roomType: RoomType.STANDARD,
    facilities: ['Máy chiếu', 'Điều hòa'],
    status: RoomStatus.AVAILABLE,
    createdAt: new Date(),
    updatedAt: new Date(),
    deletedAt: null,
    school: undefined as never,
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RoomService,
        {
          provide: RoomRepository,
          useValue: {
            findAll: jest.fn(),
            findById: jest.fn(),
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

      const result = await service.findAll(query);

      expect(result.success).toBe(true);
      expect(result.data).toHaveLength(1);
      expect(result.meta.total).toBe(1);
    });
  });

  describe('findById', () => {
    it('should return room by id', async () => {
      repository.findById.mockResolvedValue(mockRoom);
      const result = await service.findById('room-uuid');
      expect(result).toEqual(mockRoom);
    });

    it('should throw NotFoundException if not found', async () => {
      repository.findById.mockResolvedValue(null);
      await expect(service.findById('nonexistent')).rejects.toThrow(NotFoundException);
    });
  });

  describe('create', () => {
    it('should create a room with facilities', async () => {
      const dto = {
        schoolId: 'school-uuid',
        code: 'P101',
        name: 'Phòng 101',
        facilities: ['Máy chiếu', 'Điều hòa'],
      };
      repository.create.mockResolvedValue(mockRoom);

      const result = await service.create(dto);
      expect(result.facilities).toHaveLength(2);
    });
  });

  describe('update', () => {
    it('should update a room', async () => {
      const dto = { name: 'Phòng 102' };
      const updated = { ...mockRoom, name: 'Phòng 102' };

      repository.findById.mockResolvedValue(mockRoom);
      repository.update.mockResolvedValue(updated);

      const result = await service.update('room-uuid', dto);
      expect(result.name).toBe('Phòng 102');
    });

    it('should throw NotFoundException if not found', async () => {
      repository.findById.mockResolvedValue(null);
      await expect(service.update('nonexistent', { name: 'Test' })).rejects.toThrow(NotFoundException);
    });
  });

  describe('remove', () => {
    it('should soft delete a room', async () => {
      repository.findById.mockResolvedValue(mockRoom);
      repository.softDelete.mockResolvedValue(undefined);

      await service.remove('room-uuid');
      expect(repository.softDelete).toHaveBeenCalledWith('room-uuid');
    });
  });
});
