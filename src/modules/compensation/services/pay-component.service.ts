import {
  Injectable,
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { PayComponentRepository } from '../repositories/pay-component.repository';
import { PayComponentEntity } from '../entities/pay-component.entity';
import { CreatePayComponentDto } from '../dto/pay-component/create-pay-component.dto';
import { UpdatePayComponentDto } from '../dto/pay-component/update-pay-component.dto';
import { PayComponentQueryDto } from '../dto/pay-component/pay-component-query.dto';
import { PaginatedResponse } from '../../../common/interfaces/api-response.interface';
import { EntityStatus } from '../../../common/enums/status.enum';

@Injectable()
export class PayComponentService {
  constructor(
    private readonly payComponentRepository: PayComponentRepository,
  ) {}

  async findAll(
    query: PayComponentQueryDto,
  ): Promise<PaginatedResponse<PayComponentEntity>> {
    const [data, total] = await this.payComponentRepository.findAll(query);
    const totalPages = Math.ceil(total / query.limit);

    return {
      success: true,
      data,
      message: 'Lấy danh sách thành phần lương thành công',
      meta: {
        page: query.page,
        limit: query.limit,
        total,
        totalPages,
      },
    };
  }

  async findById(id: string): Promise<PayComponentEntity> {
    const entity = await this.payComponentRepository.findById(id);
    if (!entity) {
      throw new NotFoundException('Không tìm thấy thành phần lương');
    }
    return entity;
  }

  async create(dto: CreatePayComponentDto): Promise<PayComponentEntity> {
    // Validate code format
    if (!/^[A-Z][A-Z0-9_]*$/.test(dto.code)) {
      throw new BadRequestException(
        'Mã thành phần lương phải bắt đầu bằng chữ hoa và chỉ chứa chữ hoa, số, gạch dưới',
      );
    }

    // Check unique code per school
    const existing = await this.payComponentRepository.findByCode(
      dto.code,
      dto.schoolId,
    );
    if (existing) {
      throw new ConflictException(
        `Mã thành phần lương "${dto.code}" đã tồn tại trong trường này`,
      );
    }

    return this.payComponentRepository.create(dto);
  }

  async update(
    id: string,
    dto: UpdatePayComponentDto,
  ): Promise<PayComponentEntity> {
    const entity = await this.findById(id);

    // If component is referenced by formula, only allow name/sortOrder changes
    const isReferencedByFormula = await this.isReferencedByActiveFormula(id);
    if (isReferencedByFormula) {
      const restrictedFields = [
        'code',
        'type',
        'isTaxable',
        'isInsuranceApplicable',
        'isStatutory',
        'status',
      ];
      const hasRestrictedChange = restrictedFields.some(
        (field) => dto[field as keyof UpdatePayComponentDto] !== undefined,
      );
      if (hasRestrictedChange) {
        throw new BadRequestException(
          'Thành phần lương đang được tham chiếu bởi công thức. Chỉ được phép sửa tên hiển thị và thứ tự',
        );
      }
    }

    // If code is being changed, validate uniqueness
    if (dto.code && dto.code !== entity.code) {
      const existing = await this.payComponentRepository.findByCode(
        dto.code,
        entity.schoolId,
      );
      if (existing) {
        throw new ConflictException(
          `Mã thành phần lương "${dto.code}" đã tồn tại trong trường này`,
        );
      }
    }

    const updated = await this.payComponentRepository.update(id, dto);
    if (!updated) {
      throw new NotFoundException('Không tìm thấy thành phần lương');
    }
    return updated;
  }

  async deactivate(id: string): Promise<void> {
    await this.findById(id);

    // Check if referenced by active formula
    const referencingFormulas = await this.getReferencingActiveFormulas(id);
    if (referencingFormulas.length > 0) {
      const formulaNames = referencingFormulas.map((f) => f.name).join(', ');
      throw new BadRequestException(
        `Không thể vô hiệu hóa thành phần lương đang được sử dụng trong các công thức: ${formulaNames}`,
      );
    }

    await this.payComponentRepository.softDelete(id);
  }

  /**
   * Check if a pay component is referenced by any active (published) formula.
   * This will be implemented fully when the Formula module is created.
   * For now, returns false as a placeholder.
   */
  async isReferencedByActiveFormula(payComponentId: string): Promise<boolean> {
    // TODO: Implement when FormulaRepository is available
    // Will query formulas where status = PUBLISHED and dependencies contains this pay component code
    return false;
  }

  /**
   * Get list of active formulas referencing this pay component.
   * Placeholder until Formula module is implemented.
   */
  async getReferencingActiveFormulas(
    payComponentId: string,
  ): Promise<{ name: string }[]> {
    // TODO: Implement when FormulaRepository is available
    return [];
  }
}
