import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, IsNull } from 'typeorm';
import { FormulaVersionEntity } from '../entities/formula-version.entity';
import { FormulaEntity } from '../entities/formula.entity';
import { FormulaStatus } from '../enums';

@Injectable()
export class FormulaVersionService {
  private readonly logger = new Logger(FormulaVersionService.name);

  constructor(
    @InjectRepository(FormulaVersionEntity)
    private readonly repo: Repository<FormulaVersionEntity>,
  ) {}

  /**
   * Ghi lại version khi formula được create/update.
   * Append-only: không bao giờ sửa record cũ.
   */
  async recordVersion(formula: FormulaEntity): Promise<FormulaVersionEntity> {
    const entity = this.repo.create({
      formulaId: formula.id,
      schoolId: formula.schoolId,
      versionNumber: formula.formulaVersion,
      expression: formula.expression,
      parsedAst: formula.parsedAst,
      effectiveFrom: formula.effectiveFrom,
      effectiveTo: formula.effectiveTo,
      changelog: formula.changelog,
      status: formula.status,
      createdBy: formula.createdBy,
    });
    return this.repo.save(entity);
  }

  /**
   * Lấy tất cả versions của 1 formula.
   */
  async findByFormulaId(formulaId: string): Promise<FormulaVersionEntity[]> {
    return this.repo.find({
      where: { formulaId, deletedAt: IsNull() },
      order: { versionNumber: 'DESC' },
    });
  }

  /**
   * Lấy version cụ thể.
   */
  async findVersion(
    formulaId: string,
    versionNumber: number,
  ): Promise<FormulaVersionEntity | null> {
    return this.repo.findOne({
      where: { formulaId, versionNumber, deletedAt: IsNull() },
    });
  }

  /**
   * Lấy versions used map cho snapshot.
   * Returns { payComponentCode: versionNumber } cho tất cả formulas.
   */
  async getVersionsMap(
    formulas: FormulaEntity[],
  ): Promise<Record<string, number>> {
    const map: Record<string, number> = {};
    for (const formula of formulas) {
      map[formula.id] = formula.formulaVersion;
    }
    return map;
  }
}
