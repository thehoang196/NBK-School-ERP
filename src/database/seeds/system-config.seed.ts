import { DataSource } from 'typeorm';
import * as argon2 from 'argon2';
import { UserEntity } from '../../modules/auth/entities/user.entity';
import { SchoolEntity } from '../../modules/school/entities/school.entity';
import { CampusEntity } from '../../modules/school/entities/campus.entity';
import { UserRole } from '../../common/enums/role.enum';
import { SchoolStatus, CampusStatus } from '../../common/enums/status.enum';

/**
 * System Configuration Seed — Khởi tạo dữ liệu hệ thống mặc định.
 *
 * Tạo:
 * - 1 Organization (parent school): Hệ thống Giáo dục NBK
 * - 2 Child schools: Tiểu học + THCS
 * - 3 Campuses
 * - 6 Users (1 per role)
 *
 * Idempotent — an toàn khi chạy nhiều lần.
 * Password mặc định: lấy từ env SEED_DEFAULT_PASSWORD hoặc 'Nbk@2024!'
 */
export async function seedSystemConfig(
  dataSource: DataSource,
): Promise<void> {
  console.log('⚙️  Seeding system configuration...');

  const schoolRepo = dataSource.getRepository(SchoolEntity);
  const campusRepo = dataSource.getRepository(CampusEntity);
  const userRepo = dataSource.getRepository(UserEntity);

  const defaultPassword =
    process.env['SEED_DEFAULT_PASSWORD'] || 'Nbk@2024!';
  const hashedPassword = await argon2.hash(defaultPassword, {
    type: argon2.argon2id,
    memoryCost: 65536,
    timeCost: 3,
    parallelism: 4,
  });

  // ─── Organization (Parent School) ──────────────────────────────────────

  let orgSchool = await schoolRepo
    .createQueryBuilder('school')
    .withDeleted()
    .where('school.code = :code', { code: 'NBK-ORG' })
    .getOne();
  if (!orgSchool) {
    orgSchool = await schoolRepo.save({
      code: 'NBK-ORG',
      name: 'Hệ thống Giáo dục Chất lượng cao Nguyễn Bỉnh Khiêm - Cầu Giấy',
      address: '2 Trần Quý Kiên, Dịch Vọng, Cầu Giấy, Hà Nội',
      phone: '02437911586',
      email: 'info@nbk.edu.vn',
      principalName: 'Ban Giám đốc',
      parentSchoolId: null,
      status: SchoolStatus.ACTIVE,
    });
    console.log('  ✅ Organization created:', orgSchool.code);
  } else {
    console.log('  ⏭️  Organization exists:', orgSchool.code);
  }

  // ─── Child Schools ─────────────────────────────────────────────────────

  let schoolTH = await schoolRepo
    .createQueryBuilder('school')
    .withDeleted()
    .where('school.code = :code', { code: 'NBK-TH' })
    .getOne();
  if (!schoolTH) {
    schoolTH = await schoolRepo.save({
      code: 'NBK-TH',
      name: 'Trường Tiểu học NBK - Cầu Giấy',
      address: '2 Trần Quý Kiên, Dịch Vọng, Cầu Giấy, Hà Nội',
      phone: '02437911586',
      email: 'tieuhoc@nbk.edu.vn',
      principalName: 'Hiệu trưởng TH',
      parentSchoolId: orgSchool.id,
      status: SchoolStatus.ACTIVE,
    });
    console.log('  ✅ School TH created:', schoolTH.code);
  } else {
    console.log('  ⏭️  School TH exists:', schoolTH.code);
  }

  let schoolTHCS = await schoolRepo
    .createQueryBuilder('school')
    .withDeleted()
    .where('school.code = :code', { code: 'NBK-THCS' })
    .getOne();
  if (!schoolTHCS) {
    schoolTHCS = await schoolRepo.save({
      code: 'NBK-THCS',
      name: 'Trường THCS NBK - Cầu Giấy',
      address: '2 Trần Quý Kiên, Dịch Vọng, Cầu Giấy, Hà Nội',
      phone: '02437911587',
      email: 'thcs@nbk.edu.vn',
      principalName: 'Hiệu trưởng THCS',
      parentSchoolId: orgSchool.id,
      status: SchoolStatus.ACTIVE,
    });
    console.log('  ✅ School THCS created:', schoolTHCS.code);
  } else {
    console.log('  ⏭️  School THCS exists:', schoolTHCS.code);
  }

  // ─── Campuses ──────────────────────────────────────────────────────────

  const campuses = [
    {
      code: 'NBK-TH-CS1',
      name: 'Cơ sở 1 - Tiểu học',
      address: '2 Trần Quý Kiên, Dịch Vọng',
      schoolId: schoolTH.id,
    },
    {
      code: 'NBK-TH-CS2',
      name: 'Cơ sở 2 - Tiểu học',
      address: '10 Nguyễn Quốc Trị, Trung Hòa',
      schoolId: schoolTH.id,
    },
    {
      code: 'NBK-THCS-CS1',
      name: 'Cơ sở 1 - THCS',
      address: '2 Trần Quý Kiên, Dịch Vọng',
      schoolId: schoolTHCS.id,
    },
  ];

  for (const c of campuses) {
    const existing = await campusRepo
      .createQueryBuilder('campus')
      .withDeleted()
      .where('campus.code = :code', { code: c.code })
      .getOne();
    if (!existing) {
      await campusRepo.save({ ...c, status: CampusStatus.ACTIVE });
      console.log(`  ✅ Campus created: ${c.code}`);
    } else {
      console.log(`  ⏭️  Campus exists: ${c.code}`);
    }
  }

  // ─── Users (1 per role) ────────────────────────────────────────────────

  const users = [
    {
      name: 'Super Admin NBK',
      email: 'superadmin@nbk.edu.vn',
      role: UserRole.SUPER_ADMIN,
      schoolId: null,
    },
    {
      name: 'Admin TH NBK',
      email: 'admin.th@nbk.edu.vn',
      role: UserRole.SCHOOL_ADMIN,
      schoolId: schoolTH.id,
    },
    {
      name: 'Admin THCS NBK',
      email: 'admin.thcs@nbk.edu.vn',
      role: UserRole.SCHOOL_ADMIN,
      schoolId: schoolTHCS.id,
    },
    {
      name: 'HR NBK',
      email: 'hr@nbk.edu.vn',
      role: UserRole.HR,
      schoolId: schoolTH.id,
    },
    {
      name: 'Lập TKB NBK',
      email: 'scheduler@nbk.edu.vn',
      role: UserRole.SCHEDULER,
      schoolId: schoolTH.id,
    },
    {
      name: 'GV Nguyễn Văn A',
      email: 'teacher@nbk.edu.vn',
      role: UserRole.TEACHER,
      schoolId: schoolTH.id,
    },
  ];

  for (const u of users) {
    const existing = await userRepo
      .createQueryBuilder('user')
      .withDeleted()
      .where('user.email = :email', { email: u.email })
      .getOne();
    if (!existing) {
      try {
        await userRepo.save({
          ...u,
          password: hashedPassword,
          isActive: true,
        });
        console.log(`  ✅ User created: ${u.email} (${u.role})`);
      } catch (error: any) {
        console.log(`  ⚠️  User skipped: ${u.email} (${u.role}) — ${error.message || error.driverError?.message || 'unknown error'}`);
      }
    } else {
      console.log(`  ⏭️  User exists: ${u.email}`);
    }
  }

  console.log('✅ System configuration seed complete');
  console.log(
    `   Default password: ${defaultPassword} (override with SEED_DEFAULT_PASSWORD env)`,
  );
}
