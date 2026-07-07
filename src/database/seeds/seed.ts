import { DataSource } from 'typeorm';
import * as argon2 from 'argon2';
import { UserEntity } from '../../modules/auth/entities/user.entity';
import { SchoolEntity } from '../../modules/school/entities/school.entity';
import { CampusEntity } from '../../modules/school/entities/campus.entity';
import { UserRole } from '../../common/enums/role.enum';
import { SchoolStatus, CampusStatus } from '../../common/enums/status.enum';
import { AcademicYearEntity } from '../../modules/academic/entities/academic-year.entity';
import { SemesterEntity } from '../../modules/academic/entities/semester.entity';
import { SessionEntity } from '../../modules/academic/entities/session.entity';
import { PeriodDefinitionEntity } from '../../modules/academic/entities/period-definition.entity';
import { GradeEntity } from '../../modules/class/entities/grade.entity';
import { ClassEntity } from '../../modules/class/entities/class.entity';
import { TeacherEntity } from '../../modules/teacher/entities/teacher.entity';
import { SubjectEntity } from '../../modules/subject/entities/subject.entity';
import { RoomEntity } from '../../modules/room/entities/room.entity';
import { TimetableVersionEntity } from '../../modules/timetable/entities/timetable-version.entity';
import { TimetableSlotEntity } from '../../modules/timetable/entities/timetable-slot.entity';
import { TimetableConstraintEntity } from '../../modules/timetable/entities/timetable-constraint.entity';
import { ConflictLogEntity } from '../../modules/timetable/entities/conflict-log.entity';
import { ActualTimetableSlotEntity } from '../../modules/timetable/entities/actual-timetable-slot.entity';
import { TeachingAssignmentEntity } from '../../modules/teaching-assignment/entities/teaching-assignment.entity';
import { WeekEntity } from '../../modules/academic/entities/week.entity';
import { CampusGradeLevelEntity } from '../../modules/academic/entities/campus-grade-level.entity';
import { SubjectGroupEntity } from '../../modules/subject/entities/subject-group.entity';
import { SubjectGradeEntity } from '../../modules/subject/entities/subject-grade.entity';
import { TeacherSubjectEntity } from '../../modules/teacher/entities/teacher-subject.entity';
import { DepartmentEntity } from '../../modules/department/entities/department.entity';
import { DepartmentMemberEntity } from '../../modules/department/entities/department-member.entity';
import { EventEntity } from '../../modules/event/entities/event.entity';
import { LeaveRequestEntity } from '../../modules/leave-request/entities/leave-request.entity';
import { PeriodSwapEntity } from '../../modules/period-swap/entities/period-swap.entity';
import { TeacherSchoolAssignmentEntity } from '../../modules/teacher-school-assignment/entities/teacher-school-assignment.entity';
import { CurriculumPlanEntity } from '../../modules/curriculum/entities/curriculum-plan.entity';
import { CurriculumPlanItemEntity } from '../../modules/curriculum/entities/curriculum-plan-item.entity';
import { ValidationRuleEntity } from '../../modules/validation-rules/entities/validation-rule.entity';
import { ImportBatchEntity } from '../../modules/import-export/entities/import-batch.entity';
import { ExportTemplateEntity } from '../../modules/import-export/entities/export-template.entity';
import { AttendanceRecordEntity } from '../../modules/attendance/entities/attendance-record.entity';
import { AttendanceSummaryEntity } from '../../modules/attendance/entities/attendance-summary.entity';
import { EmployeeMasterEntity } from '../../modules/master-data/entities/employee-master.entity';
import { FieldDefinitionEntity } from '../../modules/master-data/entities/field-definition.entity';
import { JobRecordEntity } from '../../modules/jobs/entities/job-record.entity';
import { FeatureFlagEntity } from '../../modules/feature-flag/entities/feature-flag.entity';
import { AuditLogEntity } from '../../modules/audit/entities/audit-log.entity';
import { seedTimetable } from './timetable.seed';
import { seedTeachingAssignments } from './teaching-assignment.seed';
import { seedRolePermissions } from './role-permission.seed';
import { seedSystemConfig } from './system-config.seed';
import { seedComprehensive } from './comprehensive-seed';
import { seedCompensation } from './compensation.seed';
import { seedCompensationNbkDefaults } from './compensation-nbk-defaults.seed';

const databaseUrl = process.env['DATABASE_URL'];

