import * as fc from 'fast-check';
import {
  NotFoundException,
  BadRequestException,
  ConflictException,
} from '@nestjs/common';
import { TeacherSubjectService } from './teacher-subject.service';
import { TeacherSubjectRepository } from './teacher-subject.repository';
import { TeacherRepository } from './teacher.repository';
import { TeacherSubjectEntity } from './entities/teacher-subject.entity';
import { TeacherEntity } from './entities/teacher.entity';
import { SubjectEntity } from '../subject/entities/subject.entity';
import {
  TeacherStatus,
  TeacherType,
  SubjectType,
  RoomType,
} from '../../common/enums/status.enum';

// --- In-memory store for simulating database behavior ---

interface InMemoryStore {
  teachers: TeacherEntity[];
  subjects: SubjectEntity[];
  links: TeacherSubjectEntity[];
}

function createStore(): InMemoryStore {
  return { teachers: [], subjects: [], links: [] };
}

function buildTeacher(id: string, schoolId: string): TeacherEntity {
  return {
    id,
    schoolId,
    employeeCode: `GV-${id.slice(0, 4)}`,
    fullName: `Teacher ${id.slice(0, 4)}`,
    shortName: null,
    gender: null,
    dateOfBirth: null,
    phone: null,
    email: null,
    citizenId: null,
    gradeId: null,
    grade: undefined as never,
    departmentId: null,
    department: undefined as never,
    jobTitle: null,
    managementLevel: null,
    position: null,
    teacherType: TeacherType.FULL_TIME,
    maxPeriodsPerWeek: 20,
    minPeriodsPerWeek: 0,
    maxPeriodsPerDay: 6,
    unavailableSlots: null,
    status: TeacherStatus.ACTIVE,
    createdAt: new Date(),
    updatedAt: new Date(),
    deletedAt: null,
    createdBy: null,
    updatedBy: null,
    version: 1,
    school: undefined as never,
  };
}

function buildSubject(id: string, schoolId: string): SubjectEntity {
  return {
    id,
    schoolId,
    code: `SUB-${id.slice(0, 4)}`,
    name: `Subject ${id.slice(0, 4)}`,
    shortName: null,
    subjectType: SubjectType.REQUIRED,
    periodsPerWeek: 4,
    requiresRoomType: RoomType.STANDARD,
    colorCode: null,
    isDoublePeriod: false,
    subjectGrades: [],
    createdAt: new Date(),
    updatedAt: new Date(),
    deletedAt: null,
    createdBy: null,
    updatedBy: null,
    version: 1,
    school: undefined as never,
  };
}

/**
 * Build mock dependencies that operate on an in-memory store,
 * allowing the service to function as if connected to a real database.
 */
