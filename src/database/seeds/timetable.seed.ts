import { DataSource } from 'typeorm';
import { TimetableVersionEntity } from '../../modules/timetable/entities/timetable-version.entity';
import { TimetableSlotEntity } from '../../modules/timetable/entities/timetable-slot.entity';
import { TimetableVersionStatus } from '../../common/enums/status.enum';
import { AcademicYearEntity } from '../../modules/academic/entities/academic-year.entity';
import { SemesterEntity } from '../../modules/academic/entities/semester.entity';
import { SessionEntity } from '../../modules/academic/entities/session.entity';
import { PeriodDefinitionEntity } from '../../modules/academic/entities/period-definition.entity';
import { GradeEntity } from '../../modules/class/entities/grade.entity';
import { ClassEntity } from '../../modules/class/entities/class.entity';
import { TeacherEntity } from '../../modules/teacher/entities/teacher.entity';
import { SubjectEntity } from '../../modules/subject/entities/subject.entity';
import { RoomEntity } from '../../modules/room/entities/room.entity';
import { SchoolEntity } from '../../modules/school/entities/school.entity';
import {
  AcademicStatus,
  EntityStatus,
  TeacherStatus,
  TeacherType,
  Gender,
  SubjectType,
  RoomType,
  RoomStatus,
} from '../../common/enums/status.enum';