const dataSource = new DataSource(
  databaseUrl
    ? {
        type: 'postgres',
        url: databaseUrl,
        ssl: { rejectUnauthorized: false },
        entities: [
          UserEntity,
          SchoolEntity,
          CampusEntity,
          AcademicYearEntity,
          SemesterEntity,
          SessionEntity,
          PeriodDefinitionEntity,
          WeekEntity,
          CampusGradeLevelEntity,
          GradeEntity,
          ClassEntity,
          TeacherEntity,
          TeacherSubjectEntity,
          SubjectEntity,
          SubjectGroupEntity,
          SubjectGradeEntity,
          RoomEntity,
          DepartmentEntity,
          DepartmentMemberEntity,
          TimetableVersionEntity,
          TimetableSlotEntity,
          TimetableConstraintEntity,
          ConflictLogEntity,
          ActualTimetableSlotEntity,
          TeachingAssignmentEntity,
          TeacherSchoolAssignmentEntity,
          EventEntity,
          LeaveRequestEntity,
          PeriodSwapEntity,
          CurriculumPlanEntity,
          CurriculumPlanItemEntity,
          ValidationRuleEntity,
          ImportBatchEntity,
          ExportTemplateEntity,
          AttendanceRecordEntity,
          AttendanceSummaryEntity,
          EmployeeMasterEntity,
          FieldDefinitionEntity,
          JobRecordEntity,
          FeatureFlagEntity,
          AuditLogEntity,
        ],
        synchronize: false,
      }
    : {
        type: 'postgres',
        host: process.env['DB_HOST'] || 'localhost',
        port: parseInt(process.env['DB_PORT'] || '5432'),
        username: process.env['DB_USERNAME'] || 'postgres',
        password: process.env['DB_PASSWORD'] || 'postgres',
        database: process.env['DB_DATABASE'] || 'stms',
        ssl:
          process.env['DB_SSL'] === 'true'
            ? { rejectUnauthorized: false }
            : false,
        entities: [
          UserEntity,
          SchoolEntity,
          CampusEntity,
          AcademicYearEntity,
          SemesterEntity,
          SessionEntity,
          PeriodDefinitionEntity,
          WeekEntity,
          CampusGradeLevelEntity,
          GradeEntity,
          ClassEntity,
          TeacherEntity,
          TeacherSubjectEntity,
          SubjectEntity,
          SubjectGroupEntity,
          SubjectGradeEntity,
          RoomEntity,
          DepartmentEntity,
          DepartmentMemberEntity,
          TimetableVersionEntity,
          TimetableSlotEntity,
          TimetableConstraintEntity,
          ConflictLogEntity,
          ActualTimetableSlotEntity,
          TeachingAssignmentEntity,
          TeacherSchoolAssignmentEntity,
          EventEntity,
          LeaveRequestEntity,
          PeriodSwapEntity,
          CurriculumPlanEntity,
          CurriculumPlanItemEntity,
          ValidationRuleEntity,
          ImportBatchEntity,
          ExportTemplateEntity,
          AttendanceRecordEntity,
          AttendanceSummaryEntity,
          EmployeeMasterEntity,
          FieldDefinitionEntity,
          JobRecordEntity,
          FeatureFlagEntity,
          AuditLogEntity,
        ],
        synchronize: false,
      },
);

