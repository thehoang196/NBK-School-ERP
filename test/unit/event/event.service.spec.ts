import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException, BadRequestException } from '@nestjs/common';
import { EventService } from '../../../src/modules/event/event.service';
import { EventRepository } from '../../../src/modules/event/event.repository';
import {
  EventEntity,
  EventType,
  EventStatus,
} from '../../../src/modules/event/entities/event.entity';

describe('EventService', () => {
  let service: EventService;
  let repository: jest.Mocked<EventRepository>;

  const mockEvent: Partial<EventEntity> = {
    id: 'event-uuid-1',
    schoolId: 'school-uuid-1',
    title: 'Nghỉ lễ Quốc khánh',
    description: 'Nghỉ lễ 2/9',
    eventType: EventType.HOLIDAY,
    startDate: new Date('2024-09-02T00:00:00.000Z'),
    endDate: new Date('2024-09-03T23:59:59.000Z'),
    allDay: true,
    affectsSchedule: true,
    isRecurring: false,
    recurrenceRule: null,
    affectedGrades: null,
    affectedClasses: null,
    status: EventStatus.ACTIVE,
    createdAt: new Date(),
    updatedAt: new Date(),
    deletedAt: null,
  };

  beforeEach(async () => {
    const mockRepository = {
      findAll: jest.fn(),
      findById: jest.fn(),
      findByCalendar: jest.fn(),
      findByDateRange: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      softDelete: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        EventService,
        {
          provide: EventRepository,
          useValue: mockRepository,
        },
      ],
    }).compile();

    service = module.get<EventService>(EventService);
    repository = module.get(EventRepository);
  });

  describe('findAll()', () => {
    it('should return paginated events', async () => {
      const events = [mockEvent as EventEntity];
      repository.findAll.mockResolvedValue([events, 1]);

      const query = { page: 1, limit: 20, sortOrder: 'ASC' as const };
      const result = await service.findAll(query);

      expect(result.success).toBe(true);
      expect(result.data).toHaveLength(1);
      expect(result.meta.page).toBe(1);
      expect(result.meta.limit).toBe(20);
      expect(result.meta.total).toBe(1);
      expect(result.meta.totalPages).toBe(1);
      expect(result.message).toBe('Lấy danh sách sự kiện thành công');
    });

    it('should calculate totalPages correctly', async () => {
      const events = Array(20).fill(mockEvent) as EventEntity[];
      repository.findAll.mockResolvedValue([events, 45]);

      const query = { page: 1, limit: 20, sortOrder: 'ASC' as const };
      const result = await service.findAll(query);

      expect(result.meta.totalPages).toBe(3);
      expect(result.meta.total).toBe(45);
    });

    it('should pass query parameters to repository', async () => {
      repository.findAll.mockResolvedValue([[], 0]);

      const query = {
        page: 2,
        limit: 10,
        sortOrder: 'DESC' as const,
        schoolId: 'school-uuid-1',
        eventType: EventType.HOLIDAY,
      };
      await service.findAll(query);

      expect(repository.findAll).toHaveBeenCalledWith(query);
    });
  });

  describe('findById()', () => {
    it('should return event when found', async () => {
      repository.findById.mockResolvedValue(mockEvent as EventEntity);

      const result = await service.findById('event-uuid-1');

      expect(result).toEqual(mockEvent);
      expect(repository.findById).toHaveBeenCalledWith('event-uuid-1');
    });

    it('should throw NotFoundException when event not found', async () => {
      repository.findById.mockResolvedValue(null);

      await expect(service.findById('non-existent-uuid')).rejects.toThrow(
        NotFoundException,
      );
      await expect(service.findById('non-existent-uuid')).rejects.toThrow(
        'Không tìm thấy sự kiện',
      );
    });
  });

  describe('getCalendar()', () => {
    it('should return events for calendar view', async () => {
      const events = [mockEvent as EventEntity];
      repository.findByCalendar.mockResolvedValue(events);

      const query = { schoolId: 'school-uuid-1', year: 2024, month: 9 };
      const result = await service.getCalendar(query);

      expect(result).toEqual(events);
      expect(repository.findByCalendar).toHaveBeenCalledWith(query);
    });

    it('should work without optional params', async () => {
      repository.findByCalendar.mockResolvedValue([]);

      const result = await service.getCalendar({});

      expect(result).toEqual([]);
      expect(repository.findByCalendar).toHaveBeenCalledWith({});
    });
  });

  describe('create()', () => {
    it('should create an event successfully', async () => {
      repository.create.mockResolvedValue(mockEvent as EventEntity);

      const dto = {
        schoolId: 'school-uuid-1',
        title: 'Nghỉ lễ Quốc khánh',
        description: 'Nghỉ lễ 2/9',
        eventType: EventType.HOLIDAY,
        startDate: '2024-09-02T00:00:00.000Z',
        endDate: '2024-09-03T23:59:59.000Z',
        allDay: true,
        affectsSchedule: true,
      };

      const result = await service.create(dto);

      expect(result).toEqual(mockEvent);
      expect(repository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          schoolId: 'school-uuid-1',
          title: 'Nghỉ lễ Quốc khánh',
          eventType: EventType.HOLIDAY,
          affectsSchedule: true,
          allDay: true,
        }),
      );
    });

    it('should throw BadRequestException when startDate > endDate', async () => {
      const dto = {
        schoolId: 'school-uuid-1',
        title: 'Invalid event',
        eventType: EventType.EVENT,
        startDate: '2024-09-05T00:00:00.000Z',
        endDate: '2024-09-02T00:00:00.000Z',
      };

      await expect(service.create(dto)).rejects.toThrow(BadRequestException);
      await expect(service.create(dto)).rejects.toThrow(
        'Ngày bắt đầu phải trước hoặc bằng ngày kết thúc',
      );
    });

    it('should allow startDate equal to endDate', async () => {
      repository.create.mockResolvedValue(mockEvent as EventEntity);

      const dto = {
        schoolId: 'school-uuid-1',
        title: 'Same day event',
        eventType: EventType.MEETING,
        startDate: '2024-09-02T08:00:00.000Z',
        endDate: '2024-09-02T08:00:00.000Z',
      };

      await expect(service.create(dto)).resolves.toBeDefined();
    });

    it('should default optional fields when not provided', async () => {
      repository.create.mockResolvedValue(mockEvent as EventEntity);

      const dto = {
        schoolId: 'school-uuid-1',
        title: 'Basic event',
        eventType: EventType.EVENT,
        startDate: '2024-09-02T00:00:00.000Z',
        endDate: '2024-09-03T00:00:00.000Z',
      };

      await service.create(dto);

      expect(repository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          description: null,
          allDay: false,
          affectsSchedule: false,
          isRecurring: false,
          recurrenceRule: null,
          affectedGrades: null,
          affectedClasses: null,
        }),
      );
    });

    it('should handle EventType.OTHER', async () => {
      repository.create.mockResolvedValue({
        ...mockEvent,
        eventType: EventType.OTHER,
      } as EventEntity);

      const dto = {
        schoolId: 'school-uuid-1',
        title: 'Sự kiện khác',
        eventType: EventType.OTHER,
        startDate: '2024-09-02T00:00:00.000Z',
        endDate: '2024-09-03T00:00:00.000Z',
      };

      const result = await service.create(dto);
      expect(result.eventType).toBe(EventType.OTHER);
    });
  });

  describe('update()', () => {
    it('should update an event successfully', async () => {
      repository.findById.mockResolvedValue(mockEvent as EventEntity);
      const updatedEvent = { ...mockEvent, title: 'Updated Title' };
      repository.update.mockResolvedValue(updatedEvent as EventEntity);

      const dto = { title: 'Updated Title' };
      const result = await service.update('event-uuid-1', dto);

      expect(result.title).toBe('Updated Title');
      expect(repository.update).toHaveBeenCalledWith(
        'event-uuid-1',
        expect.objectContaining({ title: 'Updated Title' }),
      );
    });

    it('should throw NotFoundException when event does not exist', async () => {
      repository.findById.mockResolvedValue(null);

      const dto = { title: 'Updated Title' };

      await expect(service.update('non-existent-uuid', dto)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should validate date range on update', async () => {
      repository.findById.mockResolvedValue(mockEvent as EventEntity);

      const dto = {
        startDate: '2024-09-10T00:00:00.000Z',
        endDate: '2024-09-05T00:00:00.000Z',
      };

      await expect(service.update('event-uuid-1', dto)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should validate new startDate against existing endDate', async () => {
      const event = {
        ...mockEvent,
        endDate: new Date('2024-09-01T00:00:00.000Z'),
      } as EventEntity;
      repository.findById.mockResolvedValue(event);

      const dto = { startDate: '2024-09-05T00:00:00.000Z' };

      await expect(service.update('event-uuid-1', dto)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should update affectsSchedule flag', async () => {
      repository.findById.mockResolvedValue(mockEvent as EventEntity);
      const updated = { ...mockEvent, affectsSchedule: false };
      repository.update.mockResolvedValue(updated as EventEntity);

      const dto = { affectsSchedule: false };
      const result = await service.update('event-uuid-1', dto);

      expect(result.affectsSchedule).toBe(false);
    });

    it('should throw NotFoundException if repository.update returns null', async () => {
      repository.findById.mockResolvedValue(mockEvent as EventEntity);
      repository.update.mockResolvedValue(null);

      const dto = { title: 'New title' };

      await expect(service.update('event-uuid-1', dto)).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('remove()', () => {
    it('should soft delete an event', async () => {
      repository.findById.mockResolvedValue(mockEvent as EventEntity);
      repository.softDelete.mockResolvedValue(undefined);

      await service.remove('event-uuid-1');

      expect(repository.findById).toHaveBeenCalledWith('event-uuid-1');
      expect(repository.softDelete).toHaveBeenCalledWith('event-uuid-1');
    });

    it('should throw NotFoundException when event does not exist', async () => {
      repository.findById.mockResolvedValue(null);

      await expect(service.remove('non-existent-uuid')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('findScheduleAffectingEvents()', () => {
    it('should return events that affect schedule in date range', async () => {
      const affectingEvents = [
        { ...mockEvent, affectsSchedule: true } as EventEntity,
      ];
      repository.findByDateRange.mockResolvedValue(affectingEvents);

      const startDate = new Date('2024-09-01');
      const endDate = new Date('2024-09-30');

      const result = await service.findScheduleAffectingEvents(
        'school-uuid-1',
        startDate,
        endDate,
      );

      expect(result).toEqual(affectingEvents);
      expect(repository.findByDateRange).toHaveBeenCalledWith(
        'school-uuid-1',
        startDate,
        endDate,
      );
    });

    it('should return empty array when no affecting events', async () => {
      repository.findByDateRange.mockResolvedValue([]);

      const result = await service.findScheduleAffectingEvents(
        'school-uuid-1',
        new Date('2024-12-01'),
        new Date('2024-12-31'),
      );

      expect(result).toEqual([]);
    });
  });
});
