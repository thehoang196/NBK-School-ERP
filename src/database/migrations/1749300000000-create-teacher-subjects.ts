import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateTeacherSubjects1749300000000 implements MigrationInterface {
  name = 'CreateTeacherSubjects1749300000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Create teacher_subjects table (danh sách môn học giảng dạy của giáo viên)
    await queryRunner.query(`
      CREATE TABLE "teacher_subjects" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "teacher_id" uuid NOT NULL,
        "subject_id" uuid NOT NULL,
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
        "deleted_at" TIMESTAMP,
        CONSTRAINT "PK_teacher_subjects" PRIMARY KEY ("id")
      )
    `);

    // Foreign key: teacher_id -> teachers.id
    await queryRunner.query(`
      ALTER TABLE "teacher_subjects"
      ADD CONSTRAINT "FK_teacher_subjects_teacher"
      FOREIGN KEY ("teacher_id") REFERENCES "teachers"("id")
      ON DELETE NO ACTION ON UPDATE NO ACTION
    `);

    // Foreign key: subject_id -> subjects.id
    await queryRunner.query(`
      ALTER TABLE "teacher_subjects"
      ADD CONSTRAINT "FK_teacher_subjects_subject"
      FOREIGN KEY ("subject_id") REFERENCES "subjects"("id")
      ON DELETE NO ACTION ON UPDATE NO ACTION
    `);

    // Unique constraint (partial): (teacher_id, subject_id) WHERE deleted_at IS NULL
    // Cho phép gán lại môn học sau khi đã gỡ (soft delete) mà không vi phạm ràng buộc duy nhất.
    await queryRunner.query(`
      CREATE UNIQUE INDEX "UQ_teacher_subjects_teacher_subject"
      ON "teacher_subjects" ("teacher_id", "subject_id")
      WHERE "deleted_at" IS NULL
    `);

    // Index for lookup by teacher (getSubjectsForTeacher / getSubjectsMapForTeachers)
    // Partial index: chỉ bao gồm bản ghi chưa xóa, tối ưu truy vấn danh sách môn học hiện tại
    await queryRunner.query(`
      CREATE INDEX "IDX_teacher_subjects_teacher_id"
      ON "teacher_subjects" ("teacher_id")
      WHERE "deleted_at" IS NULL
    `);

    // Index for reverse lookup by subject
    await queryRunner.query(`
      CREATE INDEX "IDX_teacher_subjects_subject_id"
      ON "teacher_subjects" ("subject_id")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX "IDX_teacher_subjects_subject_id"`);
    await queryRunner.query(`DROP INDEX "IDX_teacher_subjects_teacher_id"`);
    await queryRunner.query(`DROP INDEX "UQ_teacher_subjects_teacher_subject"`);

    await queryRunner.query(`
      ALTER TABLE "teacher_subjects"
      DROP CONSTRAINT "FK_teacher_subjects_subject"
    `);
    await queryRunner.query(`
      ALTER TABLE "teacher_subjects"
      DROP CONSTRAINT "FK_teacher_subjects_teacher"
    `);

    await queryRunner.query(`DROP TABLE "teacher_subjects"`);
  }
}