function buildMocks(store: InMemoryStore) {
  let linkIdCounter = 0;

  const teacherRepository = {
    findById: jest.fn(async (id: string) => {
      return store.teachers.find((t) => t.id === id && !t.deletedAt) ?? null;
    }),
    findByIdInternal: jest.fn(async (id: string) => {
      return store.teachers.find((t) => t.id === id && !t.deletedAt) ?? null;
    }),
  } as unknown as TeacherRepository;

  const teacherSubjectRepository = {
    findByTeacherId: jest.fn(async (teacherId: string) => {
      return store.links.filter(
        (l) => l.teacherId === teacherId && !l.deletedAt,
      );
    }),
    findByTeacherIds: jest.fn(async (teacherIds: string[]) => {
      return store.links.filter(
        (l) => teacherIds.includes(l.teacherId) && !l.deletedAt,
      );
    }),
    findOne: jest.fn(async (teacherId: string, subjectId: string) => {
      return (
        store.links.find(
          (l) =>
            l.teacherId === teacherId &&
            l.subjectId === subjectId &&
            !l.deletedAt,
        ) ?? null
      );
    }),
    findById: jest.fn(async (id: string) => {
      return store.links.find((l) => l.id === id && !l.deletedAt) ?? null;
    }),
    create: jest.fn(async (data: Partial<TeacherSubjectEntity>) => {
      const entity: TeacherSubjectEntity = {
        id: `link-${++linkIdCounter}`,
        teacherId: data.teacherId!,
        subjectId: data.subjectId!,
        createdAt: new Date(),
        updatedAt: new Date(),
        deletedAt: null,
        createdBy: null,
        updatedBy: null,
        version: 1,
        teacher: undefined as never,
        subject:
          store.subjects.find((s) => s.id === data.subjectId) ??
          (undefined as never),
      };
      store.links.push(entity);
      return entity;
    }),
    softDelete: jest.fn(async (id: string) => {
      const link = store.links.find((l) => l.id === id);
      if (link) {
        link.deletedAt = new Date();
      }
    }),
  } as unknown as TeacherSubjectRepository;

  // DataSource.transaction mock: executes callback with a fake manager
  // that operates on the same in-memory store
  const dataSource = {
    transaction: jest.fn(async (cb: (manager: unknown) => Promise<unknown>) => {
      const fakeManager = {
        findOne: jest.fn(
          async (
            entityClass: unknown,
            options: { where: Record<string, unknown> },
          ) => {
            if (entityClass === SubjectEntity) {
              return (
                store.subjects.find(
                  (s) => s.id === options.where.id && !s.deletedAt,
                ) ?? null
              );
            }
            if (entityClass === TeacherSubjectEntity) {
              return (
                store.links.find(
                  (l) =>
                    l.teacherId === options.where.teacherId &&
                    l.subjectId === options.where.subjectId &&
                    !l.deletedAt,
                ) ?? null
              );
            }
            return null;
          },
        ),
        create: jest.fn(
          (_entityClass: unknown, data: Partial<TeacherSubjectEntity>) => ({
            ...data,
          }),
        ),
        save: jest.fn(async (data: Partial<TeacherSubjectEntity>) => {
          const entity: TeacherSubjectEntity = {
            id: `link-${++linkIdCounter}`,
            teacherId: data.teacherId!,
            subjectId: data.subjectId!,
            createdAt: new Date(),
            updatedAt: new Date(),
            deletedAt: null,
            createdBy: null,
            updatedBy: null,
            version: 1,
            teacher: undefined as never,
            subject:
              store.subjects.find((s) => s.id === data.subjectId) ??
              (undefined as never),
          };
          store.links.push(entity);
          return entity;
        }),
      };
      return cb(fakeManager);
    }),
  };

  return { teacherRepository, teacherSubjectRepository, dataSource };
}

// --- Arbitraries ---

// eslint-disable-next-line @typescript-eslint/no-unused-vars
const uuidArb = fc.uuid().map((u) => u);

const schoolIdArb = fc.constantFrom(
  'school-aaa-001',
  'school-bbb-002',
  'school-ccc-003',
);

// --- Property Tests ---

