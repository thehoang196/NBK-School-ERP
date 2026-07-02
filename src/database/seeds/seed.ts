import { DataSource } from 'typeorm';
import * as bcrypt from 'bcrypt';
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
import { TeachingAssignmentEntity } from '../../modules/teaching-assignment/entities/teaching-assignment.entity';
import { seedTimetable } from './timetable.seed';
import { seedTeachingAssignments } from './teaching-assignment.seed';

const dataSource = new DataSource({
  type: 'postgres',
  host: process.env['DB_HOST'] || 'localhost',
  port: parseInt(process.env['DB_PORT'] || '5432'),
  username: process.env['DB_USERNAME'] || 'postgres',
  password: process.env['DB_PASSWORD'] || 'postgres',
  database: process.env['DB_DATABASE'] || 'stms',
  entities: [
    UserEntity,
    SchoolEntity,
    CampusEntity,
    AcademicYearEntity,
    SemesterEntity,
    SessionEntity,
    PeriodDefinitionEntity,
    GradeEntity,
    ClassEntity,
    TeacherEntity,
    SubjectEntity,
    RoomEntity,
    TimetableVersionEntity,
    TimetableSlotEntity,
    TeachingAssignmentEntity,
  ],
  synchronize: false,
});

async function seed(): Promise<void> {
  await dataSource.initialize();
  console.log('🌱 Seeding database...');

  const schoolRepo = dataSource.getRepository(SchoolEntity);
  const campusRepo = dataSource.getRepository(CampusEntity);
  const userRepo = dataSource.getRepository(UserEntity);

  // --- Schools (idempotent: check before inserting) ---
  let parentSchool = await schoolRepo.findOne({ where: { code: 'NBK' } });
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

  let childSchool = await schoolRepo.findOne({ where: { code: 'TH01' } });
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

  // --- Campuses (idempotent) ---
  const existingCampus1 = await campusRepo.findOne({ where: { code: 'CS01-TH01' } });
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

  const existingCampus2 = await campusRepo.findOne({ where: { code: 'CS02-TH01' } });
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

  // --- Users (idempotent: check by email before inserting) ---
  const hashedPassword = await bcrypt.hash('password123', 10);

  const existingSuperAdmin = await userRepo.findOne({ where: { email: 'admin@stms.vn' } });
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

  const existingSchoolAdmin = await userRepo.findOne({ where: { email: 'admin.th01@stms.vn' } });
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

  const existingTeacher = await userRepo.findOne({ where: { email: 'teacher.th01@stms.vn' } });
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

  // Seed timetable data
  await seedTimetable(dataSource);

  // Seed teaching assignment data
  await seedTeachingAssignments(dataSource);

  console.log('🎉 Seed completed!');

  await dataSource.destroy();
}

seed().catch((error) => {
  console.error('❌ Seed failed:', error);
  process.exit(1);
});
