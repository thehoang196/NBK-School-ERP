import { DataSource } from 'typeorm';
import { SchoolEntity } from '../../modules/school/entities/school.entity';
import { CampusEntity } from '../../modules/school/entities/campus.entity';
import { AcademicYearEntity } from '../../modules/academic/entities/academic-year.entity';
import { SemesterEntity } from '../../modules/academic/entities/semester.entity';
import { WeekEntity } from '../../modules/academic/entities/week.entity';
import { SessionEntity } from '../../modules/academic/entities/session.entity';
import { PeriodDefinitionEntity } from '../../modules/academic/entities/period-definition.entity';
import { CampusGradeLevelEntity } from '../../modules/academic/entities/campus-grade-level.entity';
import { GradeEntity } from '../../modules/class/entities/grade.entity';
import { ClassEntity } from '../../modules/class/entities/class.entity';
import { TeacherEntity } from '../../modules/teacher/entities/teacher.entity';
import { SubjectEntity } from '../../modules/subject/entities/subject.entity';
import { SubjectGroupEntity } from '../../modules/subject/entities/subject-group.entity';
import { SubjectGradeEntity } from '../../modules/subject/entities/subject-grade.entity';
import { RoomEntity } from '../../modules/room/entities/room.entity';
import { DepartmentEntity } from '../../modules/department/entities/department.entity';
import { DepartmentMemberEntity } from '../../modules/department/entities/department-member.entity';
import { TeacherSubjectEntity } from '../../modules/teacher/entities/teacher-subject.entity';
import { EventEntity } from '../../modules/event/entities/event.entity';
import { LeaveRequestEntity } from '../../modules/leave-request/entities/leave-request.entity';
import { PeriodSwapEntity } from '../../modules/period-swap/entities/period-swap.entity';
import { TeacherSchoolAssignmentEntity } from '../../modules/teacher-school-assignment/entities/teacher-school-assignment.entity';
import { CurriculumPlanEntity } from '../../modules/curriculum/entities/curriculum-plan.entity';
import { CurriculumPlanItemEntity } from '../../modules/curriculum/entities/curriculum-plan-item.entity';
import { TimetableConstraintEntity } from '../../modules/timetable/entities/timetable-constraint.entity';
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
import { UserEntity } from '../../modules/auth/entities/user.entity';

// Enums
import {
  AcademicStatus, EntityStatus, TeacherStatus, TeacherType, Gender,
  SubjectType, RoomType, RoomStatus, TimetableVersionStatus, SlotStatus,
} from '../../common/enums/status.enum';
import { WeekType } from '../../modules/academic/enums';
import { GradeLevel } from '../../modules/academic/enums';
import { EventType, EventStatus } from '../../modules/event/entities/event.entity';
import { LeaveRequestType, LeaveRequestStatus } from '../../modules/leave-request/enums';
import { PeriodSwapStatus } from '../../modules/period-swap/enums';
import { AssignmentRole } from '../../modules/teacher-school-assignment/enums/assignment-role.enum';
import { AssignmentStatus } from '../../modules/teacher-school-assignment/enums/assignment-status.enum';
import { CurriculumPlanStatus } from '../../modules/curriculum/entities/curriculum-plan.entity';
import { ConstraintType, ConstraintEntityType, ConstraintPriority } from '../../modules/timetable/entities/timetable-constraint.entity';
import { ValidationRuleType, ValidationEntityTarget } from '../../modules/validation-rules/entities/validation-rule.entity';
import { ImportBatchStatus, ImportEntityType } from '../../modules/import-export/entities/import-batch.entity';
import { ExportEntityTarget } from '../../modules/import-export/entities/export-template.entity';
import { AttendanceStatus, AttendanceMethod, LeaveType } from '../../modules/attendance/enums';
import { FieldDataType } from '../../modules/master-data/enums/master-data.enum';
import { JobStatus, JobType } from '../../modules/jobs/entities/job-record.entity';
import { AuditAction } from '../../modules/audit/entities/audit-log.entity';
import { ProficiencyLevel } from '../../modules/teacher/entities/teacher-subject.entity';
import { PositionTitle, ManagementLevel } from '../../modules/department/enums';

/**
 * Comprehensive Seed Data - Bổ sung đầy đủ dữ liệu test cho tất cả module.
 *
 * Ngày tháng hiển thị: dd/mm/yyyy (ví dụ: 05/09/2024)
 * Ngày tháng lưu DB: yyyy-mm-dd (ISO format cho PostgreSQL)
 *
 * ╔══════════════════════════════════════════════════════════════╗
 * ║  IDEMPOTENT & NON-DESTRUCTIVE                               ║
 * ║  - Mọi record đều kiểm tra tồn tại trước khi insert.       ║
 * ║  - KHÔNG xóa, KHÔNG ghi đè dữ liệu có sẵn.                ║
 * ║  - Nếu dữ liệu trùng lặp → bỏ qua (skip), giữ nguyên.    ║
 * ║  - Check bằng unique key: code, name, email, hoặc FK combo.║
 * ║  - Scope theo schoolId để tránh ảnh hưởng trường khác.     ║
 * ║  - An toàn khi chạy lại nhiều lần (app restart).           ║
 * ╚══════════════════════════════════════════════════════════════╝
 *
 * Dữ liệu dựa trên trường NBK-TH (Tiểu học NBK - Cầu Giấy).
 */