describe('TeacherSubjectService - Property Tests', () => {
  // Feature: giao-vien-mon-hoc, Property 1: Gán môn học làm tăng và chứa đúng danh sách môn học của giáo viên
  // **Validates: Requirements 1.1, 1.2**
  describe('Property 1: Gán môn học làm tăng và chứa đúng danh sách môn học của giáo viên', () => {
    it('should increase the teacher subject list by exactly N after assigning N valid subjects', async () => {
      await fc.assert(
        fc.asyncProperty(
          schoolIdArb,
          fc.integer({ min: 1, max: 10 }),
          async (schoolId, numSubjects) => {
            // Setup
            const store = createStore();
            const teacherId = `teacher-prop1-${schoolId}`;
            store.teachers.push(buildTeacher(teacherId, schoolId));

            // Generate N unique subjects in the same school
            const subjectIds: string[] = [];
            for (let i = 0; i < numSubjects; i++) {
              const subjectId = `subject-prop1-${i}-${schoolId}`;
              store.subjects.push(buildSubject(subjectId, schoolId));
              subjectIds.push(subjectId);
            }

            const { teacherRepository, teacherSubjectRepository, dataSource } =
              buildMocks(store);
            const service = new TeacherSubjectService(
              teacherSubjectRepository,
              teacherRepository,
              dataSource as never,
            );

            // Count before
            const beforeLinks = store.links.filter(
              (l) => l.teacherId === teacherId && !l.deletedAt,
            );
            const countBefore = beforeLinks.length;

            // Act
            const result = await service.assignSubjects(teacherId, subjectIds);

            // Assert: result contains exactly N items
            expect(result).toHaveLength(numSubjects);

            // Assert: store links increased by exactly N
            const afterLinks = store.links.filter(
              (l) => l.teacherId === teacherId && !l.deletedAt,
            );
            expect(afterLinks.length).toBe(countBefore + numSubjects);

            // Assert: all assigned subject IDs are present
            const assignedSubjectIds = afterLinks.map((l) => l.subjectId);
            for (const sid of subjectIds) {
              expect(assignedSubjectIds).toContain(sid);
            }
          },
        ),
        { numRuns: 100 },
      );
    });
  });

  // Feature: giao-vien-mon-hoc, Property 2: Chống trùng lặp liên kết Teacher-Subject
  // **Validates: Requirements 1.3**
  describe('Property 2: Chống trùng lặp liên kết Teacher-Subject', () => {
    it('should reject duplicate assignment with ConflictException and keep link count at 1', async () => {
      await fc.assert(
        fc.asyncProperty(schoolIdArb, async (schoolId) => {
          // Setup
          const store = createStore();
          const teacherId = `teacher-prop2-${schoolId}`;
          const subjectId = `subject-prop2-${schoolId}`;
          store.teachers.push(buildTeacher(teacherId, schoolId));
          store.subjects.push(buildSubject(subjectId, schoolId));

          const { teacherRepository, teacherSubjectRepository, dataSource } =
            buildMocks(store);
          const service = new TeacherSubjectService(
            teacherSubjectRepository,
            teacherRepository,
            dataSource as never,
          );

          // First assignment should succeed
          await service.assignSubjects(teacherId, [subjectId]);

          // Verify exactly 1 active link exists
          const linksAfterFirst = store.links.filter(
            (l) =>
              l.teacherId === teacherId &&
              l.subjectId === subjectId &&
              !l.deletedAt,
          );
          expect(linksAfterFirst).toHaveLength(1);

          // Second assignment should throw ConflictException
          await expect(
            service.assignSubjects(teacherId, [subjectId]),
          ).rejects.toThrow(ConflictException);

          // Link count should still be exactly 1
          const linksAfterSecond = store.links.filter(
            (l) =>
              l.teacherId === teacherId &&
              l.subjectId === subjectId &&
              !l.deletedAt,
          );
          expect(linksAfterSecond).toHaveLength(1);
        }),
        { numRuns: 100 },
      );
    });
  });

  // Feature: giao-vien-mon-hoc, Property 3: Ràng buộc cùng trường (School_Scope)
  // **Validates: Requirements 2.1**
  describe('Property 3: Ràng buộc cùng trường (School_Scope)', () => {
    it('should reject assignment when teacher and subject belong to different schools, creating no links', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.tuple(schoolIdArb, schoolIdArb).filter(([a, b]) => a !== b),
          async ([teacherSchoolId, subjectSchoolId]) => {
            // Setup: teacher in school A, subject in school B
            const store = createStore();
            const teacherId = `teacher-prop3-${teacherSchoolId}`;
            const subjectId = `subject-prop3-${subjectSchoolId}`;
            store.teachers.push(buildTeacher(teacherId, teacherSchoolId));
            store.subjects.push(buildSubject(subjectId, subjectSchoolId));

            const { teacherRepository, teacherSubjectRepository, dataSource } =
              buildMocks(store);
            const service = new TeacherSubjectService(
              teacherSubjectRepository,
              teacherRepository,
              dataSource as never,
            );

            // Count links before
            const countBefore = store.links.filter((l) => !l.deletedAt).length;

            // Act: should throw BadRequestException
            await expect(
              service.assignSubjects(teacherId, [subjectId]),
            ).rejects.toThrow(BadRequestException);

            // Assert: no new links were created
            const countAfter = store.links.filter((l) => !l.deletedAt).length;
            expect(countAfter).toBe(countBefore);
          },
        ),
        { numRuns: 100 },
      );
    });
  });

  // Feature: giao-vien-mon-hoc, Property 4: Đọc lại danh sách môn học khớp chính xác với các liên kết chưa xóa
  // **Validates: Requirements 3.1, 3.2**
  describe('Property 4: Đọc lại danh sách môn học khớp chính xác với các liên kết chưa xóa', () => {
    it('should return exactly the assigned (non-deleted) subjects for single teacher and batch query', async () => {
      await fc.assert(
        fc.asyncProperty(
          schoolIdArb,
          fc.integer({ min: 1, max: 5 }), // number of teachers
          fc.integer({ min: 1, max: 6 }), // max subjects per teacher
          async (schoolId, numTeachers, maxSubjectsPerTeacher) => {
            const store = createStore();

            // Create teachers
            const teacherIds: string[] = [];
            for (let t = 0; t < numTeachers; t++) {
              const teacherId = `teacher-prop4-${t}-${schoolId}`;
              store.teachers.push(buildTeacher(teacherId, schoolId));
              teacherIds.push(teacherId);
            }

            // Create a pool of subjects
            const totalSubjects = numTeachers * maxSubjectsPerTeacher;
            const allSubjectIds: string[] = [];
            for (let s = 0; s < totalSubjects; s++) {
              const subjectId = `subject-prop4-${s}-${schoolId}`;
              store.subjects.push(buildSubject(subjectId, schoolId));
              allSubjectIds.push(subjectId);
            }

            const { teacherRepository, teacherSubjectRepository, dataSource } =
              buildMocks(store);
            const service = new TeacherSubjectService(
              teacherSubjectRepository,
              teacherRepository,
              dataSource as never,
            );

            // Assign random subsets to each teacher (no overlap between teachers for simplicity)
            const expectedMap = new Map<string, string[]>();
            let subjectIndex = 0;
            for (const teacherId of teacherIds) {
              const count = Math.min(
                maxSubjectsPerTeacher,
                allSubjectIds.length - subjectIndex,
              );
              const subset = allSubjectIds.slice(
                subjectIndex,
                subjectIndex + count,
              );
              subjectIndex += count;
              if (subset.length > 0) {
                await service.assignSubjects(teacherId, subset);
              }
              expectedMap.set(teacherId, subset);
            }

            // Verify single-teacher query (getSubjectsForTeacher)
            for (const teacherId of teacherIds) {
              const subjects = await service.getSubjectsForTeacher(teacherId);
              const returnedIds = subjects.map((s) => s.id).sort();
              const expectedIds = (expectedMap.get(teacherId) ?? []).sort();
              expect(returnedIds).toEqual(expectedIds);
            }

            // Verify batch query (getSubjectsMapForTeachers)
            const subjectsMap =
              await service.getSubjectsMapForTeachers(teacherIds);
            for (const teacherId of teacherIds) {
              const subjects = subjectsMap.get(teacherId) ?? [];
              const returnedIds = subjects.map((s) => s.id).sort();
              const expectedIds = (expectedMap.get(teacherId) ?? []).sort();
              expect(returnedIds).toEqual(expectedIds);
            }
          },
        ),
        { numRuns: 100 },
      );
    });
  });

  // Feature: giao-vien-mon-hoc, Property 5: Gán rồi gỡ loại bỏ đúng môn học khỏi danh sách, không ảnh hưởng môn học khác
  // **Validates: Requirements 3.3, 4.1, 4.3**
  describe('Property 5: Gán rồi gỡ loại bỏ đúng môn học khỏi danh sách, không ảnh hưởng môn học khác', () => {
    it('should remove exactly the target subject and keep all others, with soft-delete record', async () => {
      await fc.assert(
        fc.asyncProperty(
          schoolIdArb,
          fc.integer({ min: 2, max: 8 }), // at least 2 subjects
          async (schoolId, numSubjects) => {
            const store = createStore();
            const teacherId = `teacher-prop5-${schoolId}`;
            store.teachers.push(buildTeacher(teacherId, schoolId));

            const subjectIds: string[] = [];
            for (let i = 0; i < numSubjects; i++) {
              const subjectId = `subject-prop5-${i}-${schoolId}`;
              store.subjects.push(buildSubject(subjectId, schoolId));
              subjectIds.push(subjectId);
            }

            const { teacherRepository, teacherSubjectRepository, dataSource } =
              buildMocks(store);
            const service = new TeacherSubjectService(
              teacherSubjectRepository,
              teacherRepository,
              dataSource as never,
            );

            // Assign all subjects
            const assignments = await service.assignSubjects(
              teacherId,
              subjectIds,
            );

            // Pick a random index to remove
            const removeIndex = Math.floor(Math.random() * assignments.length);
            const removedAssignment = assignments[removeIndex];
            const removedSubjectId = removedAssignment.subjectId;

            // Remove the assignment
            await service.removeAssignment(teacherId, removedAssignment.id);

            // Read back the list
            const subjectsAfter =
              await service.getSubjectsForTeacher(teacherId);
            const afterIds = subjectsAfter.map((s) => s.id);

            // The removed subject should NOT be in the list
            expect(afterIds).not.toContain(removedSubjectId);

            // All other subjects should still be present
            const remainingExpected = subjectIds
              .filter((id) => id !== removedSubjectId)
              .sort();
            expect(afterIds.sort()).toEqual(remainingExpected);

            // The soft-deleted record should still exist in store with deletedAt set
            const deletedRecord = store.links.find(
              (l) => l.id === removedAssignment.id,
            );
            expect(deletedRecord).toBeDefined();
            expect(deletedRecord!.deletedAt).not.toBeNull();
          },
        ),
        { numRuns: 100 },
      );
    });
  });

  // Feature: giao-vien-mon-hoc, Property 6: Gỡ lần hai luôn báo lỗi không tìm thấy
  // **Validates: Requirements 4.2**
  describe('Property 6: Gỡ lần hai luôn báo lỗi không tìm thấy', () => {
    it('should throw NotFoundException when removing an already-removed assignment or non-existent id', async () => {
      await fc.assert(
        fc.asyncProperty(schoolIdArb, async (schoolId) => {
          const store = createStore();
          const teacherId = `teacher-prop6-${schoolId}`;
          const subjectId = `subject-prop6-${schoolId}`;
          store.teachers.push(buildTeacher(teacherId, schoolId));
          store.subjects.push(buildSubject(subjectId, schoolId));

          const { teacherRepository, teacherSubjectRepository, dataSource } =
            buildMocks(store);
          const service = new TeacherSubjectService(
            teacherSubjectRepository,
            teacherRepository,
            dataSource as never,
          );

          // Assign the subject
          const [assignment] = await service.assignSubjects(teacherId, [
            subjectId,
          ]);

          // Remove it once (should succeed)
          await service.removeAssignment(teacherId, assignment.id);

          // Remove it again — should throw NotFoundException
          await expect(
            service.removeAssignment(teacherId, assignment.id),
          ).rejects.toThrow(NotFoundException);

          // Also verify non-existent id throws NotFoundException
          await expect(
            service.removeAssignment(teacherId, 'non-existent-id-xyz'),
          ).rejects.toThrow(NotFoundException);
        }),
        { numRuns: 100 },
      );
    });
  });
});
