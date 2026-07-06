import { Injectable, NotFoundException } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { AcademicYearRepository } from '../repositories/academic-year.repository';
import { AcademicYearEntity } from '../entities/academic-year.entity';
import {
  CreateAcademicYearDto,
  UpdateAcademicYearDto,
  AcademicYearQueryDto,
} from '../dto/academic-year';
import { PaginatedResponse } from '../../../common/interfaces/api-response.interface';
import { AcademicStatus } from '../../../common/enums/status.enum';
import { InvalidStatusTransitionException } from '../exceptions/invalid-status-transition.exception';
import { AcademicYearOverlapException } from '../exceptions/academic-year-overlap.exception';
import { AcademicYearDateConflictException } from '../exceptions/academic-year-date-conflict.exception';

/**
 * Valid status transitions for academic year lifecycle.
 * planning → active → completed
 */
const VALID_STATUS_TRANSITIONS: Record<AcademicStatus, AcademicStatus[]> = {
  [AcademicStatus.PLANNING]: [AcademicStatus.ACTIVE],
  [AcademicStatus.ACTIVE]: [AcademicStatus.COMPLETED],
  [AcademicStatus.COMPLETED]: [],
};

@Injectable()
export class AcademicYearService {
  constructor(
    private readonly academicYearRepository: AcademicYearRepository,
    private readonly dataSource: DataSource,
  ) {}

  async findAll(
    schoolId: string,
    query: AcademicYearQueryDto,
  ): Promise<PaginatedResponse<AcademicYearEntity>> {
    const [data, total] = await this.academicYearRepository.findAll(
      schoolId,
      query,
    );
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
    this.validateDateRange(dto.startDate, dto.endDate);

    // Date overlap validation: no overlapping active academic years per school
    const overlapping = await this.academicYearRepository.findOverlapping(
      dto.schoolId,
      dto.startDate,
      dto.endDate,
    );
    if (overlapping.length > 0) {
      throw new AcademicYearOverlapException();
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

  /**
   * Set an academic year as the current one for the school.
   * Within a single transaction: unsets previous is_current, then sets the new one.
   * Requirement 7.1: At most one academic year per school has is_current = true
   * Requirement 7.2: Setting current must atomically unset previous within same transaction
   */
  async setCurrent(id: string, schoolId: string): Promise<AcademicYearEntity> {
    const academicYear = await this.academicYearRepository.findById(id);
    if (!academicYear || academicYear.schoolId !== schoolId) {
      throw new NotFoundException('Không tìm thấy năm học');
    }

    await this.dataSource.transaction(async (manager) => {
      // Unset previous is_current for this school
      await manager
        .createQueryBuilder()
        .update(AcademicYearEntity)
        .set({ isCurrent: false })
        .where('schoolId = :schoolId', { schoolId })
        .andWhere('isCurrent = :isCurrent', { isCurrent: true })
        .andWhere('deletedAt IS NULL')
        .execute();

      // Set new academic year as current
      await manager
        .createQueryBuilder()
        .update(AcademicYearEntity)
        .set({ isCurrent: true })
        .where('id = :id', { id })
        .execute();
    });

    return this.academicYearRepository.findById(
      id,
    ) as Promise<AcademicYearEntity>;
  }

  /**
   * Transition the status of an academic year following the valid state machine.
   * Valid transitions: planning → active → completed
   * Requirement 7.4: Status transitions must follow the defined path
   * Requirement 7.5: Invalid transitions return error indicating valid transitions
   */
  async transitionStatus(
    id: string,
    newStatus: AcademicStatus,
    schoolId: string,
  ): Promise<AcademicYearEntity> {
    const academicYear = await this.academicYearRepository.findById(id);
    if (!academicYear || academicYear.schoolId !== schoolId) {
      throw new NotFoundException('Không tìm thấy năm học');
    }

    const currentStatus = academicYear.status;
    const allowedTransitions = VALID_STATUS_TRANSITIONS[currentStatus];

    if (!allowedTransitions.includes(newStatus)) {
      throw new InvalidStatusTransitionException(currentStatus, newStatus);
    }

    const updated = await this.academicYearRepository.update(id, {
      status: newStatus,
    });
    if (!updated) {
      throw new NotFoundException('Không tìm thấy năm học');
    }
    return updated;
  }

  async update(
    id: string,
    dto: UpdateAcademicYearDto,
  ): Promise<AcademicYearEntity> {
    const existing = await this.findById(id);

    const startDate = dto.startDate || existing.startDate;
    const endDate = dto.endDate || existing.endDate;

    if (dto.startDate || dto.endDate) {
      this.validateDateRange(startDate, endDate);

      const overlapping = await this.academicYearRepository.findOverlapping(
        existing.schoolId,
        startDate,
        endDate,
        id,
      );
      if (overlapping.length > 0) {
        throw new AcademicYearOverlapException();
      }
    }

    // If setting isCurrent=true during update, use transaction
    if (dto.isCurrent === true) {
      return this.setCurrentInTransaction(id, existing.schoolId, dto);
    }

    const updated = await this.academicYearRepository.update(id, dto);
    if (!updated) {
      throw new NotFoundException('Không tìm thấy năm học');
    }
    return updated;
  }

  /**
   * Validate that startDate is strictly before endDate.
   * Throws AcademicYearDateConflictException if invalid.
   */
  private validateDateRange(startDate: string, endDate: string): void {
    if (new Date(startDate) >= new Date(endDate)) {
      throw new AcademicYearDateConflictException();
    }
  }

  /**
   * Set isCurrent=true within a transaction, atomically unsetting the previous current year.
   * Used when update DTO includes isCurrent=true.
   */
  private async setCurrentInTransaction(
    id: string,
    schoolId: string,
    dto: Partial<AcademicYearEntity>,
  ): Promise<AcademicYearEntity> {
    await this.dataSource.transaction(async (manager) => {
      // Unset previous isCurrent for this school
      await manager
        .createQueryBuilder()
        .update(AcademicYearEntity)
        .set({ isCurrent: false })
        .where('schoolId = :schoolId', { schoolId })
        .andWhere('isCurrent = :isCurrent', { isCurrent: true })
        .andWhere('id != :id', { id })
        .andWhere('deletedAt IS NULL')
        .execute();

      // Update the record with all DTO fields
      await manager
        .createQueryBuilder()
        .update(AcademicYearEntity)
        .set(dto)
        .where('id = :id', { id })
        .execute();
    });

    return this.academicYearRepository.findById(
      id,
    ) as Promise<AcademicYearEntity>;
  }

  async remove(id: string): Promise<void> {
    await this.findById(id);
    await this.academicYearRepository.softDelete(id);
  }
}
