import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { CurriculumPlanRepository } from './curriculum-plan.repository';
import {
  CurriculumPlanEntity,
  CurriculumPlanStatus,
} from './entities/curriculum-plan.entity';

export interface CreateCurriculumPlanInput {
  schoolId: string;
  academicYearId: string;
  gradeId: string;
  name: string;
  description?: string;
}

export interface AddCurriculumItemInput {
  subjectId: string;
  periodsPerWeek: number;
  isRequired?: boolean;
  note?: string;
  displayOrder?: number;
}

@Injectable()
export class CurriculumPlanService {
  constructor(
    private readonly curriculumPlanRepository: CurriculumPlanRepository,
  ) {}

  async findBySchool(schoolId: string): Promise<CurriculumPlanEntity[]> {
    return this.curriculumPlanRepository.findBySchool(schoolId);
  }

  async findById(id: string): Promise<CurriculumPlanEntity> {
    const plan = await this.curriculumPlanRepository.findById(id);
    if (!plan) {
      throw new NotFoundException('Không tìm thấy kế hoạch giảng dạy');
    }
    return plan;
  }

  async create(input: CreateCurriculumPlanInput): Promise<CurriculumPlanEntity> {
    const existing = await this.curriculumPlanRepository.findBySchoolAndGrade(
      input.schoolId,
      input.academicYearId,
      input.gradeId,
    );

    if (existing) {
      throw new BadRequestException(
        'Kế hoạch giảng dạy đã tồn tại cho khối và năm học này',
      );
    }

    return this.curriculumPlanRepository.create({
      schoolId: input.schoolId,
      academicYearId: input.academicYearId,
      gradeId: input.gradeId,
      name: input.name,
      description: input.description ?? null,
      status: CurriculumPlanStatus.DRAFT,
    });
  }

  async approve(
    id: string,
    approvedBy: string,
  ): Promise<CurriculumPlanEntity> {
    const plan = await this.findById(id);

    if (plan.status !== CurriculumPlanStatus.DRAFT) {
      throw new BadRequestException(
        'Chỉ có thể phê duyệt kế hoạch ở trạng thái nháp',
      );
    }

    const updated = await this.curriculumPlanRepository.update(id, {
      status: CurriculumPlanStatus.APPROVED,
      approvedBy,
      approvedAt: new Date(),
    });

    if (!updated) {
      throw new NotFoundException('Không tìm thấy kế hoạch giảng dạy');
    }

    return updated;
  }

  async remove(id: string): Promise<void> {
    const plan = await this.findById(id);

    if (plan.status === CurriculumPlanStatus.PUBLISHED) {
      throw new BadRequestException(
        'Không thể xóa kế hoạch đã công bố. Vui lòng lưu trữ trước.',
      );
    }

    await this.curriculumPlanRepository.softDelete(id);
  }
}
