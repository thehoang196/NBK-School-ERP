import {
  Injectable,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';
import { CampusRepository } from './campus.repository';
import { SchoolRepository } from './school.repository';
import { CampusEntity } from './entities/campus.entity';
import { CreateCampusDto } from './dto/create-campus.dto';
import { UpdateCampusDto } from './dto/update-campus.dto';
import { CampusQueryDto } from './dto/campus-query.dto';
import { PaginatedResponse } from '../../common/interfaces/api-response.interface';

@Injectable()
export class CampusService {
  constructor(
    private readonly campusRepository: CampusRepository,
    private readonly schoolRepository: SchoolRepository,
  ) {}

  async findAll(query: CampusQueryDto): Promise<PaginatedResponse<CampusEntity>> {
    const [campuses, total] = await this.campusRepository.findAll(
      query,
      query.schoolId,
    );
    const totalPages = Math.ceil(total / query.limit);

    return {
      success: true,
      data: campuses,
      message: 'Lấy danh sách cơ sở thành công',
      meta: {
        page: query.page,
        limit: query.limit,
        total,
        totalPages,
      },
    };
  }

  async findById(id: string): Promise<CampusEntity> {
    const campus = await this.campusRepository.findById(id);
    if (!campus) {
      throw new NotFoundException('Không tìm thấy cơ sở');
    }
    return campus;
  }

  async create(dto: CreateCampusDto): Promise<CampusEntity> {
    // Validate school exists
    const school = await this.schoolRepository.findById(dto.schoolId);
    if (!school) {
      throw new NotFoundException('Không tìm thấy trường');
    }

    // Validate unique code within school
    const existingCampus = await this.campusRepository.findByCode(
      dto.code,
      dto.schoolId,
    );
    if (existingCampus) {
      throw new ConflictException('Mã cơ sở đã tồn tại trong trường này');
    }

    return this.campusRepository.create({
      code: dto.code,
      name: dto.name,
      address: dto.address || null,
      schoolId: dto.schoolId,
      status: dto.status,
    });
  }

  async update(id: string, dto: UpdateCampusDto): Promise<CampusEntity> {
    const campus = await this.findById(id);

    // If schoolId is being changed, validate new school exists
    if (dto.schoolId && dto.schoolId !== campus.schoolId) {
      const school = await this.schoolRepository.findById(dto.schoolId);
      if (!school) {
        throw new NotFoundException('Không tìm thấy trường');
      }
    }

    // If code is being changed, validate uniqueness within the school
    if (dto.code && dto.code !== campus.code) {
      const targetSchoolId = dto.schoolId || campus.schoolId;
      const existingCampus = await this.campusRepository.findByCode(
        dto.code,
        targetSchoolId,
      );
      if (existingCampus) {
        throw new ConflictException('Mã cơ sở đã tồn tại trong trường này');
      }
    }

    const updated = await this.campusRepository.update(id, dto);
    if (!updated) {
      throw new NotFoundException('Không tìm thấy cơ sở');
    }
    return updated;
  }

  async remove(id: string): Promise<void> {
    await this.findById(id);
    await this.campusRepository.softDelete(id);
  }
}
