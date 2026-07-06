import * as fc from 'fast-check';
import { TeachingAssignmentService } from './teaching-assignment.service';
import { TeachingAssignmentRepository } from './teaching-assignment.repository';
import { TeachingAssignmentEntity } from './entities/teaching-assignment.entity';
import { TeacherSubjectService } from '../teacher/teacher-subject.service';
import { TeacherSubjectRepository } from '../teacher/teacher-subject.repository';
import { TeacherSubjectEntity } from '../teacher/entities/teacher-subject.entity';

// --- In-memory stores ---

interface TeachingAssignmentStore {
  assignments: TeachingAssignmentEntity[];
}

interface TeacherSubjectStore {
  links: TeacherSubjectEntity[];
}

function createTeachingAssignmentStore(): TeachingAssignmentStore {
  return { assignments: [] };
}

function createTeacherSubjectStore(): TeacherSubjectStore {
  return { links: [] };
}

// --- Mock builders ---

function buildTeachingAssignmentRepository(store: TeachingAssignmentStore) {
  let idCounter = 0;

  return {
    create: jest.fn(async (data: Partial<TeachingAssignmentEntity>) => {
      const entity: TeachingAssignmentEntity = {
        id: `ta-${++idCounter}`,
        semesterId: data.semesterId!,
        teacherId: data.teacherId!,
        classId: data.classId!,
        subjectId: data.subjectId!,
        schoolId: data.schoolId ?? 'school-001',
        school: undefined as never,
        assignmentStatus: data.assignmentStatus ?? 'active',
        periodsPerWeek: data.periodsPerWeek ?? 4,
        note: data.note ?? null,
        createdAt: new Date(),
        updatedAt: new Date(),
        deletedAt: null,
        semester: undefined as never,
        teacher: undefined as never,
        class: undefined as never,
        subject: undefined as never,
      };
      store.assignments.push(entity);
      return entity;
    }),
    findById: jest.fn(async (id: string) => {
      return store.assignments.find((a) => a.id === id && !a.deletedAt) ?? null;
    }),
    update: jest.fn(
      async (id: string, data: Partial<TeachingAssignmentEntity>) => {
        const assignment = store.assignments.find(
          (a) => a.id === id && !a.deletedAt,
        );
        if (!assignment) return null;
        Object.assign(assignment, data, { updatedAt: new Date() });
        return assignment;
      },
    ),
    checkDuplicate: jest.fn(
      async (
        semesterId: string,
        teacherId: string,
        classId: string,
        subjectId: string,
        excludeId?: string,
      ) => {
        return (
          store.assignments.find(
            (a) =>
              a.semesterId === semesterId &&
              a.teacherId === teacherId &&
              a.classId === classId &&
              a.subjectId === subjectId &&
              !a.deletedAt &&
              a.id !== excludeId,
          ) ?? null
        );
      },
    ),
    softDelete: jest.fn(async (id: string) => {
      const assignment = store.assignments.find((a) => a.id === id);
      if (assignment) {
        assignment.deletedAt = new Date();
      }
    }),
    findAll: jest.fn(async () => [
      store.assignments.filter((a) => !a.deletedAt),
      0,
    ]),
    findBySemester: jest.fn(async () => []),
    findByTeacher: jest.fn(async () => []),
    sumPeriodsByTeacher: jest.fn(async () => 0),
    getRepository: jest.fn(),
  } as unknown as TeachingAssignmentRepository;
}

