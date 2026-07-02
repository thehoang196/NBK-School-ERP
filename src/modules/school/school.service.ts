import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { SchoolRepository } from './school.repository';
import { SchoolEntity } from './entities/school.entity';
import { CreateSchoolDto } from './dto/create-school.dto';
import { UpdateSchoolDto } from './dto/update-school.dto';
import { SchoolQueryDto } from './dto/school-query.dto';
import { PaginatedResponse } from '../../common/interfaces/api-response.interface';

@Injectable()
export class SchoolService {
  constructor(private readonly schoolRepository: SchoolRepository) {}

  async findAll(query: SchoolQueryDto): Promise<PaginatedResponse<SchoolEntity>> {
    const [schools, total] = await this.schoolRepository.findAll(query);
    const totalPages = Math.ceil(total / query.limit);

    return {
      success: true,
      data: schools,
      message: 'Lấy danh sách trường thành công',
      meta: {
        page: query.page,
        limit: query.limit,
        total,
        totalPages,
      },
    };
  }

  async findById(id: string): Promise<SchoolEntity> {
    const school = await this.schoolRepository.findById(id);
    if (!school) {
      throw new NotFoundException('Không tìm thấy trường');
    }
    return school;
  }

  async create(dto: CreateSchoolDto): Promise<SchoolEntity> {
    const existingSchool = await this.schoolRepository.findByCode(dto.code);
    if (existingSchool) {
      throw new ConflictException('Mã trường đã tồn tại');
    }

    return this.schoolRepository.create({
      code: dto.code,
      name: dto.name,
      address: dto.address || null,
      phone: dto.phone || null,
      email: dto.email || null,
      principalName: dto.principalName || null,
      parentSchoolId: dto.parentSchoolId || null,
      status: dto.status,
    });
  }

  async update(id: string, dto: UpdateSchoolDto): Promise<SchoolEntity> {
    const school = await this.findById(id);

    if (dto.code && dto.code !== school.code) {
      const existingSchool = await this.schoolRepository.findByCode(dto.code);
      if (existingSchool) {
        throw new ConflictException('Mã trường đã tồn tại');
      }
    }

    const updated = await this.schoolRepository.update(id, dto);
    if (!updated) {
      throw new NotFoundException('Không tìm thấy trường');
    }
    return updated;
  }

  async remove(id: string): Promise<void> {
    await this.findById(id);
    await this.schoolRepository.softDelete(id);
  }
}
