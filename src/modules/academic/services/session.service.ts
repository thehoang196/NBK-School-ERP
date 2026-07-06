import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { SessionRepository } from '../repositories/session.repository';
import { CampusGradeLevelRepository } from '../repositories/campus-grade-level.repository';
import { SessionEntity } from '../entities/session.entity';
import {
  CreateSessionDto,
  UpdateSessionDto,
  SessionQueryDto,
} from '../dto/session';
import { PaginatedResponse } from '../../../common/interfaces/api-response.interface';
import { CampusGradeLevelNotFoundException } from '../exceptions';

@Injectable()
export class SessionService {
  constructor(
    private readonly sessionRepository: SessionRepository,
    private readonly campusGradeLevelRepository: CampusGradeLevelRepository,
  ) {}

  async findAll(
    query: SessionQueryDto,
    schoolId: string,
  ): Promise<PaginatedResponse<SessionEntity>> {
    const [data, total] = await this.sessionRepository.findAll(query, schoolId);
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

  async findById(id: string, schoolId?: string): Promise<SessionEntity> {
    const session = await this.sessionRepository.findById(id, schoolId);
    if (!session) {
      throw new NotFoundException('Không tìm thấy ca học');
    }
    return session;
  }

  async findBySchool(schoolId: string): Promise<SessionEntity[]> {
    return this.sessionRepository.findBySchool(schoolId);
  }

  async create(
    dto: CreateSessionDto,
    schoolId: string,
  ): Promise<SessionEntity> {
    if (dto.startTime >= dto.endTime) {
      throw new BadRequestException('Giờ bắt đầu phải trước giờ kết thúc');
    }

    const campusGradeLevel =
      await this.campusGradeLevelRepository.findByCampusAndGrade(
        dto.campusId,
        dto.gradeLevel,
        schoolId,
      );
    if (!campusGradeLevel) {
      throw new CampusGradeLevelNotFoundException(
        'Cơ sở - cấp học chưa được thiết lập',
      );
    }

    return this.sessionRepository.create({
      schoolId,
      campusId: dto.campusId,
      gradeLevel: dto.gradeLevel,
      name: dto.name,
      startTime: dto.startTime,
      endTime: dto.endTime,
      sortOrder: dto.sortOrder ?? 0,
    });
  }

  async update(
    id: string,
    dto: UpdateSessionDto,
    schoolId?: string,
  ): Promise<SessionEntity> {
    const session = await this.findById(id, schoolId);

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

  async remove(id: string, schoolId?: string): Promise<void> {
    await this.findById(id, schoolId);
    await this.sessionRepository.softDelete(id);
  }
}
