import {
  Injectable,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { PayPeriodRepository } from '../repositories/pay-period.repository';
import { PayPeriodEntity } from '../entities/pay-period.entity';
import { CreatePayPeriodDto } from '../dto/pay-period/create-pay-period.dto';
import { PayPeriodQueryDto } from '../dto/pay-period/pay-period-query.dto';
import { PaginatedResponse } from '../../../common/interfaces/api-response.interface';
import { PayPeriodStatus } from '../enums';

@Injectable()
export class PayPeriodService {
  constructor(private readonly payPeriodRepository: PayPeriodRepository) {}

  async findAll(
    query: PayPeriodQueryDto,
  ): Promise<PaginatedResponse<PayPeriodEntity>> {
    const [data, total] = await this.payPeriodRepository.findAll(query);
    const totalPages = Math.ceil(total / query.limit);

    return {
      success: true,
      data,
      message: 'Lấy danh sách kỳ lương thành công',
      meta: {
        page: query.page,
        limit: query.limit,
        total,
        totalPages,
      },
    };
  }

  async findById(id: string): Promise<PayPeriodEntity> {
    const entity = await this.payPeriodRepository.findById(id);
    if (!entity) {
      throw new NotFoundException('Không tìm thấy kỳ lương');
    }
    return entity;
  }

  async create(dto: CreatePayPeriodDto): Promise<PayPeriodEntity> {
    // Validate dates
    if (new Date(dto.endDate) <= new Date(dto.startDate)) {
      throw new BadRequestException('Ngày kết thúc phải sau ngày bắt đầu');
    }

    // Check overlapping pay periods
    const overlapping = await this.payPeriodRepository.findOverlapping(
      dto.schoolId,
      dto.startDate,
      dto.endDate,
    );
    if (overlapping.length > 0) {
      throw new BadRequestException(
        `Kỳ lương trùng thời gian với: ${overlapping.map((p) => p.name).join(', ')}`,
      );
    }

    return this.payPeriodRepository.create({
      schoolId: dto.schoolId,
      name: dto.name,
      startDate: dto.startDate,
      endDate: dto.endDate,
      status: dto.status || PayPeriodStatus.OPEN,
    });
  }

  async updateStatus(
    id: string,
    status: PayPeriodStatus,
  ): Promise<PayPeriodEntity> {
    const entity = await this.findById(id);

    // Validate state transitions
    const validTransitions: Record<PayPeriodStatus, PayPeriodStatus[]> = {
      [PayPeriodStatus.OPEN]: [PayPeriodStatus.PROCESSING],
      [PayPeriodStatus.PROCESSING]: [
        PayPeriodStatus.OPEN,
        PayPeriodStatus.CLOSED,
      ],
      [PayPeriodStatus.CLOSED]: [],
    };

    if (!validTransitions[entity.status].includes(status)) {
      throw new BadRequestException(
        `Không thể chuyển trạng thái từ ${entity.status} sang ${status}`,
      );
    }

    const updated = await this.payPeriodRepository.update(id, { status });
    if (!updated) {
      throw new NotFoundException('Không tìm thấy kỳ lương');
    }
    return updated;
  }
}