async function seed(): Promise<void> {
  await dataSource.initialize();
  console.log('🌱 Seeding database...');

  const schoolRepo = dataSource.getRepository(SchoolEntity);
  const campusRepo = dataSource.getRepository(CampusEntity);
  const userRepo = dataSource.getRepository(UserEntity);

  // --- Schools (idempotent: check before inserting, including soft-deleted) ---
  let parentSchool = await schoolRepo
    .createQueryBuilder('school')
    .withDeleted()
    .where('school.code = :code', { code: 'NBK' })
    .getOne();
  if (!parentSchool) {
    parentSchool = await schoolRepo.save({
      code: 'NBK',
      name: 'Hệ thống Giáo dục NBK',
      address: '100 Nguyễn Du, Quận 1, TP.HCM',
      phone: '02838100000',
      email: 'contact@nbk.edu.vn',
      principalName: 'Nguyễn Bá Khanh',
      parentSchoolId: null,
      status: SchoolStatus.ACTIVE,
    });
    console.log('✅ Parent school created:', parentSchool.code);
  } else {
    console.log('⏭️  Parent school already exists:', parentSchool.code);
  }

  let childSchool = await schoolRepo
    .createQueryBuilder('school')
    .withDeleted()
    .where('school.code = :code', { code: 'TH01' })
    .getOne();
  if (!childSchool) {
    childSchool = await schoolRepo.save({
      code: 'TH01',
      name: 'THPT Nguyễn Huệ',
      address: '123 Đường Nguyễn Huệ, Quận 1, TP.HCM',
      phone: '02838123456',
      email: 'contact@nguyenhue.edu.vn',
      principalName: 'Nguyễn Văn A',
      parentSchoolId: parentSchool.id,
      status: SchoolStatus.ACTIVE,
    });
    console.log('✅ Child school created:', childSchool.code);
  } else {
    console.log('⏭️  Child school already exists:', childSchool.code);
  }

  // --- Campuses (idempotent, including soft-deleted) ---
  const existingCampus1 = await campusRepo
    .createQueryBuilder('campus')
    .withDeleted()
    .where('campus.code = :code', { code: 'CS01-TH01' })
    .getOne();
  if (!existingCampus1) {
    await campusRepo.save({
      code: 'CS01-TH01',
      name: 'Cơ sở 1 - Nguyễn Huệ',
      address: '123 Đường Nguyễn Huệ, Quận 1, TP.HCM',
      schoolId: childSchool.id,
      status: CampusStatus.ACTIVE,
    });
    console.log('✅ Campus CS01-TH01 created');
  } else {
    console.log('⏭️  Campus CS01-TH01 already exists');
  }

  const existingCampus2 = await campusRepo
    .createQueryBuilder('campus')
    .withDeleted()
    .where('campus.code = :code', { code: 'CS02-TH01' })
    .getOne();
  if (!existingCampus2) {
    await campusRepo.save({
      code: 'CS02-TH01',
      name: 'Cơ sở 2 - Nguyễn Huệ',
      address: '789 Trần Hưng Đạo, Quận 5, TP.HCM',
      schoolId: childSchool.id,
      status: CampusStatus.ACTIVE,
    });
    console.log('✅ Campus CS02-TH01 created');
  } else {
    console.log('⏭️  Campus CS02-TH01 already exists');
  }

  // --- Users (idempotent: check by email, including soft-deleted) ---
  const hashedPassword = await argon2.hash('password123', {
    type: argon2.argon2id,
    memoryCost: 65536,
    timeCost: 3,
    parallelism: 4,
  });

  const existingSuperAdmin = await userRepo
    .createQueryBuilder('user')
    .withDeleted()
    .where('user.email = :email', { email: 'admin@stms.vn' })
    .getOne();
  if (!existingSuperAdmin) {
    await userRepo.save({
      name: 'Super Admin',
      email: 'admin@stms.vn',
      password: hashedPassword,
      role: UserRole.SUPER_ADMIN,
      schoolId: null,
      isActive: true,
    });
    console.log('✅ Super Admin user created');
  } else {
    console.log('⏭️  Super Admin user already exists');
  }

  const existingSchoolAdmin = await userRepo
    .createQueryBuilder('user')
    .withDeleted()
    .where('user.email = :email', { email: 'admin.th01@stms.vn' })
    .getOne();
  if (!existingSchoolAdmin) {
    await userRepo.save({
      name: 'Admin Trường Nguyễn Huệ',
      email: 'admin.th01@stms.vn',
      password: hashedPassword,
      role: UserRole.SCHOOL_ADMIN,
      schoolId: childSchool.id,
      isActive: true,
    });
    console.log('✅ School Admin user created');
  } else {
    console.log('⏭️  School Admin user already exists');
  }

  const existingTeacher = await userRepo
    .createQueryBuilder('user')
    .withDeleted()
    .where('user.email = :email', { email: 'teacher.th01@stms.vn' })
    .getOne();
  if (!existingTeacher) {
    await userRepo.save({
      name: 'GV Trần Thị B',
      email: 'teacher.th01@stms.vn',
      password: hashedPassword,
      role: UserRole.TEACHER,
      schoolId: childSchool.id,
      isActive: true,
    });
    console.log('✅ Teacher user created');
  } else {
    console.log('⏭️  Teacher user already exists');
  }

  console.log('✅ Schools & Users seed completed');

  // Seed role/permission defaults
  await seedRolePermissions(dataSource);

  // Seed system config (NBK-specific schools, campuses, users)
  await seedSystemConfig(dataSource);

  // Seed timetable data
  try {
    await seedTimetable(dataSource);
  } catch (error: any) {
    console.log(`⚠️  Timetable seed skipped: ${error.message || 'schema mismatch — run migrations first'}`);
  }

  // Seed teaching assignment data
  try {
    await seedTeachingAssignments(dataSource);
  } catch (error: any) {
    console.log(`⚠️  Teaching assignment seed skipped: ${error.message || 'schema mismatch — run migrations first'}`);
  }

  // Seed comprehensive test data for all modules
  try {
    await seedComprehensive(dataSource);
  } catch (error: any) {
    console.log(`⚠️  Comprehensive seed skipped: ${error.message || 'schema mismatch — run migrations first'}`);
  }

  // Seed compensation data
  try {
    await seedCompensation(dataSource);
  } catch (error: any) {
    console.log(`⚠️  Compensation seed skipped: ${error.message || 'schema mismatch — run migrations first'}`);
  }

  // Seed NBK compensation defaults (pay components, variables, formulas, rules)
  try {
    await seedCompensationNbkDefaults(dataSource);
  } catch (error: any) {
    console.log(`⚠️  NBK Compensation defaults seed skipped: ${error.message || 'schema mismatch — run migrations first'}`);
  }

  console.log('🎉 Seed completed!');

  await dataSource.destroy();
}

seed().catch((error) => {
  console.error('❌ Seed failed:', error);
  process.exit(1);
});
