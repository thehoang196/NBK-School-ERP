import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { PayPeriodService } from '../../../src/modules/compensation/services/pay-period.service';
import { PayPeriodRepository } from '../../../src/modules/compensation/repositories/pay-period.repository';
import { PayPeriodStatus } from '../../../src/modules/compensation/enums';

describe('PayPeriodService', () => {
  let service: PayPeriodService;
  let repository: jest.Mocked<PayPeriodRepository>;

  const mockPayPeriod = {
    id: 'pp-1',
    schoolId: 'school-1',
    name: 'Tháng 01/2026',
    startDate: '2026-01-01',
    endDate: '2026-01-31',
    status: PayPeriodStatus.OPEN,
    createdAt: new Date(),
    updatedAt: new Date(),
    deletedAt: null,
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PayPeriodService,
        {
          provide: PayPeriodRepository,
          useValue: {
            findAll: jest.fn(),
            findById: jest.fn(),
            findOverlapping: jest.fn(),
            create: jest.fn(),
            update: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<PayPeriodService>(PayPeriodService);
    repository = module.get(PayPeriodRepository);
  });

  describe('create', () => {
    it('should create a pay period successfully', async () => {
      repository.findOverlapping.mockResolvedValue([]);
      repository.create.mockResolvedValue(mockPayPeriod as never);

      const result = await service.create({
        schoolId: 'school-1',
        name: 'Tháng 01/2026',
        startDate: '2026-01-01',
        endDate: '2026-01-31',
      });

      expect(result).toEqual(mockPayPeriod);
    });

    it('should reject when end date is before start date', async () => {
      await expect(
        service.create({
          schoolId: 'school-1',
          name: 'Invalid',
          startDate: '2026-01-31',
          endDate: '2026-01-01',
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should reject overlapping pay periods', async () => {
      repository.findOverlapping.mockResolvedValue([mockPayPeriod] as never);

      await expect(
        service.create({
          schoolId: 'school-1',
          name: 'Tháng 01/2026 bis',
          startDate: '2026-01-15',
          endDate: '2026-02-15',
        }),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('updateStatus', () => {
    it('should transition from OPEN to PROCESSING', async () => {
      repository.findById.mockResolvedValue(mockPayPeriod as never);
      const updatedPeriod = { ...mockPayPeriod, status: PayPeriodStatus.PROCESSING };
      repository.update.mockResolvedValue(updatedPeriod as never);

      const result = await service.updateStatus('pp-1', PayPeriodStatus.PROCESSING);

      expect(result.status).toBe(PayPeriodStatus.PROCESSING);
    });

    it('should reject invalid state transitions', async () => {
      const closedPeriod = { ...mockPayPeriod, status: PayPeriodStatus.CLOSED };
      repository.findById.mockResolvedValue(closedPeriod as never);

      await expect(
        service.updateStatus('pp-1', PayPeriodStatus.OPEN),
      ).rejects.toThrow(BadRequestException);
    });

    it('should transition from PROCESSING to CLOSED', async () => {
      const processingPeriod = { ...mockPayPeriod, status: PayPeriodStatus.PROCESSING };
      repository.findById.mockResolvedValue(processingPeriod as never);
      const closedPeriod = { ...mockPayPeriod, status: PayPeriodStatus.CLOSED };
      repository.update.mockResolvedValue(closedPeriod as never);

      const result = await service.updateStatus('pp-1', PayPeriodStatus.CLOSED);

      expect(result.status).toBe(PayPeriodStatus.CLOSED);
    });

    it('should reject OPEN to CLOSED directly', async () => {
      repository.findById.mockResolvedValue(mockPayPeriod as never);

      await expect(
        service.updateStatus('pp-1', PayPeriodStatus.CLOSED),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('findById', () => {
    it('should return pay period when found', async () => {
      repository.findById.mockResolvedValue(mockPayPeriod as never);

      const result = await service.findById('pp-1');

      expect(result).toEqual(mockPayPeriod);
    });

    it('should throw NotFoundException when not found', async () => {
      repository.findById.mockResolvedValue(null);

      await expect(service.findById('non-existing')).rejects.toThrow(NotFoundException);
    });
  });
});
