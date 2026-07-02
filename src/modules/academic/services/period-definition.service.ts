import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PeriodDefinitionRepository } from '../repositories/period-definition.repository';
import { PeriodDefinitionEntity } from '../entities/period-definition.entity';
import {
  CreatePeriodDefinitionDto,
  UpdatePeriodDefinitionDto,
  PeriodDefinitionQueryDto,
} from '../dto/period-definition';
import { PaginatedResponse } from '../../../common/interfaces/api-response.interface';

@Injectable()
export class PeriodDefinitionService {
  constructor(private readonly periodDefinitionRepository: PeriodDefinitionRepository) {}

  async findAll(query: PeriodDefinitionQueryDto): Promise<PaginatedResponse<PeriodDefinitionEntity>> {
    const [data, total] = await this.periodDefinitionRepository.findAll(query);
    const totalPages = Math.ceil(total / query.limit);

    return {
      success: true,
      data,
      message: 'Lấy danh sách tiết học thành công',
      meta: {
        page: query.page,
        limit: query.limit,
        total,
        totalPages,
      },
    };
  }

  async findById(id: string): Promise<PeriodDefinitionEntity> {
    const period = await this.periodDefinitionRepository.findById(id);
    if (!period) {
      throw new NotFoundException('Không tìm thấy tiết học');
    }
    return period;
  }

  async findBySession(sessionId: string): Promise<PeriodDefinitionEntity[]> {
    return this.periodDefinitionRepository.findBySession(sessionId);
  }

  async findBySchool(schoolId: string): Promise<PeriodDefinitionEntity[]> {
    return this.periodDefinitionRepository.findBySchool(schoolId);
  }

  async create(dto: CreatePeriodDefinitionDto): Promise<PeriodDefinitionEntity> {
    if (dto.startTime >= dto.endTime) {
      throw new BadRequestException('Giờ bắt đầu phải trước giờ kết thúc');
    }

    return this.periodDefinitionRepository.create({
      schoolId: dto.schoolId,
      sessionId: dto.sessionId,
      periodNumber: dto.periodNumber,
      startTime: dto.startTime,
      endTime: dto.endTime,
      isBreak: dto.isBreak ?? false,
    });
  }

  async update(id: string, dto: UpdatePeriodDefinitionDto): Promise<PeriodDefinitionEntity> {
    const period = await this.findById(id);

    if (dto.startTime && dto.endTime && dto.startTime >= dto.endTime) {
      throw new BadRequestException('Giờ bắt đầu phải trước giờ kết thúc');
    }

    if (dto.startTime && !dto.endTime && dto.startTime >= period.endTime) {
      throw new BadRequestException('Giờ bắt đầu phải trước giờ kết thúc');
    }

    if (!dto.startTime && dto.endTime && period.startTime >= dto.endTime) {
      throw new BadRequestException('Giờ bắt đầu phải trước giờ kết thúc');
    }

    const updated = await this.periodDefinitionRepository.update(id, dto);
    if (!updated) {
      throw new NotFoundException('Không tìm thấy tiết học');
    }
    return updated;
  }

  async remove(id: string): Promise<void> {
    await this.findById(id);
    await this.periodDefinitionRepository.softDelete(id);
  }
}
