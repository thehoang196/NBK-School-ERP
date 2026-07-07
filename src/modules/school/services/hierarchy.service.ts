import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, IsNull } from 'typeorm';
import { SchoolEntity } from '../entities/school.entity';
import { CacheService } from '../../cache/cache.service';

/**
 * Cây phân cấp trường học.
 * Mỗi node chứa thông tin trường và danh sách con.
 */
export interface HierarchyNode {
  school: SchoolEntity;
  children: HierarchyNode[];
}

/** TTL cho hierarchy cache: 15 phút */
const HIERARCHY_CACHE_TTL = 900;

/** Cache key prefix */
const CACHE_KEY_PREFIX = 'hierarchy:';

/**
 * HierarchyService — Quản lý cấu trúc phân cấp trường học.
 *
 * Tránh hardcode giả định 2 cấp (Holding → School).
 * Hỗ trợ cấu trúc phân cấp đa cấp tùy ý.
 *
 * Sử dụng:
 * - getDescendants(schoolId): Lấy tất cả trường con/cháu (BFS)
 * - getAncestors(schoolId): Lấy tất cả tổ tiên (duyệt lên)
 * - resolveHierarchy(schoolId): Trả về cây đầy đủ từ node gốc
 * - invalidateHierarchyCache(schoolId): Xóa cache khi cấu trúc thay đổi
 */
@Injectable()
export class HierarchyService {
  private readonly logger = new Logger(HierarchyService.name);

  constructor(
    @InjectRepository(SchoolEntity)
    private readonly schoolRepo: Repository<SchoolEntity>,
    private readonly cacheService: CacheService,
  ) {}

  /**
   * Lấy tất cả trường con/cháu (descendants) của một trường.
   * Sử dụng BFS (breadth-first traversal) để tránh stack overflow
   * với cấu trúc phân cấp sâu.
   *
   * Chỉ trả về trường có deletedAt IS NULL.
   */
  async getDescendants(schoolId: string): Promise<SchoolEntity[]> {
    const cacheKey = `${CACHE_KEY_PREFIX}descendants:${schoolId}`;

    return this.cacheService.getOrSet(
      cacheKey,
      () => this.fetchDescendants(schoolId),
      { ttl: HIERARCHY_CACHE_TTL },
    );
  }

  /**
   * Lấy tất cả tổ tiên (ancestors) của một trường.
   * Duyệt ngược parentSchoolId chain cho đến root (parentSchoolId = null).
   *
   * Trả về mảng sắp xếp từ cha trực tiếp → root.
   * Chỉ trả về trường có deletedAt IS NULL.
   */
  async getAncestors(schoolId: string): Promise<SchoolEntity[]> {
    const cacheKey = `${CACHE_KEY_PREFIX}ancestors:${schoolId}`;

    return this.cacheService.getOrSet(
      cacheKey,
      () => this.fetchAncestors(schoolId),
      { ttl: HIERARCHY_CACHE_TTL },
    );
  }

  /**
   * Trả về cây phân cấp đầy đủ bắt đầu từ một node.
   * Node gốc là trường có schoolId, và children là đệ quy
   * tất cả trường con.
   *
   * Chỉ bao gồm trường có deletedAt IS NULL.
   */
  async resolveHierarchy(schoolId: string): Promise<HierarchyNode | null> {
    const cacheKey = `${CACHE_KEY_PREFIX}tree:${schoolId}`;

    return this.cacheService.getOrSet(
      cacheKey,
      () => this.fetchHierarchy(schoolId),
      { ttl: HIERARCHY_CACHE_TTL },
    );
  }

  /**
   * Xóa tất cả cache liên quan đến hierarchy của một trường.
   * Gọi khi cấu trúc trường thay đổi (tạo/xóa/di chuyển trường con).
   */
  async invalidateHierarchyCache(schoolId: string): Promise<void> {
    this.logger.log(
      `Invalidating hierarchy cache for school: ${schoolId}`,
    );

    // Xóa cache cho chính school này
    await this.cacheService.del(`${CACHE_KEY_PREFIX}descendants:${schoolId}`);
    await this.cacheService.del(`${CACHE_KEY_PREFIX}ancestors:${schoolId}`);
    await this.cacheService.del(`${CACHE_KEY_PREFIX}tree:${schoolId}`);

    // Xóa tất cả cache có prefix hierarchy: (ancestors/descendants của các node khác có thể bị ảnh hưởng)
    await this.cacheService.delByPattern(CACHE_KEY_PREFIX);
  }

  /**
   * BFS traversal để lấy tất cả descendants.
   * Không giới hạn số cấp — duyệt cho đến khi hết con.
   */
  private async fetchDescendants(schoolId: string): Promise<SchoolEntity[]> {
    const descendants: SchoolEntity[] = [];
    const queue: string[] = [schoolId];

    while (queue.length > 0) {
      const currentId = queue.shift()!;

      const children = await this.schoolRepo.find({
        where: {
          parentSchoolId: currentId,
          deletedAt: IsNull(),
        },
      });

      for (const child of children) {
        descendants.push(child);
        queue.push(child.id);
      }
    }

    return descendants;
  }

  /**
   * Traverse ngược parentSchoolId chain cho đến root.
   */
  private async fetchAncestors(schoolId: string): Promise<SchoolEntity[]> {
    const ancestors: SchoolEntity[] = [];
    let currentId: string | null = schoolId;

    // Lấy school hiện tại để bắt đầu traverse
    const startSchool = await this.schoolRepo.findOne({
      where: { id: currentId, deletedAt: IsNull() },
    });

    if (!startSchool) {
      return ancestors;
    }

    currentId = startSchool.parentSchoolId;

    // Duyệt lên parent chain, giới hạn 100 vòng lặp tránh infinite loop
    let safetyCounter = 0;
    const maxDepth = 100;

    while (currentId !== null && safetyCounter < maxDepth) {
      const parent = await this.schoolRepo.findOne({
        where: { id: currentId, deletedAt: IsNull() },
      });

      if (!parent) {
        break;
      }

      ancestors.push(parent);
      currentId = parent.parentSchoolId;
      safetyCounter++;
    }

    if (safetyCounter >= maxDepth) {
      this.logger.warn(
        `Possible circular reference detected in hierarchy for school: ${schoolId}`,
      );
    }

    return ancestors;
  }

  /**
   * Xây dựng cây đệ quy từ một node gốc.
   * Sử dụng BFS để thu thập tất cả nodes rồi build tree structure.
   */
  private async fetchHierarchy(
    schoolId: string,
  ): Promise<HierarchyNode | null> {
    const rootSchool = await this.schoolRepo.findOne({
      where: { id: schoolId, deletedAt: IsNull() },
    });

    if (!rootSchool) {
      return null;
    }

    return this.buildTree(rootSchool);
  }

  /**
   * Đệ quy xây dựng tree node từ một school entity.
   * Mỗi node chứa school info và children đệ quy.
   */
  private async buildTree(school: SchoolEntity): Promise<HierarchyNode> {
    const children = await this.schoolRepo.find({
      where: {
        parentSchoolId: school.id,
        deletedAt: IsNull(),
      },
    });

    const childNodes: HierarchyNode[] = [];
    for (const child of children) {
      const childNode = await this.buildTree(child);
      childNodes.push(childNode);
    }

    return {
      school,
      children: childNodes,
    };
  }
}
