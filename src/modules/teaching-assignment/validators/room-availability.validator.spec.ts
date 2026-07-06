import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { RoomAvailabilityValidator } from './room-availability.validator';
import { RoomEntity } from '../../room/entities/room.entity';

describe('RoomAvailabilityValidator', () => {
  let validator: RoomAvailabilityValidator;
  let roomRepo: { findOne: jest.Mock };

  const mockRoom = {
    id: 'room-uuid-1',
    schoolId: 'school-uuid-1',
    name: 'Phòng A101',
    capacity: 40,
    deletedAt: null,
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RoomAvailabilityValidator,
        {
          provide: getRepositoryToken(RoomEntity),
          useValue: {
            findOne: jest.fn(),
          },
        },
      ],
    }).compile();

    validator = module.get<RoomAvailabilityValidator>(RoomAvailabilityValidator);
    roomRepo = module.get(getRepositoryToken(RoomEntity));
  });

  it('should return valid when room exists and belongs to school', async () => {
    roomRepo.findOne.mockResolvedValue(mockRoom);

    const result = await validator.validate('room-uuid-1', 'school-uuid-1');

    expect(result.valid).toBe(true);
    expect(result.roomId).toBe('room-uuid-1');
  });

  it('should return invalid when room not found', async () => {
    roomRepo.findOne.mockResolvedValue(null);

    const result = await validator.validate('non-existent', 'school-uuid-1');

    expect(result.valid).toBe(false);
    expect(result.message).toBe('Không tìm thấy phòng học');
  });

  it('should return invalid when room belongs to different school', async () => {
    roomRepo.findOne.mockResolvedValue({
      ...mockRoom,
      schoolId: 'other-school-uuid',
    });

    const result = await validator.validate('room-uuid-1', 'school-uuid-1');

    expect(result.valid).toBe(false);
    expect(result.message).toBe('Phòng học không thuộc trường này');
  });

  it('should return valid when capacity is sufficient', async () => {
    roomRepo.findOne.mockResolvedValue(mockRoom);

    const result = await validator.validate('room-uuid-1', 'school-uuid-1', 35);

    expect(result.valid).toBe(true);
    expect(result.capacity).toBe(40);
  });

  it('should return invalid when capacity is insufficient', async () => {
    roomRepo.findOne.mockResolvedValue(mockRoom);

    const result = await validator.validate('room-uuid-1', 'school-uuid-1', 50);

    expect(result.valid).toBe(false);
    expect(result.message).toContain('không đủ sức chứa');
    expect(result.message).toContain('Phòng A101');
    expect(result.capacity).toBe(40);
    expect(result.requiredCapacity).toBe(50);
  });

  it('should skip capacity check when no requiredCapacity provided', async () => {
    roomRepo.findOne.mockResolvedValue({ ...mockRoom, capacity: 10 });

    const result = await validator.validate('room-uuid-1', 'school-uuid-1');

    expect(result.valid).toBe(true);
  });
});