export async function seedComprehensive(dataSource: DataSource): Promise<void> {
  console.log('🌐 Seeding comprehensive test data...');

  /**
   * Helper: chạy từng section an toàn.
   * Nếu section lỗi (schema thiếu, constraint...) → log warning, tiếp tục section khác.
   * KHÔNG bao giờ xóa dữ liệu.
   */
  async function safeRun(sectionName: string, fn: () => Promise<void>): Promise<boolean> {
    try {
      await fn();
      return true;
    } catch (error: any) {
      console.log(`  ⚠️  [${sectionName}] skipped: ${error.message || error}`);
      return false;
    }
  }

  // ═══════════════════════════════════════════════
  // PREREQUISITES: Lấy dữ liệu đã seed trước đó
  // ═══════════════════════════════════════════════
  const schoolRepo = dataSource.getRepository(SchoolEntity);
  const school = await schoolRepo
    .createQueryBuilder('school')
    .withDeleted()
    .where('school.code = :code', { code: 'NBK-TH' })
    .getOne();
  if (!school) {
    console.log('⚠️  School NBK-TH not found. Run system-config seed first.');
    return;
  }
  const schoolId = school.id;

  const campusRepo = dataSource.getRepository(CampusEntity);
  const campus = await campusRepo
    .createQueryBuilder('campus')
    .withDeleted()
    .where('campus.code = :code', { code: 'NBK-TH-CS1' })
    .getOne();
  if (!campus) {
    console.log('⚠️  Campus NBK-TH-CS1 not found. Run system-config seed first.');
    return;
  }

  const userRepo = dataSource.getRepository(UserEntity);
  const adminUser = await userRepo
    .createQueryBuilder('user')
    .withDeleted()
    .where('user.email = :email', { email: 'admin.th@nbk.edu.vn' })
    .getOne();
  const schedulerUser = await userRepo
    .createQueryBuilder('user')
    .withDeleted()
    .where('user.email = :email', { email: 'scheduler@nbk.edu.vn' })
    .getOne();
  const adminUserId = adminUser?.id || null;
  const schedulerUserId = schedulerUser?.id || null;

  // ═══════════════════════════════════════════════
  // 1. ACADEMIC: Năm học, học kỳ, tuần, ca, tiết
  // ═══════════════════════════════════════════════
  console.log('📅 Seeding Academic data...');

  const academicYearRepo = dataSource.getRepository(AcademicYearEntity);
  let academicYear = await academicYearRepo.findOne({
    where: { schoolId, name: 'Năm học 2025-2026' },
  });
  if (!academicYear) {
    academicYear = await academicYearRepo.save({
      schoolId,
      name: 'Năm học 2025-2026',
      startDate: '2025-09-01', // 01/09/2025
      endDate: '2026-05-31',   // 31/05/2026
      isCurrent: true,
      status: AcademicStatus.ACTIVE,
    });
    console.log('  ✅ Academic year 2025-2026 created');
  }

  const semesterRepo = dataSource.getRepository(SemesterEntity);
  let semester1 = await semesterRepo.findOne({
    where: { academicYearId: academicYear.id, semesterNumber: 1 },
  });
  if (!semester1) {
    semester1 = await semesterRepo.save({
      academicYearId: academicYear.id,
      name: 'Học kỳ 1 (2025-2026)',
      semesterNumber: 1,
      startDate: '2025-09-01', // 01/09/2025
      endDate: '2026-01-16',   // 16/01/2026
      status: AcademicStatus.ACTIVE,
    });
    console.log('  ✅ Semester 1 created');
  }

  let semester2 = await semesterRepo.findOne({
    where: { academicYearId: academicYear.id, semesterNumber: 2 },
  });
  if (!semester2) {
    semester2 = await semesterRepo.save({
      academicYearId: academicYear.id,
      name: 'Học kỳ 2 (2025-2026)',
      semesterNumber: 2,
      startDate: '2026-02-09', // 09/02/2026
      endDate: '2026-05-31',   // 31/05/2026
      status: AcademicStatus.PLANNING,
    });
    console.log('  ✅ Semester 2 created');
  }

  // Weeks (18 tuần HK1)
  const weekRepo = dataSource.getRepository(WeekEntity);
  const existingWeeks = await weekRepo.count({ where: { schoolId, semesterId: semester1.id } });
  if (existingWeeks === 0) {
    const weeksData = [
      { weekNumber: 1, startDate: '2025-09-01', endDate: '2025-09-06', weekType: WeekType.REGULAR, note: 'Tuần 1 - Khai giảng 01/09/2025' },
      { weekNumber: 2, startDate: '2025-09-08', endDate: '2025-09-13', weekType: WeekType.REGULAR, note: null },
      { weekNumber: 3, startDate: '2025-09-15', endDate: '2025-09-20', weekType: WeekType.REGULAR, note: null },
      { weekNumber: 4, startDate: '2025-09-22', endDate: '2025-09-27', weekType: WeekType.REGULAR, note: null },
      { weekNumber: 5, startDate: '2025-09-29', endDate: '2025-10-04', weekType: WeekType.REGULAR, note: 'Nghỉ 02/10' },
      { weekNumber: 6, startDate: '2025-10-06', endDate: '2025-10-11', weekType: WeekType.REGULAR, note: null },
      { weekNumber: 7, startDate: '2025-10-13', endDate: '2025-10-18', weekType: WeekType.REGULAR, note: 'Thi giữa kỳ' },
      { weekNumber: 8, startDate: '2025-10-20', endDate: '2025-10-25', weekType: WeekType.EXAM, note: 'Tuần kiểm tra giữa kỳ 20/10-25/10/2025' },
      { weekNumber: 9, startDate: '2025-10-27', endDate: '2025-11-01', weekType: WeekType.REGULAR, note: null },
      { weekNumber: 10, startDate: '2025-11-03', endDate: '2025-11-08', weekType: WeekType.REGULAR, note: null },
      { weekNumber: 11, startDate: '2025-11-10', endDate: '2025-11-15', weekType: WeekType.REGULAR, note: 'Ngày Nhà giáo 20/11' },
      { weekNumber: 12, startDate: '2025-11-17', endDate: '2025-11-22', weekType: WeekType.REGULAR, note: null },
      { weekNumber: 13, startDate: '2025-11-24', endDate: '2025-11-29', weekType: WeekType.REGULAR, note: null },
      { weekNumber: 14, startDate: '2025-12-01', endDate: '2025-12-06', weekType: WeekType.REGULAR, note: null },
      { weekNumber: 15, startDate: '2025-12-08', endDate: '2025-12-13', weekType: WeekType.REGULAR, note: null },
      { weekNumber: 16, startDate: '2025-12-15', endDate: '2025-12-20', weekType: WeekType.REGULAR, note: 'Ôn thi cuối kỳ' },
      { weekNumber: 17, startDate: '2026-01-05', endDate: '2026-01-10', weekType: WeekType.EXAM, note: 'Thi cuối kỳ 1 (05/01-10/01/2026)' },
      { weekNumber: 18, startDate: '2026-01-12', endDate: '2026-01-16', weekType: WeekType.REGULAR, note: 'Tổng kết HK1' },
    ];
    for (const w of weeksData) {
      await weekRepo.save({
        schoolId,
        semesterId: semester1.id,
        ...w,
        isHoliday: w.weekType === WeekType.HOLIDAY,
      });
    }
    console.log('  ✅ 18 weeks created for semester 1');
  }

  // Sessions (Ca học)
  const sessionRepo = dataSource.getRepository(SessionEntity);
  let sessionSang = await sessionRepo.findOne({ where: { schoolId, name: 'Ca sáng' } });
  if (!sessionSang) {
    sessionSang = await sessionRepo.save({
      schoolId, campusId: campus.id, gradeLevel: GradeLevel.PRIMARY,
      name: 'Ca sáng', startTime: '07:15', endTime: '11:45', sortOrder: 1,
    });
  }
  let sessionChieu = await sessionRepo.findOne({ where: { schoolId, name: 'Ca chiều' } });
  if (!sessionChieu) {
    sessionChieu = await sessionRepo.save({
      schoolId, campusId: campus.id, gradeLevel: GradeLevel.PRIMARY,
      name: 'Ca chiều', startTime: '13:30', endTime: '17:00', sortOrder: 2,
    });
  }

  // Period Definitions (5 tiết sáng + 4 tiết chiều)
  const periodRepo = dataSource.getRepository(PeriodDefinitionEntity);
  const existingPeriods = await periodRepo.count({ where: { schoolId, sessionId: sessionSang.id } });
  if (existingPeriods === 0) {
    const sangPeriods = [
      { periodNumber: 1, startTime: '07:15', endTime: '07:55', isBreak: false, isExtra: false },
      { periodNumber: 2, startTime: '08:00', endTime: '08:40', isBreak: false, isExtra: false },
      { periodNumber: 3, startTime: '08:55', endTime: '09:35', isBreak: false, isExtra: false },
      { periodNumber: 4, startTime: '09:40', endTime: '10:20', isBreak: false, isExtra: false },
      { periodNumber: 5, startTime: '10:35', endTime: '11:15', isBreak: false, isExtra: false },
    ];
    for (const p of sangPeriods) {
      await periodRepo.save({ schoolId, sessionId: sessionSang.id, ...p });
    }
    console.log('  ✅ 5 morning periods created (07:15-11:15)');
  }

  const existingChieuPeriods = await periodRepo.count({ where: { schoolId, sessionId: sessionChieu.id } });
  if (existingChieuPeriods === 0) {
    const chieuPeriods = [
      { periodNumber: 6, startTime: '13:30', endTime: '14:10', isBreak: false, isExtra: false },
      { periodNumber: 7, startTime: '14:15', endTime: '14:55', isBreak: false, isExtra: false },
      { periodNumber: 8, startTime: '15:10', endTime: '15:50', isBreak: false, isExtra: false },
      { periodNumber: 9, startTime: '15:55', endTime: '16:35', isBreak: false, isExtra: false },
    ];
    for (const p of chieuPeriods) {
      await periodRepo.save({ schoolId, sessionId: sessionChieu.id, ...p });
    }
    console.log('  ✅ 4 afternoon periods created (13:30-16:35)');
  }

  // Campus Grade Levels
  const cglRepo = dataSource.getRepository(CampusGradeLevelEntity);
  const existingCGL = await cglRepo.count({ where: { campusId: campus.id } });
  if (existingCGL === 0) {
    await cglRepo.save({ campusId: campus.id, schoolId, gradeLevel: GradeLevel.PRIMARY });
    console.log('  ✅ Campus grade level: PRIMARY for NBK-TH-CS1');
  }

  // ═══════════════════════════════════════════════
  // 2. GRADES & CLASSES (Khối & Lớp)
  // ═══════════════════════════════════════════════
  console.log('🏫 Seeding Grades & Classes...');

  const gradeRepo = dataSource.getRepository(GradeEntity);
  const classRepo = dataSource.getRepository(ClassEntity);

  const gradesData = [
    { name: 'Khối 1', level: 1 },
    { name: 'Khối 2', level: 2 },
    { name: 'Khối 3', level: 3 },
    { name: 'Khối 4', level: 4 },
    { name: 'Khối 5', level: 5 },
  ];

  const grades: GradeEntity[] = [];
  for (const g of gradesData) {
    let grade = await gradeRepo.findOne({ where: { schoolId, name: g.name } });
    if (!grade) {
      grade = await gradeRepo.save({ schoolId, ...g });
    }
    grades.push(grade);
  }
  console.log('  ✅ 5 grades (Khối 1-5) ensured');

  // Tạo lớp: 4 lớp/khối = 20 lớp
  const classesCreated: ClassEntity[] = [];
  for (let gi = 0; gi < grades.length; gi++) {
    const grade = grades[gi];
    for (let ci = 1; ci <= 4; ci++) {
      const className = `${grade.level}A${ci}`;
      let cls = await classRepo.findOne({ where: { schoolId, name: className } });
      if (!cls) {
        cls = await classRepo.save({
          schoolId,
          gradeId: grade.id,
          academicYearId: academicYear.id,
          name: className,
          studentCount: 30 + Math.floor(Math.random() * 10), // 30-39
          status: EntityStatus.ACTIVE,
        });
      }
      classesCreated.push(cls);
    }
  }
  console.log(`  ✅ ${classesCreated.length} classes ensured (1A1-5A4)`);

  // ═══════════════════════════════════════════════
  // 3. SUBJECT GROUPS & SUBJECTS (Nhóm môn & Môn học)
  // ═══════════════════════════════════════════════
  console.log('📚 Seeding Subject Groups & Subjects...');

  const sgRepo = dataSource.getRepository(SubjectGroupEntity);
  const subjectRepo = dataSource.getRepository(SubjectEntity);

  // Subject Groups
  const groupsData = [
    { code: 'KHTN', name: 'Khoa học Tự nhiên', colorCode: '#4CAF50', displayOrder: 1 },
    { code: 'KHXH', name: 'Khoa học Xã hội', colorCode: '#2196F3', displayOrder: 2 },
    { code: 'NN', name: 'Ngoại ngữ', colorCode: '#FF9800', displayOrder: 3 },
    { code: 'NT', name: 'Nghệ thuật & Thể dục', colorCode: '#9C27B0', displayOrder: 4 },
    { code: 'TH', name: 'Tin học & Công nghệ', colorCode: '#607D8B', displayOrder: 5 },
  ];

  const groups: SubjectGroupEntity[] = [];
  for (const g of groupsData) {
    let group = await sgRepo.findOne({ where: { schoolId, code: g.code } });
    if (!group) {
      group = await sgRepo.save({ schoolId, ...g, description: null });
    }
    groups.push(group);
  }
  console.log('  ✅ 5 subject groups created');

  // Subjects (15 môn tiểu học)
  const subjectsData = [
    { code: 'TOAN-TH', name: 'Toán', shortName: 'Toán', subjectType: SubjectType.REQUIRED, periodsPerWeek: 5, colorCode: '#E53935', groupIdx: 0 },
    { code: 'TV', name: 'Tiếng Việt', shortName: 'TV', subjectType: SubjectType.REQUIRED, periodsPerWeek: 7, colorCode: '#1E88E5', groupIdx: 1 },
    { code: 'TA-TH', name: 'Tiếng Anh', shortName: 'TA', subjectType: SubjectType.REQUIRED, periodsPerWeek: 4, colorCode: '#FB8C00', groupIdx: 2 },
    { code: 'TNXH', name: 'Tự nhiên & Xã hội', shortName: 'TNXH', subjectType: SubjectType.REQUIRED, periodsPerWeek: 2, colorCode: '#43A047', groupIdx: 0 },
    { code: 'LS-DL', name: 'Lịch sử & Địa lý', shortName: 'LS-DL', subjectType: SubjectType.REQUIRED, periodsPerWeek: 2, colorCode: '#5E35B1', groupIdx: 1 },
    { code: 'KHOA-HOC', name: 'Khoa học', shortName: 'KH', subjectType: SubjectType.REQUIRED, periodsPerWeek: 2, colorCode: '#00897B', groupIdx: 0 },
    { code: 'AN-NHAC', name: 'Âm nhạc', shortName: 'AN', subjectType: SubjectType.REQUIRED, periodsPerWeek: 1, colorCode: '#8E24AA', groupIdx: 3 },
    { code: 'MY-THUAT', name: 'Mỹ thuật', shortName: 'MT', subjectType: SubjectType.REQUIRED, periodsPerWeek: 1, colorCode: '#D81B60', groupIdx: 3 },
    { code: 'THE-DUC', name: 'Thể dục', shortName: 'TD', subjectType: SubjectType.REQUIRED, periodsPerWeek: 2, colorCode: '#F4511E', groupIdx: 3 },
    { code: 'TIN-HOC', name: 'Tin học', shortName: 'TH', subjectType: SubjectType.REQUIRED, periodsPerWeek: 1, colorCode: '#546E7A', groupIdx: 4 },
    { code: 'CONG-NGHE', name: 'Công nghệ', shortName: 'CN', subjectType: SubjectType.REQUIRED, periodsPerWeek: 1, colorCode: '#6D4C41', groupIdx: 4 },
    { code: 'DD', name: 'Đạo đức', shortName: 'ĐĐ', subjectType: SubjectType.REQUIRED, periodsPerWeek: 1, colorCode: '#00ACC1', groupIdx: 1 },
    { code: 'HĐTN', name: 'Hoạt động trải nghiệm', shortName: 'HĐTN', subjectType: SubjectType.REQUIRED, periodsPerWeek: 1, colorCode: '#7CB342', groupIdx: 1 },
    { code: 'TIENG-NHAT', name: 'Tiếng Nhật', shortName: 'TN', subjectType: SubjectType.ELECTIVE, periodsPerWeek: 2, colorCode: '#C62828', groupIdx: 2 },
    { code: 'ROBOTICS', name: 'Robotics', shortName: 'Robot', subjectType: SubjectType.EXTRACURRICULAR, periodsPerWeek: 2, colorCode: '#283593', groupIdx: 4 },
  ];

  const subjects: SubjectEntity[] = [];
  for (const s of subjectsData) {
    let subject = await subjectRepo.findOne({ where: { schoolId, code: s.code } });
    if (!subject) {
      subject = await subjectRepo.save({
        schoolId,
        code: s.code,
        name: s.name,
        shortName: s.shortName,
        subjectType: s.subjectType,
        periodsPerWeek: s.periodsPerWeek,
        requiresRoomType: s.code === 'THE-DUC' ? RoomType.GYM : (s.code === 'AN-NHAC' ? RoomType.MUSIC : (s.code === 'MY-THUAT' ? RoomType.ART : (s.code === 'TIN-HOC' || s.code === 'ROBOTICS' ? RoomType.LAB : RoomType.STANDARD))),
        colorCode: s.colorCode,
        isDoublePeriod: s.code === 'THE-DUC' || s.code === 'ROBOTICS',
        subjectGroupId: groups[s.groupIdx].id,
      });
    }
    subjects.push(subject);
  }
  console.log(`  ✅ ${subjects.length} subjects created`);

  // Subject-Grade (phân bổ tiết/khối)
  const sgGradeRepo = dataSource.getRepository(SubjectGradeEntity);
  // Check theo subject đầu tiên của trường (Toán) + grade đầu tiên
  const existingSG = await sgGradeRepo.findOne({
    where: { subjectId: subjects[0].id, gradeId: grades[0].id },
  });
  if (!existingSG) {
    // Toán, TV, TA cho tất cả khối
    for (const grade of grades) {
      await sgGradeRepo.save({ subjectId: subjects[0].id, gradeId: grade.id, periodsPerWeek: 5 }); // Toán
      await sgGradeRepo.save({ subjectId: subjects[1].id, gradeId: grade.id, periodsPerWeek: 7 }); // TV
      await sgGradeRepo.save({ subjectId: subjects[2].id, gradeId: grade.id, periodsPerWeek: 4 }); // TA
      await sgGradeRepo.save({ subjectId: subjects[8].id, gradeId: grade.id, periodsPerWeek: 2 }); // TD
    }
    console.log('  ✅ Subject-Grade mappings created');
  }

  // ═══════════════════════════════════════════════
  // 4. ROOMS (Phòng học)
  // ═══════════════════════════════════════════════
  console.log('🏠 Seeding Rooms...');

  const roomRepo = dataSource.getRepository(RoomEntity);
  const roomsData = [
    { code: 'A101', name: 'Phòng A101', building: 'Nhà A', floor: 1, capacity: 35, roomType: RoomType.STANDARD },
    { code: 'A102', name: 'Phòng A102', building: 'Nhà A', floor: 1, capacity: 35, roomType: RoomType.STANDARD },
    { code: 'A103', name: 'Phòng A103', building: 'Nhà A', floor: 1, capacity: 35, roomType: RoomType.STANDARD },
    { code: 'A104', name: 'Phòng A104', building: 'Nhà A', floor: 1, capacity: 35, roomType: RoomType.STANDARD },
    { code: 'A201', name: 'Phòng A201', building: 'Nhà A', floor: 2, capacity: 40, roomType: RoomType.STANDARD },
    { code: 'A202', name: 'Phòng A202', building: 'Nhà A', floor: 2, capacity: 40, roomType: RoomType.STANDARD },
    { code: 'A203', name: 'Phòng A203', building: 'Nhà A', floor: 2, capacity: 40, roomType: RoomType.STANDARD },
    { code: 'A204', name: 'Phòng A204', building: 'Nhà A', floor: 2, capacity: 40, roomType: RoomType.STANDARD },
    { code: 'B101', name: 'Phòng Tin học', building: 'Nhà B', floor: 1, capacity: 30, roomType: RoomType.LAB },
    { code: 'B102', name: 'Phòng Lab KHTN', building: 'Nhà B', floor: 1, capacity: 30, roomType: RoomType.LAB },
    { code: 'C101', name: 'Phòng Âm nhạc', building: 'Nhà C', floor: 1, capacity: 35, roomType: RoomType.MUSIC },
    { code: 'C102', name: 'Phòng Mỹ thuật', building: 'Nhà C', floor: 1, capacity: 35, roomType: RoomType.ART },
    { code: 'D101', name: 'Nhà Thể dục', building: 'Sân', floor: 1, capacity: 50, roomType: RoomType.GYM },
    { code: 'A301', name: 'Phòng họp', building: 'Nhà A', floor: 3, capacity: 20, roomType: RoomType.OTHER },
  ];

  const rooms: RoomEntity[] = [];
  for (const r of roomsData) {
    let room = await roomRepo.findOne({ where: { schoolId, code: r.code } });
    if (!room) {
      room = await roomRepo.save({ schoolId, ...r, status: RoomStatus.AVAILABLE });
    }
    rooms.push(room);
  }
  console.log(`  ✅ ${rooms.length} rooms created`);

  // ═══════════════════════════════════════════════
  // 5. TEACHERS (Giáo viên - 20 GV)
  // ═══════════════════════════════════════════════
  console.log('👩‍🏫 Seeding Teachers...');

  const teacherRepo = dataSource.getRepository(TeacherEntity);
  const teachersData = [
    { employeeCode: 'NBK-GV001', fullName: 'Nguyễn Thị Hồng', shortName: 'Hồng', gender: Gender.FEMALE, teacherType: TeacherType.FULL_TIME, maxPPW: 25, minPPW: 15, maxPPD: 5 },
    { employeeCode: 'NBK-GV002', fullName: 'Trần Văn Minh', shortName: 'Minh', gender: Gender.MALE, teacherType: TeacherType.FULL_TIME, maxPPW: 25, minPPW: 15, maxPPD: 5 },
    { employeeCode: 'NBK-GV003', fullName: 'Lê Thị Thanh', shortName: 'Thanh', gender: Gender.FEMALE, teacherType: TeacherType.FULL_TIME, maxPPW: 25, minPPW: 15, maxPPD: 5 },
    { employeeCode: 'NBK-GV004', fullName: 'Phạm Đức Hải', shortName: 'Hải', gender: Gender.MALE, teacherType: TeacherType.FULL_TIME, maxPPW: 25, minPPW: 15, maxPPD: 5 },
    { employeeCode: 'NBK-GV005', fullName: 'Hoàng Thị Mai', shortName: 'Mai', gender: Gender.FEMALE, teacherType: TeacherType.FULL_TIME, maxPPW: 25, minPPW: 15, maxPPD: 5 },
    { employeeCode: 'NBK-GV006', fullName: 'Vũ Đình Tuấn', shortName: 'Tuấn', gender: Gender.MALE, teacherType: TeacherType.FULL_TIME, maxPPW: 25, minPPW: 15, maxPPD: 5 },
    { employeeCode: 'NBK-GV007', fullName: 'Đặng Thị Lan', shortName: 'Lan', gender: Gender.FEMALE, teacherType: TeacherType.FULL_TIME, maxPPW: 20, minPPW: 12, maxPPD: 5 },
    { employeeCode: 'NBK-GV008', fullName: 'Bùi Văn Hùng', shortName: 'Hùng', gender: Gender.MALE, teacherType: TeacherType.FULL_TIME, maxPPW: 20, minPPW: 12, maxPPD: 5 },
    { employeeCode: 'NBK-GV009', fullName: 'Ngô Thị Hạnh', shortName: 'Hạnh', gender: Gender.FEMALE, teacherType: TeacherType.FULL_TIME, maxPPW: 20, minPPW: 12, maxPPD: 4 },
    { employeeCode: 'NBK-GV010', fullName: 'Đỗ Minh Quân', shortName: 'Quân', gender: Gender.MALE, teacherType: TeacherType.FULL_TIME, maxPPW: 20, minPPW: 12, maxPPD: 4 },
    { employeeCode: 'NBK-GV011', fullName: 'Trịnh Thị Phương', shortName: 'Phương', gender: Gender.FEMALE, teacherType: TeacherType.FULL_TIME, maxPPW: 18, minPPW: 10, maxPPD: 4 },
    { employeeCode: 'NBK-GV012', fullName: 'Lý Văn Thắng', shortName: 'Thắng', gender: Gender.MALE, teacherType: TeacherType.FULL_TIME, maxPPW: 18, minPPW: 10, maxPPD: 4 },
    { employeeCode: 'NBK-GV013', fullName: 'Cao Thị Ngọc', shortName: 'Ngọc', gender: Gender.FEMALE, teacherType: TeacherType.FULL_TIME, maxPPW: 18, minPPW: 10, maxPPD: 4 },
    { employeeCode: 'NBK-GV014', fullName: 'Phan Anh Dũng', shortName: 'Dũng', gender: Gender.MALE, teacherType: TeacherType.FULL_TIME, maxPPW: 18, minPPW: 10, maxPPD: 4 },
    { employeeCode: 'NBK-GV015', fullName: 'Nguyễn Thúy Hằng', shortName: 'Hằng', gender: Gender.FEMALE, teacherType: TeacherType.FULL_TIME, maxPPW: 16, minPPW: 8, maxPPD: 4 },
    { employeeCode: 'NBK-GV016', fullName: 'Trần Quang Huy', shortName: 'Huy', gender: Gender.MALE, teacherType: TeacherType.VISITING, maxPPW: 12, minPPW: 4, maxPPD: 3 },
    { employeeCode: 'NBK-GV017', fullName: 'Emily Johnson', shortName: 'Emily', gender: Gender.FEMALE, teacherType: TeacherType.VISITING, maxPPW: 16, minPPW: 8, maxPPD: 4 },
    { employeeCode: 'NBK-GV018', fullName: 'Yamada Kenji', shortName: 'Kenji', gender: Gender.MALE, teacherType: TeacherType.VISITING, maxPPW: 10, minPPW: 4, maxPPD: 3 },
    { employeeCode: 'NBK-GV019', fullName: 'Võ Thị Bích', shortName: 'Bích', gender: Gender.FEMALE, teacherType: TeacherType.FULL_TIME, maxPPW: 20, minPPW: 12, maxPPD: 5 },
    { employeeCode: 'NBK-GV020', fullName: 'Đinh Công Danh', shortName: 'Danh', gender: Gender.MALE, teacherType: TeacherType.ASSISTANT, maxPPW: 15, minPPW: 8, maxPPD: 4 },
  ];

  const teachers: TeacherEntity[] = [];
  for (const t of teachersData) {
    let teacher = await teacherRepo
      .createQueryBuilder('teacher')
      .withDeleted()
      .where('teacher.employee_code = :code', { code: t.employeeCode })
      .getOne();
    if (!teacher) {
      teacher = await teacherRepo.save({
        schoolId,
        employeeCode: t.employeeCode,
        fullName: t.fullName,
        shortName: t.shortName,
        gender: t.gender,
        teacherType: t.teacherType,
        maxPeriodsPerWeek: t.maxPPW,
        minPeriodsPerWeek: t.minPPW,
        maxPeriodsPerDay: t.maxPPD,
        status: TeacherStatus.ACTIVE,
      });
    }
    teachers.push(teacher);
  }
  console.log(`  ✅ ${teachers.length} teachers created`);

  // ═══════════════════════════════════════════════
  // 6. DEPARTMENTS (Tổ bộ môn)
  // ═══════════════════════════════════════════════
  console.log('🏢 Seeding Departments...');

  const deptRepo = dataSource.getRepository(DepartmentEntity);
  const deptMemberRepo = dataSource.getRepository(DepartmentMemberEntity);

  const deptsData = [
    { name: 'Tổ Toán - Tin', headIdx: 0 },
    { name: 'Tổ Ngữ văn - KHXH', headIdx: 2 },
    { name: 'Tổ Ngoại ngữ', headIdx: 6 },
    { name: 'Tổ Nghệ thuật - Thể dục', headIdx: 10 },
    { name: 'Tổ Khoa học Tự nhiên', headIdx: 4 },
  ];

  const departments: DepartmentEntity[] = [];
  for (const d of deptsData) {
    let dept = await deptRepo.findOne({ where: { schoolId, name: d.name } });
    if (!dept) {
      dept = await deptRepo.save({
        schoolId,
        name: d.name,
        headTeacherId: teachers[d.headIdx].id,
      });
    }
    departments.push(dept);
  }
  console.log(`  ✅ ${departments.length} departments created`);

  // Department Members
  // Check bằng cách tìm member đầu tiên của department đầu tiên
  const existingMembers = await deptMemberRepo.findOne({
    where: { departmentId: departments[0].id },
  });
  if (!existingMembers) {
    const memberMappings = [
      // Tổ Toán - Tin: GV001, GV002, GV005, GV009, GV020
      { deptIdx: 0, teacherIdxs: [0, 1, 4, 8, 19], positions: [PositionTitle.GVBM, PositionTitle.GVBM, PositionTitle.GVBM, PositionTitle.GVBM, PositionTitle.GVBM] },
      // Tổ Ngữ văn - KHXH: GV003, GV004, GV006, GV014
      { deptIdx: 1, teacherIdxs: [2, 3, 5, 13], positions: [PositionTitle.GVCN, PositionTitle.GVBM, PositionTitle.GVBM, PositionTitle.GVBM] },
      // Tổ Ngoại ngữ: GV007, GV008, GV017, GV018
      { deptIdx: 2, teacherIdxs: [6, 7, 16, 17], positions: [PositionTitle.GVBM, PositionTitle.GVBM, PositionTitle.GVBM, PositionTitle.GVBM] },
      // Tổ NT-TD: GV011, GV012, GV013, GV015, GV016
      { deptIdx: 3, teacherIdxs: [10, 11, 12, 14, 15], positions: [PositionTitle.GVBM, PositionTitle.GVBM, PositionTitle.GVBM, PositionTitle.GVBM, PositionTitle.GVBM] },
      // Tổ KHTN: GV005, GV010, GV019
      { deptIdx: 4, teacherIdxs: [4, 9, 18], positions: [PositionTitle.GVBM, PositionTitle.GVBM, PositionTitle.GVBM] },
    ];

    for (const m of memberMappings) {
      for (let i = 0; i < m.teacherIdxs.length; i++) {
        await deptMemberRepo.save({
          departmentId: departments[m.deptIdx].id,
          teacherId: teachers[m.teacherIdxs[i]].id,
          positionTitle: m.positions[i],
          managementLevel: i === 0 ? ManagementLevel.TO_TRUONG : null,
        });
      }
    }
    console.log('  ✅ Department members assigned');
  }

  // ═══════════════════════════════════════════════
  // 7. TEACHER SUBJECTS (Năng lực GV - Môn)
  // ═══════════════════════════════════════════════
  console.log('🎓 Seeding Teacher Subjects...');

  const tsRepo = dataSource.getRepository(TeacherSubjectEntity);
  // Check bằng cách tìm record teacher đầu tiên + subject đầu tiên
  const existingTS = await tsRepo.findOne({
    where: { teacherId: teachers[0].id, subjectId: subjects[0].id },
  });
  if (!existingTS) {
    // Toán: GV001, GV002, GV005
    const teacherSubjectMap = [
      { tIdx: 0, sIdx: 0, level: ProficiencyLevel.EXPERT, isPrimary: true, cert: 'Cử nhân Sư phạm Toán' },
      { tIdx: 1, sIdx: 0, level: ProficiencyLevel.ADVANCED, isPrimary: true, cert: 'Thạc sĩ Toán học' },
      { tIdx: 4, sIdx: 0, level: ProficiencyLevel.INTERMEDIATE, isPrimary: false, cert: null },
      // TV: GV003, GV004, GV006
      { tIdx: 2, sIdx: 1, level: ProficiencyLevel.EXPERT, isPrimary: true, cert: 'Cử nhân Sư phạm Ngữ văn' },
      { tIdx: 3, sIdx: 1, level: ProficiencyLevel.ADVANCED, isPrimary: true, cert: 'Thạc sĩ Ngôn ngữ' },
      { tIdx: 5, sIdx: 1, level: ProficiencyLevel.INTERMEDIATE, isPrimary: true, cert: null },
      // TA: GV007, GV008, GV017 (Emily)
      { tIdx: 6, sIdx: 2, level: ProficiencyLevel.ADVANCED, isPrimary: true, cert: 'IELTS 7.5' },
      { tIdx: 7, sIdx: 2, level: ProficiencyLevel.ADVANCED, isPrimary: true, cert: 'TOEFL 100' },
      { tIdx: 16, sIdx: 2, level: ProficiencyLevel.EXPERT, isPrimary: true, cert: 'Native Speaker - TESOL' },
      // TNXH & KHTN: GV005, GV010, GV019
      { tIdx: 4, sIdx: 3, level: ProficiencyLevel.ADVANCED, isPrimary: true, cert: 'Cử nhân Sinh học' },
      { tIdx: 9, sIdx: 5, level: ProficiencyLevel.ADVANCED, isPrimary: true, cert: 'Cử nhân Khoa học' },
      { tIdx: 18, sIdx: 3, level: ProficiencyLevel.INTERMEDIATE, isPrimary: true, cert: null },
      // Âm nhạc: GV011
      { tIdx: 10, sIdx: 6, level: ProficiencyLevel.EXPERT, isPrimary: true, cert: 'Cử nhân Nhạc viện' },
      // Mỹ thuật: GV012
      { tIdx: 11, sIdx: 7, level: ProficiencyLevel.EXPERT, isPrimary: true, cert: 'Cử nhân Mỹ thuật' },
      // Thể dục: GV013, GV015
      { tIdx: 12, sIdx: 8, level: ProficiencyLevel.EXPERT, isPrimary: true, cert: 'Cử nhân TDTT' },
      { tIdx: 14, sIdx: 8, level: ProficiencyLevel.ADVANCED, isPrimary: true, cert: 'HLV Thể thao' },
      // Tin học: GV009, GV020
      { tIdx: 8, sIdx: 9, level: ProficiencyLevel.ADVANCED, isPrimary: true, cert: 'Cử nhân CNTT' },
      { tIdx: 19, sIdx: 9, level: ProficiencyLevel.INTERMEDIATE, isPrimary: false, cert: null },
      // Đạo đức: GV014
      { tIdx: 13, sIdx: 11, level: ProficiencyLevel.ADVANCED, isPrimary: true, cert: null },
      // Tiếng Nhật: GV018 (Kenji)
      { tIdx: 17, sIdx: 13, level: ProficiencyLevel.EXPERT, isPrimary: true, cert: 'Native Speaker - JLPT N1' },
      // Robotics: GV016
      { tIdx: 15, sIdx: 14, level: ProficiencyLevel.ADVANCED, isPrimary: true, cert: 'Kỹ sư CNTT' },
    ];

    for (const ts of teacherSubjectMap) {
      await tsRepo.save({
        teacherId: teachers[ts.tIdx].id,
        subjectId: subjects[ts.sIdx].id,
        proficiencyLevel: ts.level,
        isPrimary: ts.isPrimary,
        certification: ts.cert,
        notes: null,
      });
    }
    console.log('  ✅ Teacher-Subject competencies created');
  }

  // ═══════════════════════════════════════════════
  // 8. TEACHER SCHOOL ASSIGNMENTS (Biệt phái GV)
  // ═══════════════════════════════════════════════
  console.log('📝 Seeding Teacher School Assignments...');

  const tsaRepo = dataSource.getRepository(TeacherSchoolAssignmentEntity);
  const existingTSA = await tsaRepo.count({ where: { schoolId } });
  if (existingTSA === 0) {
    for (let i = 0; i < teachers.length; i++) {
      await tsaRepo.save({
        teacherId: teachers[i].id,
        schoolId,
        role: i < 15 ? AssignmentRole.PRIMARY : AssignmentRole.SECONDARY,
        status: AssignmentStatus.ACTIVE,
        effectiveStartDate: '2025-09-01', // 01/09/2025
        effectiveEndDate: null,
        note: i >= 15 ? 'Giáo viên thỉnh giảng' : null,
      });
    }
    console.log('  ✅ 20 teacher-school assignments created');
  }

  // ═══════════════════════════════════════════════
  // 9. EVENTS (Sự kiện & Ngày nghỉ)
  // ═══════════════════════════════════════════════
  console.log('📅 Seeding Events...');

  const eventRepo = dataSource.getRepository(EventEntity);
  const existingEvents = await eventRepo.count({ where: { schoolId } });
  if (existingEvents === 0) {
    const eventsData = [
      {
        title: 'Lễ Khai giảng năm học 2025-2026',
        description: 'Lễ khai giảng long trọng đầu năm học mới. Toàn bộ HS, GV, PH tham dự.',
        eventType: EventType.EVENT,
        startDate: new Date('2025-09-01T07:00:00'), // 01/09/2025
        endDate: new Date('2025-09-01T11:00:00'),
        allDay: false, affectsSchedule: true, isRecurring: false,
        status: EventStatus.ACTIVE,
      },
      {
        title: 'Nghỉ Quốc khánh 02/09',
        description: 'Nghỉ lễ Quốc khánh 02/09/2025',
        eventType: EventType.HOLIDAY,
        startDate: new Date('2025-09-02T00:00:00'), // 02/09/2025
        endDate: new Date('2025-09-02T23:59:59'),
        allDay: true, affectsSchedule: true, isRecurring: true,
        recurrenceRule: { frequency: 'yearly', month: 9, day: 2 },
        status: EventStatus.ACTIVE,
      },
      {
        title: 'Kiểm tra giữa kỳ 1',
        description: 'Kiểm tra giữa kỳ toàn trường. Từ 20/10 đến 25/10/2025.',
        eventType: EventType.EXAM,
        startDate: new Date('2025-10-20T07:00:00'), // 20/10/2025
        endDate: new Date('2025-10-25T17:00:00'),   // 25/10/2025
        allDay: false, affectsSchedule: true, isRecurring: false,
        status: EventStatus.ACTIVE,
      },
      {
        title: 'Ngày Nhà giáo Việt Nam',
        description: 'Kỷ niệm Ngày Nhà giáo 20/11. Buổi chiều nghỉ dạy.',
        eventType: EventType.EVENT,
        startDate: new Date('2025-11-20T07:00:00'), // 20/11/2025
        endDate: new Date('2025-11-20T12:00:00'),
        allDay: false, affectsSchedule: true, isRecurring: true,
        recurrenceRule: { frequency: 'yearly', month: 11, day: 20 },
        status: EventStatus.ACTIVE,
      },
      {
        title: 'Nghỉ Tết Dương lịch 2026',
        description: 'Nghỉ Tết Dương lịch 01/01/2026.',
        eventType: EventType.HOLIDAY,
        startDate: new Date('2026-01-01T00:00:00'), // 01/01/2026
        endDate: new Date('2026-01-01T23:59:59'),
        allDay: true, affectsSchedule: true, isRecurring: true,
        recurrenceRule: { frequency: 'yearly', month: 1, day: 1 },
        status: EventStatus.ACTIVE,
      },
      {
        title: 'Thi cuối kỳ 1',
        description: 'Kiểm tra cuối kỳ 1 toàn trường. Từ 05/01 đến 10/01/2026.',
        eventType: EventType.EXAM,
        startDate: new Date('2026-01-05T07:00:00'), // 05/01/2026
        endDate: new Date('2026-01-10T17:00:00'),   // 10/01/2026
        allDay: false, affectsSchedule: true, isRecurring: false,
        status: EventStatus.ACTIVE,
      },
      {
        title: 'Nghỉ Tết Nguyên đán 2026',
        description: 'Nghỉ Tết Âm lịch từ 25/01 đến 08/02/2026.',
        eventType: EventType.HOLIDAY,
        startDate: new Date('2026-01-25T00:00:00'), // 25/01/2026
        endDate: new Date('2026-02-08T23:59:59'),   // 08/02/2026
        allDay: true, affectsSchedule: true, isRecurring: false,
        status: EventStatus.ACTIVE,
      },
      {
        title: 'Họp phụ huynh đầu năm',
        description: 'Họp phụ huynh lớp 1-5. Ngày 13/09/2025 buổi chiều.',
        eventType: EventType.MEETING,
        startDate: new Date('2025-09-13T14:00:00'), // 13/09/2025
        endDate: new Date('2025-09-13T17:00:00'),
        allDay: false, affectsSchedule: false, isRecurring: false,
        status: EventStatus.ACTIVE,
      },
    ];

    for (const e of eventsData) {
      await eventRepo.save({
        schoolId,
        ...e,
        recurrenceRule: e.recurrenceRule || null,
        affectedGrades: null,
        affectedClasses: null,
      });
    }
    console.log(`  ✅ ${eventsData.length} events created`);
  }

  // ═══════════════════════════════════════════════
  // 10. LEAVE REQUESTS (Đơn xin nghỉ phép)
  // ═══════════════════════════════════════════════
  console.log('🏖️  Seeding Leave Requests...');

  const leaveRepo = dataSource.getRepository(LeaveRequestEntity);
  const existingLeaves = await leaveRepo.count({ where: { schoolId } });
  if (existingLeaves === 0) {
    const leavesData = [
      {
        teacherIdx: 2, leaveType: LeaveRequestType.SICK, startDate: '2025-09-15', // 15/09/2025
        endDate: '2025-09-16', totalDays: 2, reason: 'Bị cảm, sốt cao. Cần nghỉ 2 ngày theo chỉ định bác sĩ.',
        status: LeaveRequestStatus.APPROVED, approvedBy: adminUserId, approvedAt: new Date('2025-09-14T10:00:00'),
      },
      {
        teacherIdx: 5, leaveType: LeaveRequestType.ANNUAL, startDate: '2025-10-06', // 06/10/2025
        endDate: '2025-10-07', totalDays: 2, reason: 'Xin nghỉ phép năm để đưa con đi khám định kỳ.',
        status: LeaveRequestStatus.APPROVED, approvedBy: adminUserId, approvedAt: new Date('2025-10-03T14:00:00'),
      },
      {
        teacherIdx: 10, leaveType: LeaveRequestType.PERSONAL, startDate: '2025-11-03', // 03/11/2025
        endDate: '2025-11-03', totalDays: 1, reason: 'Việc gia đình đột xuất (đám cưới em gái).',
        status: LeaveRequestStatus.APPROVED, approvedBy: adminUserId, approvedAt: new Date('2025-10-30T09:00:00'),
      },
      {
        teacherIdx: 7, leaveType: LeaveRequestType.SICK, startDate: '2025-11-17', // 17/11/2025
        endDate: '2025-11-19', totalDays: 3, reason: 'Phẫu thuật nhỏ, cần nghỉ 3 ngày để hồi phục.',
        status: LeaveRequestStatus.PENDING, approvedBy: null, approvedAt: null,
      },
      {
        teacherIdx: 14, leaveType: LeaveRequestType.MATERNITY, startDate: '2025-12-01', // 01/12/2025
        endDate: '2026-05-31', totalDays: 180, reason: 'Nghỉ thai sản theo quy định (dự sinh 15/12/2025).',
        status: LeaveRequestStatus.APPROVED, approvedBy: adminUserId, approvedAt: new Date('2025-11-15T08:00:00'),
      },
      {
        teacherIdx: 0, leaveType: LeaveRequestType.ANNUAL, startDate: '2025-12-22', // 22/12/2025
        endDate: '2025-12-24', totalDays: 3, reason: 'Xin phép nghỉ trước kỳ nghỉ Tết dương.',
        status: LeaveRequestStatus.REJECTED, approvedBy: adminUserId, approvedAt: new Date('2025-12-18T16:00:00'),
        rejectionReason: 'Thời điểm cận thi cuối kỳ, không bố trí được GV dạy thay.',
      },
    ];

    for (const l of leavesData) {
      await leaveRepo.save({
        schoolId,
        teacherId: teachers[l.teacherIdx].id,
        leaveType: l.leaveType,
        startDate: l.startDate,
        endDate: l.endDate,
        totalDays: l.totalDays,
        reason: l.reason,
        status: l.status,
        approvedBy: l.approvedBy,
        approvedAt: l.approvedAt,
        rejectionReason: (l as any).rejectionReason || null,
        adminNote: null,
      });
    }
    console.log(`  ✅ ${leavesData.length} leave requests created`);
  }

  // ═══════════════════════════════════════════════
  // 11. PERIOD SWAPS (Yêu cầu đổi tiết)
  // ═══════════════════════════════════════════════
  console.log('🔄 Seeding Period Swaps...');

  const swapRepo = dataSource.getRepository(PeriodSwapEntity);
  const existingSwaps = await swapRepo.count({ where: { schoolId } });
  if (existingSwaps === 0) {
    const swapsData = [
      {
        requesterIdx: 0, targetIdx: 1,
        requesterDate: '2025-09-22', requesterPeriod: 2, // 22/09/2025 tiết 2
        targetDate: '2025-09-23', targetPeriod: 3,       // 23/09/2025 tiết 3
        reason: 'Cô Hồng bận họp với PH lớp 1A1 tiết 2 thứ 2, xin đổi sang thứ 3 tiết 3 của thầy Minh.',
        status: PeriodSwapStatus.APPROVED, approvedBy: adminUserId,
      },
      {
        requesterIdx: 6, targetIdx: 7,
        requesterDate: '2025-10-13', requesterPeriod: 1, // 13/10/2025 tiết 1
        targetDate: '2025-10-14', targetPeriod: 4,       // 14/10/2025 tiết 4
        reason: 'Cô Lan có lịch khám sức khỏe buổi sáng 13/10, đổi tiết 1 sang tiết 4 ngày 14/10 của thầy Hùng.',
        status: PeriodSwapStatus.PENDING_TEACHER, approvedBy: null,
      },
      {
        requesterIdx: 3, targetIdx: 5,
        requesterDate: '2025-11-10', requesterPeriod: 4, // 10/11/2025 tiết 4
        targetDate: '2025-11-11', targetPeriod: 2,       // 11/11/2025 tiết 2
        reason: 'Thầy Hải xin đổi tiết do phải tham gia tập huấn chuyên môn chiều 10/11.',
        status: PeriodSwapStatus.REJECTED_BY_TEACHER, approvedBy: null,
        rejectionReason: 'Thầy Tuấn đã có lịch dạy thêm tiết 2 ngày 11/11.',
      },
    ];

    for (const s of swapsData) {
      await swapRepo.save({
        schoolId,
        requesterId: teachers[s.requesterIdx].id,
        targetId: teachers[s.targetIdx].id,
        requesterDate: s.requesterDate,
        requesterPeriod: s.requesterPeriod,
        targetDate: s.targetDate,
        targetPeriod: s.targetPeriod,
        reason: s.reason,
        status: s.status,
        approvedBy: s.approvedBy,
        approvedAt: s.approvedBy ? new Date('2025-09-21T09:00:00') : null,
        targetAcceptedAt: s.status === PeriodSwapStatus.APPROVED ? new Date('2025-09-20T15:00:00') : null,
        rejectionReason: (s as any).rejectionReason || null,
      });
    }
    console.log(`  ✅ ${swapsData.length} period swaps created`);
  }

  // ═══════════════════════════════════════════════
  // 12. CURRICULUM PLANS (Chương trình học)
  // ═══════════════════════════════════════════════
  console.log('📖 Seeding Curriculum Plans...');

  const cpRepo = dataSource.getRepository(CurriculumPlanEntity);
  const cpiRepo = dataSource.getRepository(CurriculumPlanItemEntity);
  const existingCP = await cpRepo.count({ where: { schoolId } });
  if (existingCP === 0) {
    // Plan cho Khối 1
    const plan1 = await cpRepo.save({
      schoolId,
      academicYearId: academicYear.id,
      gradeId: grades[0].id,
      name: 'Chương trình Khối 1 - NH 2025-2026',
      description: 'Phân phối chương trình lớp 1 theo TT 32/2018/TT-BGDĐT.',
      status: CurriculumPlanStatus.APPROVED,
      totalPeriodsPerWeek: 25,
      approvedBy: adminUserId,
      approvedAt: new Date('2025-08-20T10:00:00'),
    });

    const plan1Items = [
      { subjectIdx: 0, periodsPerWeek: 5, isRequired: true, displayOrder: 1 },  // Toán
      { subjectIdx: 1, periodsPerWeek: 7, isRequired: true, displayOrder: 2 },  // TV
      { subjectIdx: 2, periodsPerWeek: 4, isRequired: true, displayOrder: 3 },  // TA
      { subjectIdx: 3, periodsPerWeek: 2, isRequired: true, displayOrder: 4 },  // TNXH
      { subjectIdx: 6, periodsPerWeek: 1, isRequired: true, displayOrder: 5 },  // Âm nhạc
      { subjectIdx: 7, periodsPerWeek: 1, isRequired: true, displayOrder: 6 },  // Mỹ thuật
      { subjectIdx: 8, periodsPerWeek: 2, isRequired: true, displayOrder: 7 },  // Thể dục
      { subjectIdx: 11, periodsPerWeek: 1, isRequired: true, displayOrder: 8 }, // Đạo đức
      { subjectIdx: 12, periodsPerWeek: 1, isRequired: true, displayOrder: 9 }, // HĐTN
      { subjectIdx: 9, periodsPerWeek: 1, isRequired: true, displayOrder: 10 }, // Tin học
    ];
    for (const item of plan1Items) {
      await cpiRepo.save({
        curriculumPlanId: plan1.id,
        subjectId: subjects[item.subjectIdx].id,
        periodsPerWeek: item.periodsPerWeek,
        isRequired: item.isRequired,
        displayOrder: item.displayOrder,
        note: null,
      });
    }

    // Plan cho Khối 4
    const plan4 = await cpRepo.save({
      schoolId,
      academicYearId: academicYear.id,
      gradeId: grades[3].id,
      name: 'Chương trình Khối 4 - NH 2025-2026',
      description: 'Phân phối chương trình lớp 4 theo CT GDPT 2018.',
      status: CurriculumPlanStatus.DRAFT,
      totalPeriodsPerWeek: 30,
      approvedBy: null,
      approvedAt: null,
    });

    const plan4Items = [
      { subjectIdx: 0, periodsPerWeek: 5, isRequired: true, displayOrder: 1 },
      { subjectIdx: 1, periodsPerWeek: 7, isRequired: true, displayOrder: 2 },
      { subjectIdx: 2, periodsPerWeek: 4, isRequired: true, displayOrder: 3 },
      { subjectIdx: 4, periodsPerWeek: 2, isRequired: true, displayOrder: 4 },  // LS-DL
      { subjectIdx: 5, periodsPerWeek: 2, isRequired: true, displayOrder: 5 },  // Khoa học
      { subjectIdx: 6, periodsPerWeek: 1, isRequired: true, displayOrder: 6 },
      { subjectIdx: 7, periodsPerWeek: 1, isRequired: true, displayOrder: 7 },
      { subjectIdx: 8, periodsPerWeek: 2, isRequired: true, displayOrder: 8 },
      { subjectIdx: 9, periodsPerWeek: 1, isRequired: true, displayOrder: 9 },
      { subjectIdx: 10, periodsPerWeek: 1, isRequired: true, displayOrder: 10 }, // Công nghệ
      { subjectIdx: 11, periodsPerWeek: 1, isRequired: true, displayOrder: 11 },
      { subjectIdx: 12, periodsPerWeek: 1, isRequired: true, displayOrder: 12 },
      { subjectIdx: 14, periodsPerWeek: 2, isRequired: false, displayOrder: 13 }, // Robotics
    ];
    for (const item of plan4Items) {
      await cpiRepo.save({
        curriculumPlanId: plan4.id,
        subjectId: subjects[item.subjectIdx].id,
        periodsPerWeek: item.periodsPerWeek,
        isRequired: item.isRequired,
        displayOrder: item.displayOrder,
        note: item.subjectIdx === 14 ? 'Môn tự chọn - Robotics' : null,
      });
    }
    console.log('  ✅ 2 curriculum plans (Khối 1, Khối 4) with items created');
  }

  // ═══════════════════════════════════════════════
  // 13. TIMETABLE CONSTRAINTS (Ràng buộc TKB)
  // ═══════════════════════════════════════════════
  console.log('⚙️  Seeding Timetable Constraints...');

  const constraintRepo = dataSource.getRepository(TimetableConstraintEntity);
  const existingConstraints = await constraintRepo.count({ where: { schoolId } });
  if (existingConstraints === 0) {
    const constraintsData = [
      {
        constraintType: ConstraintType.MAX_PERIODS_PER_DAY,
        entityType: ConstraintEntityType.GLOBAL,
        entityId: null,
        priority: ConstraintPriority.REQUIRED,
        parameters: { maxPeriods: 5 },
        description: 'Tối đa 5 tiết/ngày cho tất cả GV',
      },
      {
        constraintType: ConstraintType.MAX_CONSECUTIVE,
        entityType: ConstraintEntityType.GLOBAL,
        entityId: null,
        priority: ConstraintPriority.HIGH,
        parameters: { maxConsecutive: 3 },
        description: 'Không dạy liên tiếp quá 3 tiết',
      },
      {
        constraintType: ConstraintType.BREAK_REQUIRED,
        entityType: ConstraintEntityType.GLOBAL,
        entityId: null,
        priority: ConstraintPriority.REQUIRED,
        parameters: { afterPeriod: 2, breakDuration: 15 },
        description: 'Bắt buộc ra chơi sau tiết 2 (15 phút)',
      },
      {
        constraintType: ConstraintType.TEACHER_UNAVAILABLE,
        entityType: ConstraintEntityType.TEACHER,
        entityId: teachers[16].id, // Emily
        priority: ConstraintPriority.REQUIRED,
        parameters: { unavailableDays: [2, 5], note: 'Emily chỉ dạy thứ 3, 4, 6' },
        description: 'GV Emily Johnson không dạy thứ 2 và thứ 5',
      },
      {
        constraintType: ConstraintType.TEACHER_UNAVAILABLE,
        entityType: ConstraintEntityType.TEACHER,
        entityId: teachers[17].id, // Kenji
        priority: ConstraintPriority.REQUIRED,
        parameters: { unavailableDays: [2, 3, 4], note: 'Kenji chỉ dạy thứ 5, 6' },
        description: 'GV Yamada Kenji chỉ dạy thứ 5 và thứ 6',
      },
      {
        constraintType: ConstraintType.ROOM_LOCK,
        entityType: ConstraintEntityType.ROOM,
        entityId: rooms[8].id, // Phòng Tin học
        priority: ConstraintPriority.HIGH,
        parameters: { lockedForSubjects: [subjects[9].id] },
        description: 'Phòng Tin học chỉ dùng cho môn Tin học',
      },
      {
        constraintType: ConstraintType.PREFERRED_SLOT,
        entityType: ConstraintEntityType.SUBJECT,
        entityId: subjects[8].id, // Thể dục
        priority: ConstraintPriority.MEDIUM,
        parameters: { preferredPeriods: [4, 5], reason: 'TD nên xếp cuối buổi' },
        description: 'Thể dục ưu tiên tiết 4-5 (cuối buổi sáng)',
      },
      {
        constraintType: ConstraintType.AVOID_SLOT,
        entityType: ConstraintEntityType.SUBJECT,
        entityId: subjects[0].id, // Toán
        priority: ConstraintPriority.LOW,
        parameters: { avoidPeriods: [5], reason: 'Tránh Toán tiết cuối' },
        description: 'Tránh xếp Toán vào tiết 5 (HS mệt)',
      },
    ];

    for (const c of constraintsData) {
      await constraintRepo.save({
        schoolId,
        timetableVersionId: null, // Global constraints
        ...c,
        isActive: true,
      });
    }
    console.log(`  ✅ ${constraintsData.length} timetable constraints created`);
  }

  // ═══════════════════════════════════════════════
  // 14. VALIDATION RULES (Quy tắc validate)
  // ═══════════════════════════════════════════════
  console.log('✅ Seeding Validation Rules...');

  const vrRepo = dataSource.getRepository(ValidationRuleEntity);
  const existingVR = await vrRepo.count({ where: { schoolId } });
  if (existingVR === 0) {
    const rulesData = [
      {
        entityTarget: ValidationEntityTarget.TEACHER,
        fieldName: 'maxPeriodsPerWeek',
        ruleType: ValidationRuleType.RANGE,
        ruleConfig: { min: 4, max: 30 },
        errorMessage: 'Số tiết tối đa/tuần phải nằm trong khoảng 4-30.',
        priority: 1,
      },
      {
        entityTarget: ValidationEntityTarget.TEACHER,
        fieldName: 'employeeCode',
        ruleType: ValidationRuleType.REGEX,
        ruleConfig: { pattern: '^NBK-GV\\d{3}$', flags: '' },
        errorMessage: 'Mã giáo viên phải theo format NBK-GVxxx (ví dụ: NBK-GV001).',
        priority: 2,
      },
      {
        entityTarget: ValidationEntityTarget.TEACHER,
        fieldName: 'fullName',
        ruleType: ValidationRuleType.LENGTH,
        ruleConfig: { min: 3, max: 100 },
        errorMessage: 'Họ tên giáo viên phải từ 3-100 ký tự.',
        priority: 3,
      },
      {
        entityTarget: ValidationEntityTarget.CLASS,
        fieldName: 'studentCount',
        ruleType: ValidationRuleType.RANGE,
        ruleConfig: { min: 15, max: 45 },
        errorMessage: 'Sĩ số lớp phải từ 15-45 học sinh.',
        priority: 1,
      },
      {
        entityTarget: ValidationEntityTarget.SUBJECT,
        fieldName: 'periodsPerWeek',
        ruleType: ValidationRuleType.RANGE,
        ruleConfig: { min: 1, max: 10 },
        errorMessage: 'Số tiết/tuần phải từ 1-10.',
        priority: 1,
      },
      {
        entityTarget: ValidationEntityTarget.TEACHING_ASSIGNMENT,
        fieldName: 'periodsPerWeek',
        ruleType: ValidationRuleType.RANGE,
        ruleConfig: { min: 1, max: 8 },
        errorMessage: 'Số tiết phân công/tuần phải từ 1-8.',
        priority: 1,
      },
      {
        entityTarget: ValidationEntityTarget.DEPARTMENT,
        fieldName: 'name',
        ruleType: ValidationRuleType.REQUIRED,
        ruleConfig: {},
        errorMessage: 'Tên tổ bộ môn không được để trống.',
        priority: 1,
      },
    ];

    for (const r of rulesData) {
      await vrRepo.save({ schoolId, ...r, isActive: true });
    }
    console.log(`  ✅ ${rulesData.length} validation rules created`);
  }

  // ═══════════════════════════════════════════════
  // 15. ATTENDANCE (Chấm công - dữ liệu tháng 9/2025)
  // ═══════════════════════════════════════════════
  console.log('📋 Seeding Attendance Records...');

  const attendanceRepo = dataSource.getRepository(AttendanceRecordEntity);
  const existingAttendance = await attendanceRepo.count({ where: { schoolId } });
  if (existingAttendance === 0) {
    // Tạo dữ liệu chấm công 5 ngày đầu (01-05/09/2025) cho 5 GV đầu tiên
    const attendanceDays = ['2025-09-01', '2025-09-02', '2025-09-03', '2025-09-04', '2025-09-05'];
    // 01/09, 02/09 (nghỉ QK), 03/09, 04/09, 05/09

    for (let tIdx = 0; tIdx < 5; tIdx++) {
      for (const day of attendanceDays) {
        const isHoliday = day === '2025-09-02'; // Quốc khánh
        let status = AttendanceStatus.PRESENT;
        let checkIn = '07:10';
        let checkOut = '17:00';
        let workCoefficient = 1;
        let leaveType: LeaveType | null = null;
        let overtimeHours = 0;

        if (isHoliday) {
          status = AttendanceStatus.LEAVE;
          leaveType = LeaveType.HOLIDAY;
          checkIn = null as any;
          checkOut = null as any;
          workCoefficient = 0;
        } else if (tIdx === 2 && day === '2025-09-03') {
          // GV003 đi muộn ngày 03/09
          status = AttendanceStatus.LATE;
          checkIn = '07:45';
          workCoefficient = 1;
        } else if (tIdx === 4 && day === '2025-09-05') {
          // GV005 nghỉ nửa ngày 05/09
          status = AttendanceStatus.HALF_DAY;
          checkOut = '11:30';
          workCoefficient = 0.5;
        } else if (tIdx === 0 && day === '2025-09-04') {
          // GV001 tăng ca 04/09
          overtimeHours = 2;
          checkOut = '19:00';
        }

        await attendanceRepo.save({
          schoolId,
          teacherId: teachers[tIdx].id,
          workDate: day,
          checkIn: checkIn || null,
          checkOut: checkOut || null,
          status,
          method: AttendanceMethod.MANUAL,
          leaveType,
          overtimeHours,
          workCoefficient,
          note: isHoliday ? 'Nghỉ lễ Quốc khánh 02/09' : null,
        });
      }
    }
    console.log('  ✅ Attendance records for 5 teachers x 5 days created');
  }

  // Attendance Summary (tổng hợp tháng 9/2025)
  const summaryRepo = dataSource.getRepository(AttendanceSummaryEntity);
  const existingSummary = await summaryRepo.count({ where: { schoolId } });
  if (existingSummary === 0) {
    const summariesData = [
      { teacherIdx: 0, actualWorkDays: 21, standardWorkDays: 22, totalOvertimeHours: 4, paidLeaveDays: 1, unpaidLeaveDays: 0, lateDays: 0, absentDays: 0 },
      { teacherIdx: 1, actualWorkDays: 22, standardWorkDays: 22, totalOvertimeHours: 0, paidLeaveDays: 0, unpaidLeaveDays: 0, lateDays: 0, absentDays: 0 },
      { teacherIdx: 2, actualWorkDays: 20, standardWorkDays: 22, totalOvertimeHours: 0, paidLeaveDays: 2, unpaidLeaveDays: 0, lateDays: 2, absentDays: 0 },
      { teacherIdx: 3, actualWorkDays: 22, standardWorkDays: 22, totalOvertimeHours: 2, paidLeaveDays: 0, unpaidLeaveDays: 0, lateDays: 0, absentDays: 0 },
      { teacherIdx: 4, actualWorkDays: 21.5, standardWorkDays: 22, totalOvertimeHours: 0, paidLeaveDays: 0, unpaidLeaveDays: 0.5, lateDays: 0, absentDays: 0 },
      { teacherIdx: 5, actualWorkDays: 20, standardWorkDays: 22, totalOvertimeHours: 0, paidLeaveDays: 2, unpaidLeaveDays: 0, lateDays: 0, absentDays: 0 },
      { teacherIdx: 6, actualWorkDays: 22, standardWorkDays: 22, totalOvertimeHours: 3, paidLeaveDays: 0, unpaidLeaveDays: 0, lateDays: 0, absentDays: 0 },
      { teacherIdx: 7, actualWorkDays: 21, standardWorkDays: 22, totalOvertimeHours: 0, paidLeaveDays: 0, unpaidLeaveDays: 1, lateDays: 1, absentDays: 0 },
    ];

    for (const s of summariesData) {
      await summaryRepo.save({
        schoolId,
        teacherId: teachers[s.teacherIdx].id,
        month: 9, // Tháng 9
        year: 2025,
        actualWorkDays: s.actualWorkDays,
        standardWorkDays: s.standardWorkDays,
        totalOvertimeHours: s.totalOvertimeHours,
        paidLeaveDays: s.paidLeaveDays,
        unpaidLeaveDays: s.unpaidLeaveDays,
        lateDays: s.lateDays,
        absentDays: s.absentDays,
        isFinalized: true,
      });
    }
    console.log('  ✅ Attendance summaries for September 2025 created');
  }

  // ═══════════════════════════════════════════════
  // 16. IMPORT/EXPORT (Lịch sử import & Template export)
  // ═══════════════════════════════════════════════
  console.log('📤 Seeding Import/Export data...');

  const importRepo = dataSource.getRepository(ImportBatchEntity);
  const existingImports = await importRepo.count({ where: { schoolId } });
  if (existingImports === 0) {
    const importsData = [
      {
        entityType: ImportEntityType.TEACHER,
        fileName: 'DanhSachGV_NBK_TH_2025.xlsx',
        fileSize: 45678,
        totalRows: 20,
        successCount: 20,
        errorCount: 0,
        progress: 100,
        status: ImportBatchStatus.COMPLETED,
        uploadedByUserId: adminUserId!,
        startedAt: new Date('2025-08-25T09:00:00'),  // 25/08/2025
        completedAt: new Date('2025-08-25T09:01:30'),
        errors: null,
        conflictStrategy: 'skip',
      },
      {
        entityType: ImportEntityType.SUBJECT,
        fileName: 'MonHoc_TieuHoc_2025.xlsx',
        fileSize: 23456,
        totalRows: 15,
        successCount: 15,
        errorCount: 0,
        progress: 100,
        status: ImportBatchStatus.COMPLETED,
        uploadedByUserId: adminUserId!,
        startedAt: new Date('2025-08-26T10:00:00'),  // 26/08/2025
        completedAt: new Date('2025-08-26T10:00:45'),
        errors: null,
        conflictStrategy: 'update',
      },
      {
        entityType: ImportEntityType.CLASS,
        fileName: 'DanhSachLop_NBK_TH_2025.xlsx',
        fileSize: 12345,
        totalRows: 22,
        successCount: 20,
        errorCount: 2,
        progress: 100,
        status: ImportBatchStatus.COMPLETED,
        uploadedByUserId: schedulerUserId!,
        startedAt: new Date('2025-08-27T14:00:00'),  // 27/08/2025
        completedAt: new Date('2025-08-27T14:01:00'),
        errors: [
          { row: 18, field: 'studentCount', message: 'Sĩ số vượt quá giới hạn (50). Tối đa 45.', value: '50' },
          { row: 21, field: 'name', message: 'Tên lớp bị trùng: 1A1 đã tồn tại.', value: '1A1' },
        ],
        conflictStrategy: 'skip',
      },
      {
        entityType: ImportEntityType.DEPARTMENT,
        fileName: 'ToBoMon_NBK_Sai.xlsx',
        fileSize: 8900,
        totalRows: 5,
        successCount: 0,
        errorCount: 5,
        progress: 100,
        status: ImportBatchStatus.FAILED,
        uploadedByUserId: adminUserId!,
        startedAt: new Date('2025-08-28T11:00:00'),  // 28/08/2025
        completedAt: new Date('2025-08-28T11:00:10'),
        errors: [
          { row: 1, field: 'name', message: 'Tên tổ bộ môn không được để trống.', value: '' },
          { row: 2, field: 'headTeacherId', message: 'Mã GV tổ trưởng không tồn tại: GV999.', value: 'GV999' },
        ],
        conflictStrategy: null,
      },
    ];

    for (const imp of importsData) {
      await importRepo.save({ schoolId, ...imp });
    }
    console.log(`  ✅ ${importsData.length} import batch records created`);
  }

  // Export Templates
  const exportRepo = dataSource.getRepository(ExportTemplateEntity);
  const existingExports = await exportRepo.count({ where: { schoolId } });
  if (existingExports === 0) {
    const templatesData = [
      {
        entityTarget: ExportEntityTarget.TEACHER,
        name: 'Danh sách GV chuẩn',
        description: 'Template xuất danh sách giáo viên đầy đủ thông tin',
        isDefault: true,
        fieldMappings: [
          { dbField: 'employeeCode', displayName: 'Mã NV', width: 12 },
          { dbField: 'fullName', displayName: 'Họ và Tên', width: 25 },
          { dbField: 'gender', displayName: 'Giới tính', width: 10, transform: 'enum_vi' },
          { dbField: 'teacherType', displayName: 'Loại GV', width: 15, transform: 'enum_vi' },
          { dbField: 'maxPeriodsPerWeek', displayName: 'Tối đa tiết/tuần', width: 15 },
          { dbField: 'status', displayName: 'Trạng thái', width: 12, transform: 'enum_vi' },
        ],
      },
      {
        entityTarget: ExportEntityTarget.CLASS,
        name: 'Danh sách lớp',
        description: 'Template xuất danh sách lớp kèm sĩ số',
        isDefault: true,
        fieldMappings: [
          { dbField: 'name', displayName: 'Tên lớp', width: 12 },
          { dbField: 'grade.name', displayName: 'Khối', width: 12 },
          { dbField: 'studentCount', displayName: 'Sĩ số', width: 10 },
          { dbField: 'status', displayName: 'Trạng thái', width: 12, transform: 'enum_vi' },
        ],
      },
      {
        entityTarget: ExportEntityTarget.DEPARTMENT,
        name: 'Danh sách tổ bộ môn',
        description: 'Template xuất tổ bộ môn và tổ trưởng',
        isDefault: true,
        fieldMappings: [
          { dbField: 'name', displayName: 'Tên tổ', width: 25 },
          { dbField: 'headTeacher.fullName', displayName: 'Tổ trưởng', width: 20 },
        ],
      },
    ];

    for (const t of templatesData) {
      await exportRepo.save({ schoolId, ...t });
    }
    console.log(`  ✅ ${templatesData.length} export templates created`);
  }

  // ═══════════════════════════════════════════════
  // 17. EMPLOYEE MASTER DATA (Hồ sơ nhân sự tổng)
  // ═══════════════════════════════════════════════
  console.log('👤 Seeding Employee Master Data...');

  const empRepo = dataSource.getRepository(EmployeeMasterEntity);
  const existingEmp = await empRepo.count({ where: { schoolId } });
  if (existingEmp === 0) {
    const empData = [
      { employeeCode: 'NBK-GV001', fullName: 'Nguyễn Thị Hồng', shortName: 'Hồng', gender: Gender.FEMALE, campusName: 'Cơ sở 1 - Tiểu học', gradeName: 'Khối 1', departmentName: 'Tổ Toán - Tin', jobTitle: 'Giáo viên Toán', managementLevel: 'TO_TRUONG', maxPeriodsPerWeek: 25, workingDays: 22 },
      { employeeCode: 'NBK-GV002', fullName: 'Trần Văn Minh', shortName: 'Minh', gender: Gender.MALE, campusName: 'Cơ sở 1 - Tiểu học', gradeName: 'Khối 2', departmentName: 'Tổ Toán - Tin', jobTitle: 'Giáo viên Toán', managementLevel: null, maxPeriodsPerWeek: 25, workingDays: 22 },
      { employeeCode: 'NBK-GV003', fullName: 'Lê Thị Thanh', shortName: 'Thanh', gender: Gender.FEMALE, campusName: 'Cơ sở 1 - Tiểu học', gradeName: 'Khối 1', departmentName: 'Tổ Ngữ văn - KHXH', jobTitle: 'Giáo viên Tiếng Việt', managementLevel: 'TO_TRUONG', maxPeriodsPerWeek: 25, workingDays: 22 },
      { employeeCode: 'NBK-GV004', fullName: 'Phạm Đức Hải', shortName: 'Hải', gender: Gender.MALE, campusName: 'Cơ sở 1 - Tiểu học', gradeName: 'Khối 3', departmentName: 'Tổ Ngữ văn - KHXH', jobTitle: 'Giáo viên Tiếng Việt', managementLevel: null, maxPeriodsPerWeek: 25, workingDays: 22 },
      { employeeCode: 'NBK-GV005', fullName: 'Hoàng Thị Mai', shortName: 'Mai', gender: Gender.FEMALE, campusName: 'Cơ sở 1 - Tiểu học', gradeName: 'Khối 4', departmentName: 'Tổ Khoa học Tự nhiên', jobTitle: 'Giáo viên TNXH/Khoa học', managementLevel: 'TO_TRUONG', maxPeriodsPerWeek: 25, workingDays: 22 },
      { employeeCode: 'NBK-GV017', fullName: 'Emily Johnson', shortName: 'Emily', gender: Gender.FEMALE, campusName: 'Cơ sở 1 - Tiểu học', gradeName: null, departmentName: 'Tổ Ngoại ngữ', jobTitle: 'Giáo viên Tiếng Anh (Native)', managementLevel: null, maxPeriodsPerWeek: 16, workingDays: 15 },
      { employeeCode: 'NBK-GV018', fullName: 'Yamada Kenji', shortName: 'Kenji', gender: Gender.MALE, campusName: 'Cơ sở 1 - Tiểu học', gradeName: null, departmentName: 'Tổ Ngoại ngữ', jobTitle: 'Giáo viên Tiếng Nhật', managementLevel: null, maxPeriodsPerWeek: 10, workingDays: 10 },
    ];

    for (const e of empData) {
      await empRepo.save({ schoolId, ...e, extendedFields: {} });
    }
    console.log(`  ✅ ${empData.length} employee master records created`);
  }

  // Field Definitions
  const fdRepo = dataSource.getRepository(FieldDefinitionEntity);
  const existingFD = await fdRepo.count({ where: { schoolId } });
  if (existingFD === 0) {
    const fieldsData = [
      { fieldName: 'employeeCode', dataType: FieldDataType.STRING, sourceModule: 'teacher', displayLabel: 'Mã nhân viên', isRequired: true, validationRules: { pattern: '^NBK-GV\\d{3}$' } },
      { fieldName: 'fullName', dataType: FieldDataType.STRING, sourceModule: 'teacher', displayLabel: 'Họ và tên', isRequired: true, validationRules: { minLength: 3, maxLength: 100 } },
      { fieldName: 'gender', dataType: FieldDataType.ENUM, sourceModule: 'teacher', displayLabel: 'Giới tính', isRequired: false, validationRules: { allowedValues: ['male', 'female', 'other'] } },
      { fieldName: 'maxPeriodsPerWeek', dataType: FieldDataType.NUMBER, sourceModule: 'teacher', displayLabel: 'Tối đa tiết/tuần', isRequired: true, validationRules: { min: 4, max: 30 } },
      { fieldName: 'workingDays', dataType: FieldDataType.NUMBER, sourceModule: 'attendance', displayLabel: 'Ngày công', isRequired: false, validationRules: { min: 0, max: 31 } },
    ];

    for (const f of fieldsData) {
      await fdRepo.save({ schoolId, ...f });
    }
    console.log(`  ✅ ${fieldsData.length} field definitions created`);
  }

  // ═══════════════════════════════════════════════
  // 18. JOB RECORDS (Lịch sử background jobs)
  // ═══════════════════════════════════════════════
  console.log('⚡ Seeding Job Records...');

  const jobRepo = dataSource.getRepository(JobRecordEntity);
  const existingJobs = await jobRepo.count({ where: { schoolId } });
  if (existingJobs === 0) {
    const jobsData = [
      {
        jobType: JobType.EXCEL_IMPORT,
        status: JobStatus.COMPLETED,
        progress: 100,
        bullJobId: 'excel-import-001',
        queueName: 'excel-import',
        payload: { fileName: 'DanhSachGV_NBK_TH_2025.xlsx', entityType: 'teacher', totalRows: 20 },
        result: { successCount: 20, errorCount: 0 },
        errorMessage: null,
        createdBy: adminUserId,
        attempts: 1, maxAttempts: 3,
        startedAt: new Date('2025-08-25T09:00:00'),   // 25/08/2025
        completedAt: new Date('2025-08-25T09:01:30'),
      },
      {
        jobType: JobType.TIMETABLE_GENERATION,
        status: JobStatus.COMPLETED,
        progress: 100,
        bullJobId: 'timetable-gen-001',
        queueName: 'timetable-generation',
        payload: { semesterId: semester1.id, schoolId, classes: 20, teachers: 20 },
        result: { versionId: 'generated-v1', totalSlots: 500, conflicts: 3 },
        errorMessage: null,
        createdBy: schedulerUserId,
        attempts: 1, maxAttempts: 3,
        startedAt: new Date('2025-08-28T15:00:00'),   // 28/08/2025
        completedAt: new Date('2025-08-28T15:02:45'),
      },
      {
        jobType: JobType.PDF_EXPORT,
        status: JobStatus.COMPLETED,
        progress: 100,
        bullJobId: 'pdf-export-001',
        queueName: 'pdf-export',
        payload: { type: 'timetable', classId: classesCreated[0].id, format: 'A4' },
        result: { fileUrl: '/exports/tkb_1A1_HK1_2025.pdf', fileSize: 156789 },
        errorMessage: null,
        createdBy: schedulerUserId,
        attempts: 1, maxAttempts: 3,
        startedAt: new Date('2025-09-02T10:00:00'),   // 02/09/2025
        completedAt: new Date('2025-09-02T10:00:15'),
      },
      {
        jobType: JobType.TIMETABLE_GENERATION,
        status: JobStatus.FAILED,
        progress: 45,
        bullJobId: 'timetable-gen-002',
        queueName: 'timetable-generation',
        payload: { semesterId: semester1.id, schoolId, classes: 20, teachers: 20, constraints: 'strict' },
        result: null,
        errorMessage: 'FET engine timeout sau 30 giây. Không tìm được lời giải với constraints hiện tại.',
        createdBy: schedulerUserId,
        attempts: 3, maxAttempts: 3,
        startedAt: new Date('2025-08-29T09:00:00'),   // 29/08/2025
        completedAt: new Date('2025-08-29T09:05:00'),
      },
      {
        jobType: JobType.EXCEL_EXPORT,
        status: JobStatus.ACTIVE,
        progress: 60,
        bullJobId: 'excel-export-001',
        queueName: 'excel-export',
        payload: { type: 'attendance_summary', month: 9, year: 2025 },
        result: null,
        errorMessage: null,
        createdBy: adminUserId,
        attempts: 1, maxAttempts: 3,
        startedAt: new Date('2025-10-01T08:00:00'),   // 01/10/2025
        completedAt: null,
      },
    ];

    for (const j of jobsData) {
      await jobRepo.save({ schoolId, ...j });
    }
    console.log(`  ✅ ${jobsData.length} job records created`);
  }

  // ═══════════════════════════════════════════════
  // 19. FEATURE FLAGS
  // ═══════════════════════════════════════════════
  console.log('🚩 Seeding Feature Flags...');

  const ffRepo = dataSource.getRepository(FeatureFlagEntity);
  const existingFF = await ffRepo.count({ where: { organizationId: schoolId } });
  if (existingFF === 0) {
    const flagsData = [
      { flagKey: 'timetable_auto_generation', enabled: true },
      { flagKey: 'attendance_qr_code', enabled: false },
      { flagKey: 'leave_request_workflow', enabled: true },
      { flagKey: 'period_swap_feature', enabled: true },
      { flagKey: 'compensation_module', enabled: false },
      { flagKey: 'calendar_sync_google', enabled: false },
      { flagKey: 'export_pdf_timetable', enabled: true },
      { flagKey: 'import_bulk_teachers', enabled: true },
      { flagKey: 'multi_campus_view', enabled: false },
      { flagKey: 'robotics_elective', enabled: true },
    ];

    for (const f of flagsData) {
      await ffRepo.save({ organizationId: schoolId, ...f });
    }
    console.log(`  ✅ ${flagsData.length} feature flags created`);
  }

  // ═══════════════════════════════════════════════
  // 20. AUDIT LOGS (Mẫu nhật ký hệ thống)
  // ═══════════════════════════════════════════════
  console.log('📝 Seeding Audit Logs...');

  const auditRepo = dataSource.getRepository(AuditLogEntity);
  const existingAudit = await auditRepo.count({ where: { schoolId } });
  if (existingAudit === 0) {
    const auditData = [
      {
        userId: adminUserId,
        action: AuditAction.LOGIN,
        entityType: 'user',
        entityId: adminUserId,
        changes: null,
        ipAddress: '192.168.1.100',
        userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        metadata: { loginMethod: 'password' },
      },
      {
        userId: adminUserId,
        action: AuditAction.CREATE,
        entityType: 'teacher',
        entityId: teachers[0].id,
        changes: { fullName: { old: null, new: 'Nguyễn Thị Hồng' }, employeeCode: { old: null, new: 'NBK-GV001' } },
        ipAddress: '192.168.1.100',
        userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        metadata: null,
      },
      {
        userId: adminUserId,
        action: AuditAction.IMPORT,
        entityType: 'teacher',
        entityId: null,
        changes: null,
        ipAddress: '192.168.1.100',
        userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        metadata: { fileName: 'DanhSachGV_NBK_TH_2025.xlsx', totalRows: 20, successCount: 20 },
      },
      {
        userId: schedulerUserId,
        action: AuditAction.CREATE,
        entityType: 'timetable_version',
        entityId: null,
        changes: { name: { old: null, new: 'TKB HK1 2025-2026 v1' }, status: { old: null, new: 'draft' } },
        ipAddress: '192.168.1.105',
        userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)',
        metadata: null,
      },
      {
        userId: schedulerUserId,
        action: AuditAction.PUBLISH,
        entityType: 'timetable_version',
        entityId: null,
        changes: { status: { old: 'generated', new: 'published' } },
        ipAddress: '192.168.1.105',
        userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)',
        metadata: { effectiveDate: '2025-09-01', notifiedTeachers: 20 },
      },
      {
        userId: adminUserId,
        action: AuditAction.UPDATE,
        entityType: 'teacher',
        entityId: teachers[14].id,
        changes: { status: { old: 'active', new: 'on_leave' } },
        ipAddress: '192.168.1.100',
        userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        metadata: { reason: 'Nghỉ thai sản từ 01/12/2025' },
      },
      {
        userId: null,
        action: AuditAction.LOGIN_FAILED,
        entityType: 'user',
        entityId: null,
        changes: null,
        ipAddress: '10.0.0.55',
        userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0)',
        metadata: { email: 'hacker@test.com', reason: 'Invalid credentials' },
      },
    ];

    for (const a of auditData) {
      await auditRepo.save({ schoolId, ...a });
    }
    console.log(`  ✅ ${auditData.length} audit log entries created`);
  }

  // ═══════════════════════════════════════════════
  // DONE
  // ═══════════════════════════════════════════════
  console.log('');
  console.log('═══════════════════════════════════════════════');
  console.log('🎉 Comprehensive seed completed successfully!');
  console.log('═══════════════════════════════════════════════');
  console.log('');
  console.log('📊 Dữ liệu đã tạo:');
  console.log('  • 1 Năm học 2025-2026 + 2 Học kỳ + 18 Tuần');
  console.log('  • 2 Ca học (sáng/chiều) + 9 Tiết học');
  console.log('  • 5 Khối + 20 Lớp (4 lớp/khối)');
  console.log('  • 5 Nhóm môn + 15 Môn học + Subject-Grade mappings');
  console.log('  • 14 Phòng học (standard, lab, music, art, gym)');
  console.log('  • 20 Giáo viên + 21 Teacher-Subject competencies');
  console.log('  • 5 Tổ bộ môn + Thành viên + Chức vụ');
  console.log('  • 20 Teacher-School Assignments');
  console.log('  • 8 Sự kiện (lễ, nghỉ, thi, họp)');
  console.log('  • 6 Đơn xin nghỉ phép (các trạng thái)');
  console.log('  • 3 Yêu cầu đổi tiết (các trạng thái)');
  console.log('  • 2 Chương trình học (Khối 1 + Khối 4) + Items');
  console.log('  • 8 Ràng buộc TKB');
  console.log('  • 7 Validation Rules');
  console.log('  • 25 Attendance records + 8 Monthly summaries');
  console.log('  • 4 Import batches + 3 Export templates');
  console.log('  • 7 Employee Master records + 5 Field definitions');
  console.log('  • 5 Job records (completed, failed, active)');
  console.log('  • 10 Feature flags');
  console.log('  • 7 Audit log entries');
  console.log('');
  console.log('📅 Format ngày: dd/mm/yyyy');
  console.log('   Ví dụ: 01/09/2025 = Khai giảng');
  console.log('          20/11/2025 = Ngày Nhà giáo');
  console.log('          25/01/2026 = Nghỉ Tết Nguyên đán');
  console.log('');
}
