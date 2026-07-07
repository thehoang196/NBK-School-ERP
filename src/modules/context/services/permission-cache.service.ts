import { Injectable, Logger } from '@nestjs/common';
import { CacheService } from '../../cache/cache.service';

/**
 * PermissionCacheService — Caching layer cho permission matrix theo role.
 *
 * Sử dụng CacheService abstraction (KHÔNG gọi Redis trực tiếp).
 * Key pattern: `permission:{roleId}`
 * TTL: 10 phút (600 giây)
 *
 * Lưu ý: Đây là lightweight caching layer. Actual permission resolution
 * được xử lý bởi PermissionsGuard/RolesGuard hiện tại.
 *
 * Error handling: catch và log lỗi, KHÔNG throw — đảm bảo cache failure
 * không ảnh hưởng đến luồng chính.
 */
@Injectable()
export class PermissionCacheService {
  private readonly logger = new Logger(PermissionCacheService.name);

  /** TTL 10 phút (600 giây) */
  private readonly PERMISSION_TTL = 600;

  /** Key prefix cho permission cache */
  private readonly KEY_PREFIX = 'permission:';

  constructor(private readonly cacheService: CacheService) {}

  /**
   * Lấy danh sách permission đã cache cho một role.
   * @param roleId ID của role cần lấy permissions
   * @returns Danh sách permission strings hoặc null nếu cache miss/lỗi
   */
  async getCachedPermissions(roleId: string): Promise<string[] | null> {
    try {
      const key = this.buildKey(roleId);
      return await this.cacheService.get<string[]>(key);
    } catch (error) {
      this.logger.warn(
        `Lỗi khi đọc permission cache cho role ${roleId}: ${(error as Error).message}`,
      );
      return null;
    }
  }

  /**
   * Cache danh sách permission cho một role với TTL 10 phút.
   * @param roleId ID của role
   * @param permissions Danh sách permission strings cần cache
   */
  async setCachedPermissions(roleId: string, permissions: string[]): Promise<void> {
    try {
      const key = this.buildKey(roleId);
      await this.cacheService.set<string[]>(key, permissions, {
        ttl: this.PERMISSION_TTL,
      });
    } catch (error) {
      this.logger.warn(
        `Lỗi khi ghi permission cache cho role ${roleId}: ${(error as Error).message}`,
      );
    }
  }

  /**
   * Xoá cache permission cho một role cụ thể.
   * Gọi khi role/permission thay đổi.
   * @param roleId ID của role cần invalidate
   */
  async invalidatePermissions(roleId: string): Promise<void> {
    try {
      const key = this.buildKey(roleId);
      await this.cacheService.del(key);
      this.logger.log(`Đã invalidate permission cache cho role ${roleId}`);
    } catch (error) {
      this.logger.warn(
        `Lỗi khi invalidate permission cache cho role ${roleId}: ${(error as Error).message}`,
      );
    }
  }

  /**
   * Xoá tất cả permission caches (bulk role/permission changes).
   * Gọi khi có thay đổi hàng loạt về quyền.
   */
  async invalidateAllPermissions(): Promise<void> {
    try {
      await this.cacheService.delByPattern(this.KEY_PREFIX);
      this.logger.log('Đã invalidate toàn bộ permission cache');
    } catch (error) {
      this.logger.warn(
        `Lỗi khi invalidate toàn bộ permission cache: ${(error as Error).message}`,
      );
    }
  }

  /**
   * Build cache key từ roleId.
   */
  private buildKey(roleId: string): string {
    return `${this.KEY_PREFIX}${roleId}`;
  }
}
