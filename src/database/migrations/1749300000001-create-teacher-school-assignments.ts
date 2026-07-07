import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateTeacherSchoolAssignments1749300000001 implements MigrationInterface {
  name = 'CreateTeacherSchoolAssignments1749300000001';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Create teacher_school_assignments table
    await queryRunner.query(`
      CREATE TABLE "teacher_school_assignments" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "teacher_id" uuid NOT NULL,
        "school_id" uuid NOT NULL,
        "role" varchar(20) NOT NULL CHECK ("role" IN ('primary', 'secondary')),
        "status" varchar(20) NOT NULL DEFAULT 'active',
        "effective_start_date" date NOT NULL,
        "effective_end_date" date,
        "note" text,
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
        "deleted_at" TIMESTAMP,
        CONSTRAINT "PK_teacher_school_assignments" PRIMARY KEY ("id")
      )
    `);

    // UNIQUE constraint on (teacher_id, school_id)
    await queryRunner.query(`
      ALTER TABLE "teacher_school_assignments"
      ADD CONSTRAINT "UQ_teacher_school_assignments_teacher_school"
      UNIQUE ("teacher_id", "school_id")
    `);

    // Foreign key: teacher_id -> teachers.id
    await queryRunner.query(`
      ALTER TABLE "teacher_school_assignments"
      ADD CONSTRAINT "FK_teacher_school_assignments_teacher"
      FOREIGN KEY ("teacher_id") REFERENCES "teachers"("id")
      ON DELETE NO ACTION ON UPDATE NO ACTION
    `);

    // Foreign key: school_id -> schools.id
    await queryRunner.query(`
      ALTER TABLE "teacher_school_assignments"
      ADD CONSTRAINT "FK_teacher_school_assignments_school"
      FOREIGN KEY ("school_id") REFERENCES "schools"("id")
      ON DELETE NO ACTION ON UPDATE NO ACTION
    `);

    // Partial index: idx_tsa_teacher_id (WHERE deleted_at IS NULL)
    await queryRunner.query(`
      CREATE INDEX "idx_tsa_teacher_id"
      ON "teacher_school_assignments" ("teacher_id")
      WHERE "deleted_at" IS NULL
    `);

    // Partial index: idx_tsa_school_id (WHERE deleted_at IS NULL)
    await queryRunner.query(`
      CREATE INDEX "idx_tsa_school_id"
      ON "teacher_school_assignments" ("school_id")
      WHERE "deleted_at" IS NULL
    `);

    // Partial index: idx_tsa_teacher_status (WHERE deleted_at IS NULL)
    await queryRunner.query(`
      CREATE INDEX "idx_tsa_teacher_status"
      ON "teacher_school_assignments" ("teacher_id", "status")
      WHERE "deleted_at" IS NULL
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Drop indexes
    await queryRunner.query(`DROP INDEX "idx_tsa_teacher_status"`);
    await queryRunner.query(`DROP INDEX "idx_tsa_school_id"`);
    await queryRunner.query(`DROP INDEX "idx_tsa_teacher_id"`);

    // Drop foreign key constraints
    await queryRunner.query(`
      ALTER TABLE "teacher_school_assignments"
      DROP CONSTRAINT "FK_teacher_school_assignments_school"
    `);
    await queryRunner.query(`
      ALTER TABLE "teacher_school_assignments"
      DROP CONSTRAINT "FK_teacher_school_assignments_teacher"
    `);

    // Drop unique constraint
    await queryRunner.query(`
      ALTER TABLE "teacher_school_assignments"
      DROP CONSTRAINT "UQ_teacher_school_assignments_teacher_school"
    `);

    // Drop table
    await queryRunner.query(`DROP TABLE "teacher_school_assignments"`);
  }
}
