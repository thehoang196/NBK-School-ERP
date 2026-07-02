import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateTeachingAssignments1749000003000 implements MigrationInterface {
  name = 'CreateTeachingAssignments1749000003000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Create teaching_assignments table
    await queryRunner.query(`
      CREATE TABLE "teaching_assignments" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "semester_id" uuid NOT NULL,
        "teacher_id" uuid NOT NULL,
        "class_id" uuid NOT NULL,
        "subject_id" uuid NOT NULL,
        "periods_per_week" int NOT NULL,
        "note" text,
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
        "deleted_at" TIMESTAMP,
        CONSTRAINT "PK_teaching_assignments" PRIMARY KEY ("id")
      )
    `);

    // Foreign key: semester_id -> semesters.id
    await queryRunner.query(`
      ALTER TABLE "teaching_assignments"
      ADD CONSTRAINT "FK_teaching_assignments_semester"
      FOREIGN KEY ("semester_id") REFERENCES "semesters"("id")
      ON DELETE NO ACTION ON UPDATE NO ACTION
    `);

    // Foreign key: teacher_id -> teachers.id
    await queryRunner.query(`
      ALTER TABLE "teaching_assignments"
      ADD CONSTRAINT "FK_teaching_assignments_teacher"
      FOREIGN KEY ("teacher_id") REFERENCES "teachers"("id")
      ON DELETE NO ACTION ON UPDATE NO ACTION
    `);

    // Foreign key: class_id -> classes.id
    await queryRunner.query(`
      ALTER TABLE "teaching_assignments"
      ADD CONSTRAINT "FK_teaching_assignments_class"
      FOREIGN KEY ("class_id") REFERENCES "classes"("id")
      ON DELETE NO ACTION ON UPDATE NO ACTION
    `);

    // Foreign key: subject_id -> subjects.id
    await queryRunner.query(`
      ALTER TABLE "teaching_assignments"
      ADD CONSTRAINT "FK_teaching_assignments_subject"
      FOREIGN KEY ("subject_id") REFERENCES "subjects"("id")
      ON DELETE NO ACTION ON UPDATE NO ACTION
    `);

    // Unique constraint (partial): (semester_id, teacher_id, class_id, subject_id) WHERE deleted_at IS NULL
    await queryRunner.query(`
      CREATE UNIQUE INDEX "UQ_teaching_assignments_semester_teacher_class_subject"
      ON "teaching_assignments" ("semester_id", "teacher_id", "class_id", "subject_id")
      WHERE "deleted_at" IS NULL
    `);

    // Index for workload queries: (semester_id, teacher_id)
    await queryRunner.query(`
      CREATE INDEX "IDX_teaching_assignments_semester_teacher"
      ON "teaching_assignments" ("semester_id", "teacher_id")
    `);

    // Index for class schedule queries: (semester_id, class_id)
    await queryRunner.query(`
      CREATE INDEX "IDX_teaching_assignments_semester_class"
      ON "teaching_assignments" ("semester_id", "class_id")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Drop indexes
    await queryRunner.query(`DROP INDEX "IDX_teaching_assignments_semester_class"`);
    await queryRunner.query(`DROP INDEX "IDX_teaching_assignments_semester_teacher"`);
    await queryRunner.query(`DROP INDEX "UQ_teaching_assignments_semester_teacher_class_subject"`);

    // Drop foreign key constraints
    await queryRunner.query(`
      ALTER TABLE "teaching_assignments"
      DROP CONSTRAINT "FK_teaching_assignments_subject"
    `);
    await queryRunner.query(`
      ALTER TABLE "teaching_assignments"
      DROP CONSTRAINT "FK_teaching_assignments_class"
    `);
    await queryRunner.query(`
      ALTER TABLE "teaching_assignments"
      DROP CONSTRAINT "FK_teaching_assignments_teacher"
    `);
    await queryRunner.query(`
      ALTER TABLE "teaching_assignments"
      DROP CONSTRAINT "FK_teaching_assignments_semester"
    `);

    // Drop table
    await queryRunner.query(`DROP TABLE "teaching_assignments"`);
  }
}
