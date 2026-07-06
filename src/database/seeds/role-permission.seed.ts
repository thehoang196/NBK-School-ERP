import { DataSource } from 'typeorm';
import { UserRole } from '../../common/enums/role.enum';
import { Permission, ROLE_PERMISSIONS } from '../../common/enums/permission.enum';

/**
 * Seed Role & Permission defaults.
 * Idempotent — an toàn khi chạy nhiều lần.
 *
 * Lưu ý: Hiện tại role/permission dùng enum-based (ROLE_PERMISSIONS mapping).
 * Seed này tạo bảng reference (nếu tương lai migrate sang dynamic permission table).
 * Tạm thời: log danh sách roles + permissions mặc định để verify.
 */
export async function seedRolePermissions(dataSource: DataSource): Promise<void> {
  console.log('🔐 Seeding Role & Permission defaults...');

  const roles = Object.values(UserRole);
  console.log(`  Roles: ${roles.join(', ')}`);

  for (const role of roles) {
    const permissions = ROLE_PERMISSIONS[role] || [];
    console.log(`  ${role}: ${permissions.length} permissions`);
  }

  const allPermissions = Object.values(Permission);
  console.log(`  Total permissions defined: ${allPermissions.length}`);

  // Future: insert into permissions table if dynamic RBAC is needed
  // For now, ROLE_PERMISSIONS enum mapping is sufficient

  console.log('✅ Role & Permission seed complete');
}
