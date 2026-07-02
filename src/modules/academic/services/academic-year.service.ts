import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { AcademicYearRepository } from '../repositories/academic-year.repository';
import { AcademicYearEntity } from '../entities/academic-year.entity';
import { CreateAcademicYearDto, UpdateAcademicYearDto, AcademicYearQueryDto } from '../dto/academic-year';
import { PaginatedResponse } from '../../../common/interfaces/api-response.interface';

@Injectable()
export class AcademicYearService {
  constructor(private readonly academicYearRepository: AcademicYearRepository) {}

  async findAll(query: AcademicYearQueryDto): Promise<PaginatedResponse<AcademicYearEntity>> {
    const [data, total] = await this.academicYearRepository.findAll(query);
    const totalPages = Math.ceil(total / query.limit);

    return {
      success: true,
      data,
      message: 'Lấy danh sách năm học thành công',
      meta: {
        page: query.page,
        limit: query.limit,
        total,
        totalPages,
      },
    };
  }

  async findById(id: string): Promise<AcademicYearEntity> {
    const academicYear = await this.academicYearRepository.findById(id);
    if (!academicYear) {
      throw new NotFoundException('Không tìm thấy năm học');
    }
    return academicYear;
  }

  async findBySchool(schoolId: string): Promise<AcademicYearEntity[]> {
    return this.academicYearRepository.findBySchool(schoolId);
  }

  async create(dto: CreateAcademicYearDto): Promise<AcademicYearEntity> {
    if (new Date(dto.startDate) >= new Date(dto.endDate)) {
      throw new BadRequestException('Ngày bắt đầu phải trước ngày kết thúc');
    }

    const overlapping = await this.academicYearRepository.findOverlapping(
      dto.schoolId,
      dto.startDate,
      dto.endDate,
    );
    if (overlapping.length > 0) {
      throw new BadRequestException('Năm học bị trùng thời gian với năm học khác trong cùng trường');
    }

    if (dto.isCurrent) {
      return this.academicYearRepository.createWithTransaction({
        schoolId: dto.schoolId,
        name: dto.name,
        startDate: dto.startDate,
        endDate: dto.endDate,
        isCurrent: dto.isCurrent,
        status: dto.status,
      });
    }

    return this.academicYearRepository.create({
      schoolId: dto.schoolId,
      name: dto.name,
      startDate: dto.startDate,
      endDate: dto.endDate,
      isCurrent: dto.isCurrent ?? false,
      status: dto.status,
    });
  }

  async update(id: string, dto: UpdateAcademicYearDto): Promise<AcademicYearEntity> {
    const existing = await this.findById(id);

    if (dto.startDate && dto.endDate && new Date(dto.startDate) >= new Date(dto.endDate)) {
      throw new BadRequestException('Ngày bắt đầu phải trước ngày kết thúc');
    }

    const startDate = dto.startDate || existing.startDate;
    const endDate = dto.endDate || existing.endDate;

    if (dto.startDate || dto.endDate) {
      if (new Date(startDate) >= new Date(endDate)) {
        throw new BadRequestException('Ngày bắt đầu phải trước ngày kết thúc');
      }

      const overlapping = await this.academicYearRepository.findOverlapping(
        existing.schoolId,
        startDate,
        endDate,
        id,
      );
      if (overlapping.length > 0) {
        throw new BadRequestException('Năm học bị trùng thời gian với năm học khác trong cùng trường');
      }
    }

    const updated = await this.academicYearRepository.update(id, dto);
    if (!updated) {
      throw new NotFoundException('Không tìm thấy năm học');
    }
    return updated;
  }

  async remove(id: string): Promise<void> {
    await this.findById(id);
    await this.academicYearRepository.softDelete(id);
  }
}
