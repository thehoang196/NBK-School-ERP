import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { SessionRepository } from '../repositories/session.repository';
import { SessionEntity } from '../entities/session.entity';
import { CreateSessionDto, UpdateSessionDto, SessionQueryDto } from '../dto/session';
import { PaginatedResponse } from '../../../common/interfaces/api-response.interface';

@Injectable()
export class SessionService {
  constructor(private readonly sessionRepository: SessionRepository) {}

  async findAll(query: SessionQueryDto): Promise<PaginatedResponse<SessionEntity>> {
    const [data, total] = await this.sessionRepository.findAll(query);
    const totalPages = Math.ceil(total / query.limit);

    return {
      success: true,
      data,
      message: 'Lấy danh sách ca học thành công',
      meta: {
        page: query.page,
        limit: query.limit,
        total,
        totalPages,
      },
    };
  }

  async findById(id: string): Promise<SessionEntity> {
    const session = await this.sessionRepository.findById(id);
    if (!session) {
      throw new NotFoundException('Không tìm thấy ca học');
    }
    return session;
  }

  async findBySchool(schoolId: string): Promise<SessionEntity[]> {
    return this.sessionRepository.findBySchool(schoolId);
  }

  async create(dto: CreateSessionDto): Promise<SessionEntity> {
    if (dto.startTime >= dto.endTime) {
      throw new BadRequestException('Giờ bắt đầu phải trước giờ kết thúc');
    }

    return this.sessionRepository.create({
      schoolId: dto.schoolId,
      name: dto.name,
      startTime: dto.startTime,
      endTime: dto.endTime,
      sortOrder: dto.sortOrder ?? 0,
    });
  }

  async update(id: string, dto: UpdateSessionDto): Promise<SessionEntity> {
    const session = await this.findById(id);

    if (dto.startTime && dto.endTime && dto.startTime >= dto.endTime) {
      throw new BadRequestException('Giờ bắt đầu phải trước giờ kết thúc');
    }

    if (dto.startTime && !dto.endTime && dto.startTime >= session.endTime) {
      throw new BadRequestException('Giờ bắt đầu phải trước giờ kết thúc');
    }

    if (!dto.startTime && dto.endTime && session.startTime >= dto.endTime) {
      throw new BadRequestException('Giờ bắt đầu phải trước giờ kết thúc');
    }

    const updated = await this.sessionRepository.update(id, dto);
    if (!updated) {
      throw new NotFoundException('Không tìm thấy ca học');
    }
    return updated;
  }

  async remove(id: string): Promise<void> {
    await this.findById(id);
    await this.sessionRepository.softDelete(id);
  }
}
