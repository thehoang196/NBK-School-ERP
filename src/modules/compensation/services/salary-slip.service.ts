import {
  Injectable,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import {
  SalarySlipRepository,
  SalarySlipQueryDto,
} from '../repositories/salary-slip.repository';
import { SalarySlipEntity } from '../entities/salary-slip.entity';
import { PaginatedResponse } from '../../../common/interfaces/api-response.interface';
import { SalarySlipStatus } from '../enums';

@Injectable()
export class SalarySlipService {
  constructor(private readonly salarySlipRepository: SalarySlipRepository) {}

  async findAll(
    query: SalarySlipQueryDto,
  ): Promise<PaginatedResponse<SalarySlipEntity>> {
    const [data, total] = await this.salarySlipRepository.findAll(query);
    const totalPages = Math.ceil(total / query.limit);

    return {
      success: true,
      data,
      message: 'Lấy danh sách phiếu lương thành công',
      meta: {
        page: query.page,
        limit: query.limit,
        total,
        totalPages,
      },
    };
  }

  async findById(id: string): Promise<SalarySlipEntity> {
    const entity = await this.salarySlipRepository.findById(id);
    if (!entity) {
      throw new NotFoundException('Không tìm thấy phiếu lương');
    }
    return entity;
  }

  /**
   * Confirm a salary slip. Only DRAFT slips can be confirmed.
   * Once confirmed, the slip is locked and cannot be recalculated.
   */
  async confirm(id: string): Promise<SalarySlipEntity> {
    const entity = await this.findById(id);

    if (entity.status !== SalarySlipStatus.DRAFT) {
      throw new BadRequestException(
        `Chỉ có thể xác nhận phiếu lương ở trạng thái DRAFT. Trạng thái hiện tại: ${entity.status}`,
      );
    }

    if (entity.errors && entity.errors.length > 0) {
      throw new BadRequestException(
        'Không thể xác nhận phiếu lương có lỗi tính toán. Vui lòng sửa lỗi và tính lại.',
      );
    }

    const updated = await this.salarySlipRepository.update(id, {
      status: SalarySlipStatus.CONFIRMED,
    });

    if (!updated) {
      throw new NotFoundException('Không tìm thấy phiếu lương');
    }

    return updated;
  }

  /**
   * Check if a teacher has a confirmed/paid slip for a period.
   * Used to prevent recalculation.
   */
  async hasConfirmedSlip(
    teacherId: string,
    payPeriodId: string,
  ): Promise<boolean> {
    const slip =
      await this.salarySlipRepository.findConfirmedByTeacherAndPeriod(
        teacherId,
        payPeriodId,
      );
    return slip !== null;
  }
}
