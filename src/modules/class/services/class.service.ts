import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { ClassRepository } from '../repositories/class.repository';
import { ClassEntity } from '../entities/class.entity';
import { CreateClassDto } from '../dto/create-class.dto';
import { UpdateClassDto } from '../dto/update-class.dto';
import { ClassQueryDto } from '../dto/class-query.dto';
import { DuplicateClassNameException } from '../exceptions/duplicate-class-name.exception';
import { PaginatedResponse } from '../../../common/interfaces/api-response.interface';

@Injectable()
export class ClassService {
  constructor(private readonly classRepository: ClassRepository) {}

  /**
   * Lấy danh sách lớp với filter gradeId, academicYearId, status, search
   * Hỗ trợ phân trang
   */
  async findAll(
    query: ClassQueryDto,
    schoolScope?: string | null,
  ): Promise<PaginatedResponse<ClassEntity>> {
    const schoolId = schoolScope || query.schoolId || '';
    const [data, total] = await this.classRepository.findAll(query, schoolId);
    const totalPages = Math.ceil(total / query.limit);

    return {
      success: true,
      data,
      message: 'Lấy danh sách lớp thành công',
      meta: {
        page: query.page,
        limit: query.limit,
        total,
        totalPages,
      },
    };
  }

  /**
   * Tìm lớp theo ID, filter theo schoolId (multi-tenant)
   * Throw NotFoundException nếu không tìm thấy
   */
  async findById(id: string, schoolId?: string): Promise<ClassEntity> {
    const classEntity = await this.classRepository.findById(id, schoolId);
    if (!classEntity) {
      throw new NotFoundException('Không tìm thấy lớp');
    }
    return classEntity;
  }

  /**
   * Tạo lớp mới
   * Business rule: validate không trùng tên lớp trong cùng khối và năm học (REQ-7.2)
   * Throw DuplicateClassNameException nếu trùng
   */
  async create(
    dto: CreateClassDto,
    schoolScope?: string | null,
  ): Promise<ClassEntity> {
    const schoolId = schoolScope || dto.schoolId;
    if (!schoolId) {
      throw new BadRequestException('schoolId là bắt buộc');
    }

    await this.validateUniqueClassName(
      dto.name,
      dto.gradeId,
      dto.academicYearId,
      schoolId,
    );

    return this.classRepository.create({ ...dto, schoolId });
  }

  /**
   * Cập nhật thông tin lớp
   * Business rule: validate không trùng tên lớp trong cùng khối và năm học khi thay đổi (REQ-7.2)
   * Throw DuplicateClassNameException nếu trùng
   */
  async update(
    id: string,
    dto: UpdateClassDto,
    schoolScope?: string | null,
  ): Promise<ClassEntity> {
    const classEntity = await this.findById(id, schoolScope || undefined);
    const schoolId = schoolScope || classEntity.schoolId;

    if (dto.name || dto.gradeId || dto.academicYearId) {
      const name = dto.name || classEntity.name;
      const gradeId = dto.gradeId || classEntity.gradeId;
      const academicYearId = dto.academicYearId || classEntity.academicYearId;

      await this.validateUniqueClassName(
        name,
        gradeId,
        academicYearId,
        schoolId,
        id,
      );
    }

    const updated = await this.classRepository.update(id, { ...dto, schoolId });
    if (!updated) {
      throw new NotFoundException('Không tìm thấy lớp');
    }
    return updated;
  }

  /**
   * Xóa mềm lớp
   */
  async remove(id: string, schoolScope?: string | null): Promise<void> {
    await this.findById(id, schoolScope || undefined);
    await this.classRepository.softDelete(id);
  }

  /**
   * Validate không trùng tên lớp trong cùng khối và năm học (REQ-7.2)
   * @throws DuplicateClassNameException nếu đã tồn tại lớp cùng tên trong khối + năm học + trường
   */
  private async validateUniqueClassName(
    name: string,
    gradeId: string,
    academicYearId: string,
    schoolId: string,
    excludeId?: string,
  ): Promise<void> {
    const existing = await this.classRepository.findByNameGradeYear(
      name,
      gradeId,
      academicYearId,
      schoolId,
      excludeId,
    );
    if (existing) {
      throw new DuplicateClassNameException();
    }
  }
}
