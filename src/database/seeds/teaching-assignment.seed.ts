import { DataSource } from 'typeorm';
import { TeachingAssignmentEntity } from '../../modules/teaching-assignment/entities/teaching-assignment.entity';
import { TeacherEntity } from '../../modules/teacher/entities/teacher.entity';
import { SubjectEntity } from '../../modules/subject/entities/subject.entity';
import { ClassEntity } from '../../modules/class/entities/class.entity';
import { SemesterEntity } from '../../modules/academic/entities/semester.entity';
import { AcademicYearEntity } from '../../modules/academic/entities/academic-year.entity';
import { SchoolEntity } from '../../modules/school/entities/school.entity';

interface AssignmentSeedData {
  teacherCode: string;
  subjectCode: string;
  periodsPerWeek: number;
  note: string | null;
}

export async function seedTeachingAssignments(
  dataSource: DataSource,
): Promise<void> {
  console.log('📋 Seeding teaching assignment data...');

  const assignmentRepo = dataSource.getRepository(TeachingAssignmentEntity);
  const teacherRepo = dataSource.getRepository(TeacherEntity);
  const subjectRepo = dataSource.getRepository(SubjectEntity);
  const classRepo = dataSource.getRepository(ClassEntity);
  const semesterRepo = dataSource.getRepository(SemesterEntity);
  const academicYearRepo = dataSource.getRepository(AcademicYearEntity);
  const schoolRepo = dataSource.getRepository(SchoolEntity);

  // Check idempotency - look for existing teaching assignments
  const existingCount = await assignmentRepo.count();
  if (existingCount > 0) {
    console.log(
      '⏭️  Teaching assignment seed data already exists, skipping...',
    );
    return;
  }

  // Find prerequisite data
  const school = await schoolRepo.findOne({ where: { code: 'TH01' } });
  if (!school) {
    console.log('⚠️  School TH01 not found. Please run base seed first.');
    return;
  }

  const academicYear = await academicYearRepo.findOne({
    where: { schoolId: school.id, name: 'Năm học 2024-2025' },
  });
  if (!academicYear) {
    console.log(
      '⚠️  Academic year 2024-2025 not found. Please run timetable seed first.',
    );
    return;
  }

  const semester = await semesterRepo.findOne({
    where: { academicYearId: academicYear.id, semesterNumber: 1 },
  });
  if (!semester) {
    console.log('⚠️  Semester HK1 not found. Please run timetable seed first.');
    return;
  }

  const classEntity = await classRepo.findOne({
    where: { schoolId: school.id, name: '10A1' },
  });
  if (!classEntity) {
    console.log('⚠️  Class 10A1 not found. Please run timetable seed first.');
    return;
  }

  // Assignment data: Teacher → Subject mapping for class 10A1
  const assignmentData: AssignmentSeedData[] = [
    {
      teacherCode: 'GV001',
      subjectCode: 'TOAN',
      periodsPerWeek: 4,
      note: 'Mai → Toán',
    },
    {
      teacherCode: 'GV002',
      subjectCode: 'VAN',
      periodsPerWeek: 3,
      note: 'Hùng → Văn',
    },
    {
      teacherCode: 'GV003',
      subjectCode: 'ANH',
      periodsPerWeek: 3,
      note: 'Hoa → Anh',
    },
    {
      teacherCode: 'GV004',
      subjectCode: 'LY',
      periodsPerWeek: 2,
      note: 'Tuấn → Lý',
    },
    {
      teacherCode: 'GV005',
      subjectCode: 'HOA',
      periodsPerWeek: 2,
      note: 'Lan → Hóa',
    },
  ];

  for (const data of assignmentData) {
    const teacher = await teacherRepo.findOne({
      where: { employeeCode: data.teacherCode },
    });
    if (!teacher) {
      console.log(`⚠️  Teacher ${data.teacherCode} not found, skipping...`);
      continue;
    }

    const subject = await subjectRepo.findOne({
      where: { schoolId: school.id, code: data.subjectCode },
    });
    if (!subject) {
      console.log(`⚠️  Subject ${data.subjectCode} not found, skipping...`);
      continue;
    }

    // Check for duplicate before inserting (idempotent)
    const existing = await assignmentRepo.findOne({
      where: {
        semesterId: semester.id,
        teacherId: teacher.id,
        classId: classEntity.id,
        subjectId: subject.id,
      },
    });

    if (existing) {
      console.log(
        `⏭️  Assignment ${data.teacherCode} → ${data.subjectCode} already exists, skipping...`,
      );
      continue;
    }

    await assignmentRepo.save({
      semesterId: semester.id,
      teacherId: teacher.id,
      classId: classEntity.id,
      subjectId: subject.id,
      periodsPerWeek: data.periodsPerWeek,
      note: data.note,
    });

    console.log(
      `✅ Assignment: ${teacher.shortName || teacher.fullName} → ${subject.shortName || subject.name} (${data.periodsPerWeek} tiết/tuần)`,
    );
  }

  console.log('🎉 Teaching assignment seed completed!');
}
