import {
  Injectable,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { FormulaRepository } from '../repositories/formula.repository';
import { PayComponentRepository } from '../repositories/pay-component.repository';
import { VariableRepository } from '../repositories/variable.repository';
import { AuditLogRepository } from '../repositories/audit-log.repository';
import { FormulaEntity } from '../entities/formula.entity';
import { CreateFormulaDto } from '../dto/formula/create-formula.dto';
import { UpdateFormulaDto } from '../dto/formula/update-formula.dto';
import { FormulaQueryDto } from '../dto/formula/formula-query.dto';
import { ValidateFormulaDto } from '../dto/formula/validate-formula.dto';
import { PaginatedResponse } from '../../../common/interfaces/api-response.interface';
import { FormulaStatus } from '../enums';
import {
  Parser,
  ParseError,
  FormulaValidator,
  DependencyExtractor,
  CircularDependencyDetector,
  PrettyPrinter,
  getAvailableFunctionNames,
  ASTNode,
} from '../formula-engine';

export interface FormulaValidationResult {
  valid: boolean;
  errors: string[];
  prettyPrint?: string;
  dependencies?: string[];
  variableRefs?: string[];
}

@Injectable()
export class FormulaService {
  constructor(
    private readonly formulaRepository: FormulaRepository,
    private readonly payComponentRepository: PayComponentRepository,
    private readonly variableRepository: VariableRepository,
    private readonly auditLogRepository: AuditLogRepository,
  ) {}

  async findAll(
    query: FormulaQueryDto,
  ): Promise<PaginatedResponse<FormulaEntity>> {
    const [data, total] = await this.formulaRepository.findAll(query);
    const totalPages = Math.ceil(total / query.limit);

    return {
      success: true,
      data,
      message: 'Lấy danh sách công thức thành công',
      meta: {
        page: query.page,
        limit: query.limit,
        total,
        totalPages,
      },
    };
  }

  async findById(id: string): Promise<FormulaEntity> {
    const entity = await this.formulaRepository.findById(id);
    if (!entity) {
      throw new NotFoundException('Không tìm thấy công thức');
    }
    return entity;
  }

  async create(
    dto: CreateFormulaDto,
    createdBy?: string,
  ): Promise<FormulaEntity> {
    // Parse and validate formula
    const validation = await this.validateExpression(
      dto.expression,
      dto.schoolId,
    );
    if (!validation.valid) {
      throw new BadRequestException(
        `Công thức không hợp lệ: ${validation.errors.join('; ')}`,
      );
    }

    // Parse AST
    const parser = new Parser(dto.expression);
    const ast = parser.parse();

    const version =
      (await this.formulaRepository.getMaxVersion(
        dto.payComponentId,
        dto.schoolId,
      )) + 1;

    const entity = await this.formulaRepository.create({
      payComponentId: dto.payComponentId,
      schoolId: dto.schoolId,
      expression: dto.expression,
      parsedAst: ast as unknown as Record<string, unknown>,
      dependencies: validation.dependencies || null,
      variableRefs: validation.variableRefs || null,
      version,
      changelog: dto.changelog || `Version ${version} created`,
      status: FormulaStatus.DRAFT,
      createdBy: createdBy || null,
    });

    if (createdBy) {
      await this.auditLogRepository.create({
        entityType: 'formula',
        entityId: entity.id,
        action: 'create',
        oldValue: null,
        newValue: entity as unknown as Record<string, unknown>,
        performedBy: createdBy,
      });
    }

    return entity;
  }

  async update(
    id: string,
    dto: UpdateFormulaDto,
    createdBy?: string,
  ): Promise<FormulaEntity> {
    const existing = await this.findById(id);

    // Parse and validate new expression
    const validation = await this.validateExpression(
      dto.expression,
      existing.schoolId,
    );
    if (!validation.valid) {
      throw new BadRequestException(
        `Công thức không hợp lệ: ${validation.errors.join('; ')}`,
      );
    }

    // Parse AST
    const parser = new Parser(dto.expression);
    const ast = parser.parse();

    // Create new version instead of modifying existing
    const version =
      (await this.formulaRepository.getMaxVersion(
        existing.payComponentId,
        existing.schoolId,
      )) + 1;

    const entity = await this.formulaRepository.create({
      payComponentId: existing.payComponentId,
      schoolId: existing.schoolId,
      expression: dto.expression,
      parsedAst: ast as unknown as Record<string, unknown>,
      dependencies: validation.dependencies || null,
      variableRefs: validation.variableRefs || null,
      formulaVersion: version,
      changelog: dto.changelog || `Version ${version} updated`,
      status: FormulaStatus.DRAFT,
    });

    if (createdBy) {
      await this.auditLogRepository.create({
        entityType: 'formula',
        entityId: entity.id,
        action: 'update',
        oldValue: {
          expression: existing.expression,
          version: existing.formulaVersion,
        },
        newValue: { expression: dto.expression, version },
        performedBy: createdBy,
      });
    }

    return entity;
  }

  async publish(id: string, performedBy?: string): Promise<FormulaEntity> {
    const formula = await this.findById(id);

    if (formula.status === FormulaStatus.PUBLISHED) {
      throw new BadRequestException('Công thức đã được publish');
    }

    // Re-validate before publishing
    const validation = await this.validateExpression(
      formula.expression,
      formula.schoolId,
    );
    if (!validation.valid) {
      throw new BadRequestException(
        `Không thể publish - công thức không hợp lệ: ${validation.errors.join('; ')}`,
      );
    }

    // Check circular dependencies
    const circularCheck = await this.checkCircularDependencies(
      formula.payComponentId,
      formula.schoolId,
      validation.dependencies || [],
    );
    if (circularCheck) {
      throw new BadRequestException(
        `Không thể publish - phát hiện tham chiếu vòng: ${circularCheck}`,
      );
    }

    // Unpublish any existing published version for same pay component
    const existingPublished =
      await this.formulaRepository.findPublishedByPayComponent(
        formula.payComponentId,
        formula.schoolId,
      );
    if (existingPublished && existingPublished.id !== formula.id) {
      await this.formulaRepository.update(existingPublished.id, {
        status: FormulaStatus.DRAFT,
      });
    }

    const updated = await this.formulaRepository.update(id, {
      status: FormulaStatus.PUBLISHED,
    });
    if (!updated) {
      throw new NotFoundException('Không tìm thấy công thức');
    }

    if (performedBy) {
      await this.auditLogRepository.create({
        entityType: 'formula',
        entityId: id,
        action: 'publish',
        oldValue: { status: FormulaStatus.DRAFT },
        newValue: { status: FormulaStatus.PUBLISHED },
        performedBy,
      });
    }

    return updated;
  }

  async rollback(
    id: string,
    targetVersion: number,
    performedBy?: string,
  ): Promise<FormulaEntity> {
    const current = await this.findById(id);

    // Find the target version
    const versions = await this.formulaRepository.findByPayComponentId(
      current.payComponentId,
      current.schoolId,
    );
    const targetFormula = versions.find((f) => f.formulaVersion === targetVersion);
    if (!targetFormula) {
      throw new NotFoundException(`Không tìm thấy phiên bản ${targetVersion}`);
    }

    // Create new version with old content
    const newVersion =
      (await this.formulaRepository.getMaxVersion(
        current.payComponentId,
        current.schoolId,
      )) + 1;

    const entity = await this.formulaRepository.create({
      payComponentId: current.payComponentId,
      schoolId: current.schoolId,
      expression: targetFormula.expression,
      parsedAst: targetFormula.parsedAst,
      dependencies: targetFormula.dependencies,
      variableRefs: targetFormula.variableRefs,
      formulaVersion: newVersion,
      changelog: `Rollback from version ${targetVersion}`,
      status: FormulaStatus.DRAFT,
    });

    if (performedBy) {
      await this.auditLogRepository.create({
        entityType: 'formula',
        entityId: entity.id,
        action: 'update',
        oldValue: { version: current.formulaVersion },
        newValue: { version: newVersion, rollbackFrom: targetVersion },
        performedBy,
        metadata: { type: 'rollback', targetVersion },
      });
    }

    return entity;
  }

  async clone(
    id: string,
    newPayComponentId: string,
    schoolId: string,
    performedBy?: string,
  ): Promise<FormulaEntity> {
    const source = await this.findById(id);

    const entity = await this.formulaRepository.create({
      payComponentId: newPayComponentId,
      schoolId,
      expression: source.expression,
      parsedAst: source.parsedAst,
      dependencies: source.dependencies,
      variableRefs: source.variableRefs,
      formulaVersion: 1,
      changelog: `Cloned from formula ${source.id} (version ${source.formulaVersion})`,
      status: FormulaStatus.DRAFT,
    });

    return entity;
  }

  async getVersionHistory(
    payComponentId: string,
    schoolId: string,
  ): Promise<FormulaEntity[]> {
    return this.formulaRepository.findByPayComponentId(
      payComponentId,
      schoolId,
    );
  }

  async getVersionsByFormulaId(id: string): Promise<FormulaEntity[]> {
    const formula = await this.findById(id);
    return this.formulaRepository.findByPayComponentId(
      formula.payComponentId,
      formula.schoolId,
    );
  }

  async validate(dto: ValidateFormulaDto): Promise<FormulaValidationResult> {
    return this.validateExpression(dto.expression, dto.schoolId);
  }

  // Private methods

  private async validateExpression(
    expression: string,
    schoolId?: string,
  ): Promise<FormulaValidationResult> {
    const errors: string[] = [];

    // Step 1: Parse
    let ast: ASTNode;
    try {
      const parser = new Parser(expression);
      ast = parser.parse();
    } catch (e) {
      if (e instanceof ParseError) {
        return {
          valid: false,
          errors: [`Parse error at position ${e.position}: ${e.message}`],
        };
      }
      return { valid: false, errors: [`Parse error: ${(e as Error).message}`] };
    }

    // Step 2: Get available identifiers
    const payComponentCodes = new Set<string>();
    const variableCodes = new Set<string>();

    if (schoolId) {
      // Fetch pay component codes for this school
      const [components] = await this.payComponentRepository.findAll({
        page: 1,
        limit: 1000,
        sortOrder: 'ASC',
        schoolId,
      });
      components.forEach((c) => payComponentCodes.add(c.code));
    }

    // Fetch all variable codes
    const [variables] = await this.variableRepository.findAll({
      page: 1,
      limit: 1000,
      sortOrder: 'ASC',
    });
    variables.forEach((v) => variableCodes.add(v.code));

    // Step 3: Validate identifiers and function calls
    const allKnownIdentifiers = new Set([
      ...payComponentCodes,
      ...variableCodes,
    ]);
    const functionNames = getAvailableFunctionNames();

    const validator = new FormulaValidator({
      variableCodes: allKnownIdentifiers,
      payComponentCodes: payComponentCodes,
      functionNames,
    });

    const validationErrors = validator.validate(ast);
    for (const err of validationErrors) {
      errors.push(err.message);
    }

    // Step 4: Extract dependencies
    const extractor = new DependencyExtractor(payComponentCodes);
    const dependencies = extractor.extract(ast);
    const variableRefs = extractor.extractVariableRefs(ast, variableCodes);

    // Step 5: Pretty print
    let prettyPrint: string | undefined;
    try {
      const printer = new PrettyPrinter();
      prettyPrint = printer.print(ast);
    } catch {
      // Pretty print failure is not a blocking error
    }

    return {
      valid: errors.length === 0,
      errors,
      prettyPrint,
      dependencies,
      variableRefs,
    };
  }

  private async checkCircularDependencies(
    payComponentId: string,
    schoolId: string,
    newDependencies: string[],
  ): Promise<string | null> {
    // Build existing dependency graph
    const publishedFormulas =
      await this.formulaRepository.findPublishedBySchool(schoolId);
    const graph = new Map<string, string[]>();

    // Get pay component code for this formula
    const payComponent =
      await this.payComponentRepository.findById(payComponentId);
    if (!payComponent) return null;

    for (const formula of publishedFormulas) {
      const pc = await this.payComponentRepository.findById(
        formula.payComponentId,
      );
      if (pc && formula.dependencies) {
        graph.set(pc.code, formula.dependencies);
      }
    }

    // Add the new dependencies
    graph.set(payComponent.code, newDependencies);

    const detector = new CircularDependencyDetector();
    const result = detector.detect(graph);

    if (result.hasCycle) {
      return result.cycle.join(' → ');
    }

    return null;
  }
}