export async function seedTimetable(dataSource: DataSource): Promise<void> {
  console.log('🕐 Seeding timetable data...');

  const versionRepo = dataSource.getRepository(TimetableVersionEntity);
  const slotRepo = dataSource.getRepository(TimetableSlotEntity);
  const schoolRepo = dataSource.getRepository(SchoolEntity);
  const academicYearRepo = dataSource.getRepository(AcademicYearEntity);
  const semesterRepo = dataSource.getRepository(SemesterEntity);
  const sessionRepo = dataSource.getRepository(SessionEntity);
  const periodRepo = dataSource.getRepository(PeriodDefinitionEntity);
  const gradeRepo = dataSource.getRepository(GradeEntity);
  const classRepo = dataSource.getRepository(ClassEntity);
  const teacherRepo = dataSource.getRepository(TeacherEntity);
  const subjectRepo = dataSource.getRepository(SubjectEntity);
  const roomRepo = dataSource.getRepository(RoomEntity);

  // Check if timetable version already exists (idempotent)
  const existingVersion = await versionRepo.findOne({
    where: { name: 'TKB Nháp - HK1 2024-2025' },
  });
  if (existingVersion) {
    console.log('⏭️  Timetable seed data already exists, skipping...');
    return;
  }

  // --- Find or create prerequisite data ---

  // School
  const school = await schoolRepo
    .createQueryBuilder('school')
    .withDeleted()
    .where('school.code = :code', { code: 'TH01' })
    .getOne();
  if (!school) {
    console.log('⚠️  School TH01 not found. Please run base seed first.');
    return;
  }

  // Academic Year
  let academicYear = await academicYearRepo.findOne({
    where: { schoolId: school.id, name: 'Năm học 2024-2025' },
  });
  if (!academicYear) {
    academicYear = await academicYearRepo.save({
      schoolId: school.id,
      name: 'Năm học 2024-2025',
      startDate: '2024-09-05',
      endDate: '2025-05-31',
      isCurrent: true,
      status: AcademicStatus.ACTIVE,
    });
  }

  // Semester
  let semester = await semesterRepo.findOne({
    where: { academicYearId: academicYear.id, semesterNumber: 1 },
  });
  if (!semester) {
    semester = await semesterRepo.save({
      academicYearId: academicYear.id,
      name: 'Học kỳ 1',
      semesterNumber: 1,
      startDate: '2024-09-05',
      endDate: '2025-01-15',
      status: AcademicStatus.ACTIVE,
    });
  }

  // Session (Ca sáng)
  let session = await sessionRepo.findOne({
    where: { schoolId: school.id, name: 'Ca sáng' },
  });
  if (!session) {
    session = await sessionRepo.save({
      schoolId: school.id,
      name: 'Ca sáng',
      startTime: '07:00',
      endTime: '11:30',
      sortOrder: 1,
    });
  }

  // Period Definitions (5 tiết sáng)
  const periodData = [
    {
      periodNumber: 1,
      startTime: '07:00',
      endTime: '07:45',
      isBreak: false,
      isExtra: false,
    },
    {
      periodNumber: 2,
      startTime: '07:50',
      endTime: '08:35',
      isBreak: false,
      isExtra: false,
    },
    {
      periodNumber: 3,
      startTime: '08:50',
      endTime: '09:35',
      isBreak: false,
      isExtra: false,
    },
    {
      periodNumber: 4,
      startTime: '09:40',
      endTime: '10:25',
      isBreak: false,
      isExtra: false,
    },
    {
      periodNumber: 5,
      startTime: '10:30',
      endTime: '11:15',
      isBreak: false,
      isExtra: false,
    },
  ];

  const periods: PeriodDefinitionEntity[] = [];
  for (const pd of periodData) {
    let period = await periodRepo.findOne({
      where: {
        schoolId: school.id,
        sessionId: session.id,
        periodNumber: pd.periodNumber,
      },
    });
    if (!period) {
      period = await periodRepo.save({
        schoolId: school.id,
        sessionId: session.id,
        ...pd,
      });
    }
    periods.push(period);
  }

  // Grade (Khối 10)
  let grade = await gradeRepo.findOne({
    where: { schoolId: school.id, name: 'Khối 10' },
  });
  if (!grade) {
    grade = await gradeRepo.save({
      schoolId: school.id,
      name: 'Khối 10',
      level: 10,
    });
  }

  // Class (10A1)
  let classEntity = await classRepo.findOne({
    where: { schoolId: school.id, name: '10A1' },
  });
  if (!classEntity) {
    classEntity = await classRepo.save({
      schoolId: school.id,
      gradeId: grade.id,
      academicYearId: academicYear.id,
      name: '10A1',
      studentCount: 35,
      status: EntityStatus.ACTIVE,
    });
  }

  // Teachers
  const teacherData = [
    {
      employeeCode: 'GV001',
      fullName: 'Nguyễn Thị Mai',
      shortName: 'Mai',
      gender: Gender.FEMALE,
    },
    {
      employeeCode: 'GV002',
      fullName: 'Trần Văn Hùng',
      shortName: 'Hùng',
      gender: Gender.MALE,
    },
    {
      employeeCode: 'GV003',
      fullName: 'Lê Thị Hoa',
      shortName: 'Hoa',
      gender: Gender.FEMALE,
    },
    {
      employeeCode: 'GV004',
      fullName: 'Phạm Minh Tuấn',
      shortName: 'Tuấn',
      gender: Gender.MALE,
    },
    {
      employeeCode: 'GV005',
      fullName: 'Võ Thị Lan',
      shortName: 'Lan',
      gender: Gender.FEMALE,
    },
  ];

  const teachers: TeacherEntity[] = [];
  for (const td of teacherData) {
    let teacher = await teacherRepo
      .createQueryBuilder('teacher')
      .withDeleted()
      .where('teacher.employee_code = :code', { code: td.employeeCode })
      .getOne();
    if (!teacher) {
      teacher = await teacherRepo.save({
        schoolId: school.id,
        employeeCode: td.employeeCode,
        fullName: td.fullName,
        shortName: td.shortName,
        gender: td.gender,
        teacherType: TeacherType.FULL_TIME,
        maxPeriodsPerWeek: 20,
        minPeriodsPerWeek: 12,
        maxPeriodsPerDay: 5,
        status: TeacherStatus.ACTIVE,
      });
    }
    teachers.push(teacher);
  }

  // Subjects
  const subjectData = [
    {
      code: 'TOAN',
      name: 'Toán học',
      shortName: 'Toán',
      periodsPerWeek: 4,
      colorCode: '#FF6B6B',
    },
    {
      code: 'VAN',
      name: 'Ngữ văn',
      shortName: 'Văn',
      periodsPerWeek: 3,
      colorCode: '#4ECDC4',
    },
    {
      code: 'ANH',
      name: 'Tiếng Anh',
      shortName: 'Anh',
      periodsPerWeek: 3,
      colorCode: '#45B7D1',
    },
    {
      code: 'LY',
      name: 'Vật lý',
      shortName: 'Lý',
      periodsPerWeek: 2,
      colorCode: '#96CEB4',
    },
    {
      code: 'HOA',
      name: 'Hóa học',
      shortName: 'Hóa',
      periodsPerWeek: 2,
      colorCode: '#FFEAA7',
    },
  ];

  const subjects: SubjectEntity[] = [];
  for (const sd of subjectData) {
    let subject = await subjectRepo.findOne({
      where: { schoolId: school.id, code: sd.code },
    });
    if (!subject) {
      subject = await subjectRepo.save({
        schoolId: school.id,
        code: sd.code,
        name: sd.name,
        shortName: sd.shortName,
        subjectType: SubjectType.REQUIRED,
        periodsPerWeek: sd.periodsPerWeek,
        requiresRoomType: RoomType.STANDARD,
        colorCode: sd.colorCode,
        isDoublePeriod: false,
      });
    }
    subjects.push(subject);
  }

  // Rooms
  const roomData = [
    { code: 'P101', name: 'Phòng 101', building: 'Nhà A', floor: 1 },
    { code: 'P102', name: 'Phòng 102', building: 'Nhà A', floor: 1 },
    { code: 'P201', name: 'Phòng 201', building: 'Nhà A', floor: 2 },
  ];

  const rooms: RoomEntity[] = [];
  for (const rd of roomData) {
    let room = await roomRepo.findOne({
      where: { schoolId: school.id, code: rd.code },
    });
    if (!room) {
      room = await roomRepo.save({
        schoolId: school.id,
        code: rd.code,
        name: rd.name,
        building: rd.building,
        floor: rd.floor,
        capacity: 40,
        roomType: RoomType.STANDARD,
        status: RoomStatus.AVAILABLE,
      });
    }
    rooms.push(room);
  }

  // --- Create Timetable Version ---
  const version = await versionRepo.save({
    schoolId: school.id,
    semesterId: semester.id,
    name: 'TKB Nháp - HK1 2024-2025',
    versionNumber: 1,
    status: TimetableVersionStatus.DRAFT,
    effectiveDate: null,
    publishedAt: null,
    publishedBy: null,
    note: 'Bản nháp thời khóa biểu học kỳ 1 năm học 2024-2025',
  });

  console.log('✅ Timetable version created:', version.name);

  // --- Create Timetable Slots ---
  // Lịch mẫu lớp 10A1: Thứ 2 - Thứ 6, 5 tiết/ngày
  // dayOfWeek: 2=Thứ 2, 3=Thứ 3, 4=Thứ 4, 5=Thứ 5, 6=Thứ 6
  // Teacher mapping: Mai=Toán, Hùng=Văn, Hoa=Anh, Tuấn=Lý, Lan=Hóa
  const slotSchedule: Array<{
    dayOfWeek: number;
    periodIndex: number;
    teacherIndex: number;
    subjectIndex: number;
    roomIndex: number;
    isDoublePeriod: boolean;
  }> = [
    // Thứ 2 (Monday)
    {
      dayOfWeek: 2,
      periodIndex: 0,
      teacherIndex: 0,
      subjectIndex: 0,
      roomIndex: 0,
      isDoublePeriod: false,
    }, // Tiết 1: Toán - Cô Mai
    {
      dayOfWeek: 2,
      periodIndex: 1,
      teacherIndex: 0,
      subjectIndex: 0,
      roomIndex: 0,
      isDoublePeriod: false,
    }, // Tiết 2: Toán - Cô Mai
    {
      dayOfWeek: 2,
      periodIndex: 2,
      teacherIndex: 1,
      subjectIndex: 1,
      roomIndex: 0,
      isDoublePeriod: false,
    }, // Tiết 3: Văn - Thầy Hùng
    {
      dayOfWeek: 2,
      periodIndex: 3,
      teacherIndex: 2,
      subjectIndex: 2,
      roomIndex: 0,
      isDoublePeriod: false,
    }, // Tiết 4: Anh - Cô Hoa
    {
      dayOfWeek: 2,
      periodIndex: 4,
      teacherIndex: 3,
      subjectIndex: 3,
      roomIndex: 0,
      isDoublePeriod: false,
    }, // Tiết 5: Lý - Thầy Tuấn

    // Thứ 3 (Tuesday)
    {
      dayOfWeek: 3,
      periodIndex: 0,
      teacherIndex: 1,
      subjectIndex: 1,
      roomIndex: 1,
      isDoublePeriod: false,
    }, // Tiết 1: Văn - Thầy Hùng
    {
      dayOfWeek: 3,
      periodIndex: 1,
      teacherIndex: 2,
      subjectIndex: 2,
      roomIndex: 1,
      isDoublePeriod: false,
    }, // Tiết 2: Anh - Cô Hoa
    {
      dayOfWeek: 3,
      periodIndex: 2,
      teacherIndex: 4,
      subjectIndex: 4,
      roomIndex: 1,
      isDoublePeriod: false,
    }, // Tiết 3: Hóa - Cô Lan
    {
      dayOfWeek: 3,
      periodIndex: 3,
      teacherIndex: 0,
      subjectIndex: 0,
      roomIndex: 1,
      isDoublePeriod: false,
    }, // Tiết 4: Toán - Cô Mai
    {
      dayOfWeek: 3,
      periodIndex: 4,
      teacherIndex: 3,
      subjectIndex: 3,
      roomIndex: 1,
      isDoublePeriod: false,
    }, // Tiết 5: Lý - Thầy Tuấn

    // Thứ 4 (Wednesday)
    {
      dayOfWeek: 4,
      periodIndex: 0,
      teacherIndex: 2,
      subjectIndex: 2,
      roomIndex: 2,
      isDoublePeriod: false,
    }, // Tiết 1: Anh - Cô Hoa
    {
      dayOfWeek: 4,
      periodIndex: 1,
      teacherIndex: 0,
      subjectIndex: 0,
      roomIndex: 2,
      isDoublePeriod: false,
    }, // Tiết 2: Toán - Cô Mai
    {
      dayOfWeek: 4,
      periodIndex: 2,
      teacherIndex: 1,
      subjectIndex: 1,
      roomIndex: 2,
      isDoublePeriod: false,
    }, // Tiết 3: Văn - Thầy Hùng

    // Thứ 5 (Thursday)
    {
      dayOfWeek: 5,
      periodIndex: 0,
      teacherIndex: 4,
      subjectIndex: 4,
      roomIndex: 0,
      isDoublePeriod: false,
    }, // Tiết 1: Hóa - Cô Lan
    {
      dayOfWeek: 5,
      periodIndex: 1,
      teacherIndex: 0,
      subjectIndex: 0,
      roomIndex: 0,
      isDoublePeriod: false,
    }, // Tiết 2: Toán - Cô Mai (đôi)
    {
      dayOfWeek: 5,
      periodIndex: 2,
      teacherIndex: 3,
      subjectIndex: 3,
      roomIndex: 0,
      isDoublePeriod: false,
    }, // Tiết 3: Lý - Thầy Tuấn

    // Thứ 6 (Friday)
    {
      dayOfWeek: 6,
      periodIndex: 0,
      teacherIndex: 1,
      subjectIndex: 1,
      roomIndex: 1,
      isDoublePeriod: false,
    }, // Tiết 1: Văn - Thầy Hùng (đôi - kết hợp)
    {
      dayOfWeek: 6,
      periodIndex: 1,
      teacherIndex: 4,
      subjectIndex: 4,
      roomIndex: 1,
      isDoublePeriod: false,
    }, // Tiết 2: Hóa - Cô Lan
    {
      dayOfWeek: 6,
      periodIndex: 2,
      teacherIndex: 2,
      subjectIndex: 2,
      roomIndex: 1,
      isDoublePeriod: false,
    }, // Tiết 3: Anh - Cô Hoa (đôi - kết hợp)
  ];

  const slotsToInsert = slotSchedule.map((slot) => ({
    schoolId: school.id,
    versionId: version.id,
    dayOfWeek: slot.dayOfWeek,
    periodId: periods[slot.periodIndex].id,
    classId: classEntity.id,
    teacherId: teachers[slot.teacherIndex].id,
    subjectId: subjects[slot.subjectIndex].id,
    roomId: rooms[slot.roomIndex].id,
    isDoublePeriod: slot.isDoublePeriod,
  }));

  await slotRepo.save(slotsToInsert);

  console.log(
    `✅ ${slotsToInsert.length} timetable slots created for class 10A1`,
  );
  console.log('🎉 Timetable seed completed!');
}
