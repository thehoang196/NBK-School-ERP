import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { SemesterRepository } from '../repositories/semester.repository';
import { AcademicYearRepository } from '../repositories/academic-year.repository';
import { SemesterEntity } from '../entities/semester.entity';
import {
  CreateSemesterDto,
  UpdateSemesterDto,
  SemesterQueryDto,
} from '../dto/semester';
import { PaginatedResponse } from '../../../common/interfaces/api-response.interface';
import { SemesterOutOfRangeException } from '../exceptions/semester-out-of-range.exception';

@Injectable()
export class SemesterService {
  constructor(
    private readonly semesterRepository: SemesterRepository,
    private readonly academicYearRepository: AcademicYearRepository,
  ) {}

  async findAll(
    schoolId: string,
    query: SemesterQueryDto,
  ): Promise<PaginatedResponse<SemesterEntity>> {
    const [data, total] = await this.semesterRepository.findAll(
      schoolId,
      query,
    );
    const totalPages = Math.ceil(total / query.limit);

    return {
      success: true,
      data,
      message: 'Lấy danh sách học kỳ thành công',
      meta: {
        page: query.page,
        limit: query.limit,
        total,
        totalPages,
      },
    };
  }

  async findById(id: string, schoolId?: string): Promise<SemesterEntity> {
    const semester = await this.semesterRepository.findById(id, schoolId);
    if (!semester) {
      throw new NotFoundException('Không tìm thấy học kỳ');
    }
    return semester;
  }

  async findByAcademicYear(
    academicYearId: string,
    schoolId?: string,
  ): Promise<SemesterEntity[]> {
    return this.semesterRepository.findByAcademicYear(academicYearId, schoolId);
  }

  async create(
    schoolId: string,
    dto: CreateSemesterDto,
  ): Promise<SemesterEntity> {
    const academicYear = await this.academicYearRepository.findById(
      dto.academicYearId,
      schoolId,
    );
    if (!academicYear) {
      throw new NotFoundException('Không tìm thấy năm học');
    }

    this.validateDatesWithinAcademicYear(
      dto.startDate,
      dto.endDate,
      academicYear.startDate,
      academicYear.endDate,
    );

    return this.semesterRepository.create({
      academicYearId: dto.academicYearId,
      name: dto.name,
      semesterNumber: dto.semesterNumber,
      startDate: dto.startDate,
      endDate: dto.endDate,
      status: dto.status,
    });
  }

  async update(
    id: string,
    schoolId: string,
    dto: UpdateSemesterDto,
  ): Promise<SemesterEntity> {
    const semester = await this.findById(id, schoolId);

    if (dto.startDate || dto.endDate) {
      const academicYear = await this.academicYearRepository.findById(
        semester.academicYearId,
        schoolId,
      );
      if (!academicYear) {
        throw new NotFoundException('Không tìm thấy năm học');
      }

      const startDate = dto.startDate ?? semester.startDate;
      const endDate = dto.endDate ?? semester.endDate;

      this.validateDatesWithinAcademicYear(
        startDate,
        endDate,
        academicYear.startDate,
        academicYear.endDate,
      );
    }

    const updated = await this.semesterRepository.update(id, dto);
    if (!updated) {
      throw new NotFoundException('Không tìm thấy học kỳ');
    }
    return updated;
  }

  async remove(id: string, schoolId: string): Promise<void> {
    await this.findById(id, schoolId);
    await this.semesterRepository.softDelete(id);
  }

  private validateDatesWithinAcademicYear(
    startDate: string,
    endDate: string,
    yearStartDate: string,
    yearEndDate: string,
  ): void {
    const semStart = new Date(startDate);
    const semEnd = new Date(endDate);
    const yearStart = new Date(yearStartDate);
    const yearEnd = new Date(yearEndDate);

    if (semStart >= semEnd) {
      throw new BadRequestException(
        'Ngày bắt đầu học kỳ phải trước ngày kết thúc',
      );
    }

    if (semStart < yearStart || semEnd > yearEnd) {
      throw new SemesterOutOfRangeException(
        'Ngày của học kỳ phải nằm trong phạm vi ngày của năm học',
      );
    }
  }
}