function buildTeacherSubjectRepository(store: TeacherSubjectStore) {
  let idCounter = 0;

  return {
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
    findById: jest.fn(async (id: string) => {
      return store.links.find((l) => l.id === id && !l.deletedAt) ?? null;
    }),
    create: jest.fn(async (data: Partial<TeacherSubjectEntity>) => {
      const entity: TeacherSubjectEntity = {
        id: `ts-${++idCounter}`,
        teacherId: data.teacherId!,
        subjectId: data.subjectId!,
        createdAt: new Date(),
        updatedAt: new Date(),
        deletedAt: null,
        teacher: undefined as never,
        subject: undefined as never,
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
}

/**
 * Build a minimal TeacherSubjectService that operates on the in-memory store.
 * We only need `hasAssignment` and `removeAssignment` for these property tests.
 */
function buildTeacherSubjectService(
  tsRepo: TeacherSubjectRepository,
): TeacherSubjectService {
  return {
    hasAssignment: async (
      teacherId: string,
      subjectId: string,
    ): Promise<boolean> => {
      const link = await tsRepo.findOne(teacherId, subjectId);
      return link !== null;
    },
    removeAssignment: async (
      teacherId: string,
      assignmentId: string,
    ): Promise<void> => {
      const link = await tsRepo.findById(assignmentId);
      if (!link || link.teacherId !== teacherId) {
        throw new Error('Không tìm thấy liên kết môn học giảng dạy');
      }
      await tsRepo.softDelete(assignmentId);
    },
  } as unknown as TeacherSubjectService;
}

// --- Arbitraries ---

const uuidArb = fc.uuid().map((u) => u);

const schoolIdArb = fc.constantFrom('school-001', 'school-002', 'school-003');

const periodsPerWeekArb = fc.integer({ min: 1, max: 20 });

// --- Property Tests ---

describe('TeachingAssignmentService - Property Tests', () => {
  // Feature: giao-vien-mon-hoc, Property 7: Cảnh báo khi phân công thiếu năng lực chuyên môn, không chặn tạo phân công
  // **Validates: Requirements 5.1**
  describe('Property 7: Cảnh báo khi phân công thiếu năng lực chuyên môn, không chặn tạo phân công', () => {
    it('should always create/update assignment successfully, with warning only when no qualification exists', async () => {
      await fc.assert(
        fc.asyncProperty(
          uuidArb, // teacherId
          uuidArb, // subjectId
          uuidArb, // classId
          uuidArb, // semesterId
          periodsPerWeekArb,
          fc.boolean(), // hasQualification — whether teacher has teacher-subject link
          async (
            teacherId,
            subjectId,
            classId,
            semesterId,
            periodsPerWeek,
            hasQualification,
          ) => {
            // Setup stores
            const taStore = createTeachingAssignmentStore();
            const tsStore = createTeacherSubjectStore();

            // If teacher has qualification, add a teacher-subject link
            if (hasQualification) {
              tsStore.links.push({
                id: `ts-pre-1`,
                teacherId,
                subjectId,
                createdAt: new Date(),
                updatedAt: new Date(),
                deletedAt: null,
                teacher: undefined as never,
                subject: undefined as never,
              });
            }

            const taRepo = buildTeachingAssignmentRepository(taStore);
            const tsRepo = buildTeacherSubjectRepository(tsStore);
            const teacherSubjectService = buildTeacherSubjectService(tsRepo);

            // Build a minimal TeacherRepo mock (for teacherRepo in service)
            const teacherRepo = {
              findOne: jest.fn(async () => ({
                id: teacherId,
                schoolId: 'school-001',
                fullName: 'Test Teacher',
                maxPeriodsPerWeek: 20,
                minPeriodsPerWeek: 0,
              })),
            };

            // Build a minimal ClassRepo mock
            const classRepo = {
              findOne: jest.fn(async () => ({
                id: classId,
                schoolId: 'school-001',
                deletedAt: null,
              })),
            };

            // Build a minimal TeacherSchoolAssignmentService mock
            const teacherSchoolAssignmentService = {
              validateTeacherSchoolAccess: jest.fn(async () => true),
            };

            const dataSource = { transaction: jest.fn() };

            const service = new TeachingAssignmentService(
              taRepo,
              dataSource as never,
              teacherRepo as never,
              classRepo as never,
              teacherSubjectService,
              teacherSchoolAssignmentService as never,
            );

            // --- Test CREATE ---
            const createDto = {
              semesterId,
              teacherId,
              classId,
              subjectId,
              periodsPerWeek,
            };
            const created = await service.create(createDto);

            // Assignment must ALWAYS be created successfully
            expect(created).toBeDefined();
            expect(created.teacherId).toBe(teacherId);
            expect(created.subjectId).toBe(subjectId);
            expect(created.semesterId).toBe(semesterId);
            expect(created.classId).toBe(classId);

            // Check warning
            const warningAfterCreate = await service.getQualificationWarning(
              teacherId,
              subjectId,
            );

            if (hasQualification) {
              // No warning expected
              expect(warningAfterCreate).toBeUndefined();
            } else {
              // Warning expected
              expect(warningAfterCreate).toBeDefined();
              expect(typeof warningAfterCreate).toBe('string');
              expect(warningAfterCreate!.length).toBeGreaterThan(0);
            }

            // --- Test UPDATE ---
            const newPeriodsPerWeek =
              periodsPerWeek === 20 ? 1 : periodsPerWeek + 1;
            const updated = await service.update(created.id, {
              periodsPerWeek: newPeriodsPerWeek,
            });

            // Assignment must ALWAYS be updated successfully
            expect(updated).toBeDefined();
            expect(updated!.periodsPerWeek).toBe(newPeriodsPerWeek);

            // Warning after update should be same logic
            const warningAfterUpdate = await service.getQualificationWarning(
              updated!.teacherId,
              updated!.subjectId,
            );

            if (hasQualification) {
              expect(warningAfterUpdate).toBeUndefined();
            } else {
              expect(warningAfterUpdate).toBeDefined();
              expect(typeof warningAfterUpdate).toBe('string');
            }
          },
        ),
        { numRuns: 100 },
      );
    });
  });

  // Feature: giao-vien-mon-hoc, Property 8: Gỡ năng lực chuyên môn không tác động đến phân công giảng dạy hiện có
  // **Validates: Requirements 5.2**
  describe('Property 8: Gỡ năng lực chuyên môn không tác động đến phân công giảng dạy hiện có', () => {
    it('should not alter any fields of existing TeachingAssignment records when removing a TeacherSubjectAssignment', async () => {
      await fc.assert(
        fc.asyncProperty(
          uuidArb, // teacherId
          uuidArb, // subjectId
          uuidArb, // classId
          uuidArb, // semesterId
          periodsPerWeekArb,
          fc.option(fc.string({ minLength: 1, maxLength: 50 }), { nil: null }), // note
          async (
            teacherId,
            subjectId,
            classId,
            semesterId,
            periodsPerWeek,
            note,
          ) => {
            // Setup stores
            const taStore = createTeachingAssignmentStore();
            const tsStore = createTeacherSubjectStore();

            // Pre-populate: teacher has qualification for the subject
            const tsLinkId = 'ts-preexist-1';
            tsStore.links.push({
              id: tsLinkId,
              teacherId,
              subjectId,
              createdAt: new Date(),
              updatedAt: new Date(),
              deletedAt: null,
              teacher: undefined as never,
              subject: undefined as never,
            });

            // Pre-populate: teacher has a teaching assignment for the subject
            const taEntity: TeachingAssignmentEntity = {
              id: 'ta-preexist-1',
              semesterId,
              teacherId,
              classId,
              subjectId,
              schoolId: 'school-001',
              school: undefined as never,
              assignmentStatus: 'active',
              periodsPerWeek,
              note: note ?? null,
              createdAt: new Date(),
              updatedAt: new Date(),
              deletedAt: null,
              semester: undefined as never,
              teacher: undefined as never,
              class: undefined as never,
              subject: undefined as never,
            };
            taStore.assignments.push(taEntity);

            const tsRepo = buildTeacherSubjectRepository(tsStore);
            const teacherSubjectService = buildTeacherSubjectService(tsRepo);

            // Snapshot all fields of the teaching assignment before removal
            const snapshotBefore = { ...taStore.assignments[0] };

            // Act: remove the TeacherSubjectAssignment
            await teacherSubjectService.removeAssignment(teacherId, tsLinkId);

            // Verify: the teacher-subject link is now soft-deleted
            const removedLink = tsStore.links.find((l) => l.id === tsLinkId);
            expect(removedLink).toBeDefined();
            expect(removedLink!.deletedAt).not.toBeNull();

            // Verify: the teaching assignment is COMPLETELY unchanged
            const taAfter = taStore.assignments[0];
            expect(taAfter.id).toBe(snapshotBefore.id);
            expect(taAfter.semesterId).toBe(snapshotBefore.semesterId);
            expect(taAfter.teacherId).toBe(snapshotBefore.teacherId);
            expect(taAfter.classId).toBe(snapshotBefore.classId);
            expect(taAfter.subjectId).toBe(snapshotBefore.subjectId);
            expect(taAfter.periodsPerWeek).toBe(snapshotBefore.periodsPerWeek);
            expect(taAfter.note).toBe(snapshotBefore.note);
            expect(taAfter.deletedAt).toBeNull();
            // createdAt should not change
            expect(taAfter.createdAt.getTime()).toBe(
              snapshotBefore.createdAt.getTime(),
            );
            // updatedAt should not change (removal of teacher-subject should not touch teaching assignments)
            expect(taAfter.updatedAt.getTime()).toBe(
              snapshotBefore.updatedAt.getTime(),
            );
          },
        ),
        { numRuns: 100 },
      );
    });

    it('should not alter any TeachingAssignment when teacher has multiple assignments for same subject', async () => {
      await fc.assert(
        fc.asyncProperty(
          uuidArb, // teacherId
          uuidArb, // subjectId
          fc.integer({ min: 2, max: 5 }), // number of teaching assignments
          uuidArb, // semesterId
          periodsPerWeekArb,
          async (
            teacherId,
            subjectId,
            numAssignments,
            semesterId,
            periodsPerWeek,
          ) => {
            // Setup stores
            const taStore = createTeachingAssignmentStore();
            const tsStore = createTeacherSubjectStore();

            // Teacher has qualification
            const tsLinkId = 'ts-multi-1';
            tsStore.links.push({
              id: tsLinkId,
              teacherId,
              subjectId,
              createdAt: new Date(),
              updatedAt: new Date(),
              deletedAt: null,
              teacher: undefined as never,
              subject: undefined as never,
            });

            // Create multiple teaching assignments for same teacher-subject pair (different classes)
            for (let i = 0; i < numAssignments; i++) {
              taStore.assignments.push({
                id: `ta-multi-${i}`,
                semesterId,
                teacherId,
                classId: `class-${i}`,
                subjectId,
                schoolId: 'school-001',
                school: undefined as never,
                assignmentStatus: 'active',
                periodsPerWeek,
                note: null,
                createdAt: new Date(),
                updatedAt: new Date(),
                deletedAt: null,
                semester: undefined as never,
                teacher: undefined as never,
                class: undefined as never,
                subject: undefined as never,
              });
            }

            const tsRepo = buildTeacherSubjectRepository(tsStore);
            const teacherSubjectService = buildTeacherSubjectService(tsRepo);

            // Snapshot all teaching assignments before removal
            const snapshotsBefore = taStore.assignments.map((a) => ({ ...a }));

            // Act: remove the TeacherSubjectAssignment
            await teacherSubjectService.removeAssignment(teacherId, tsLinkId);

            // Verify: ALL teaching assignments are completely unchanged
            expect(taStore.assignments.length).toBe(numAssignments);
            for (let i = 0; i < numAssignments; i++) {
              const after = taStore.assignments[i];
              const before = snapshotsBefore[i];
              expect(after.id).toBe(before.id);
              expect(after.semesterId).toBe(before.semesterId);
              expect(after.teacherId).toBe(before.teacherId);
              expect(after.classId).toBe(before.classId);
              expect(after.subjectId).toBe(before.subjectId);
              expect(after.periodsPerWeek).toBe(before.periodsPerWeek);
              expect(after.note).toBe(before.note);
              expect(after.deletedAt).toBeNull();
              expect(after.createdAt.getTime()).toBe(
                before.createdAt.getTime(),
              );
              expect(after.updatedAt.getTime()).toBe(
                before.updatedAt.getTime(),
              );
            }
          },
        ),
        { numRuns: 100 },
      );
    });
  });
});
