import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddTenantUniqueConstraints1749900000000 implements MigrationInterface {
  name = 'AddTenantUniqueConstraints1749900000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // =========================================================
    // 1. Fix teachers: change global unique to tenant-scoped unique
    // =========================================================
    // Drop the existing global unique constraint on employee_code
    await queryRunner.query(`
      ALTER TABLE "teachers" DROP CONSTRAINT IF EXISTS "UQ_teachers_employee_code"
    `);

    // Create tenant-scoped unique index (school_id, employee_code) with soft-delete filter
    await queryRunner.query(`
      CREATE UNIQUE INDEX "IDX_teachers_school_employee_code"
      ON "teachers" ("school_id", "employee_code")
      WHERE "deleted_at" IS NULL
    `);

    // =========================================================
    // 2. Fix classes: add school_id to the unique constraint
    // =========================================================
    // Drop existing unique index without school_id
    await queryRunner.query(`
      DROP INDEX IF EXISTS "IDX_classes_unique_name"
    `);

    // Create proper tenant-scoped unique index (school_id, grade_id, academic_year_id, name)
    await queryRunner.query(`
      CREATE UNIQUE INDEX "IDX_classes_school_grade_year_name"
      ON "classes" ("school_id", "grade_id", "academic_year_id", "name")
      WHERE "deleted_at" IS NULL
    `);

    // =========================================================
    // 3. Add compound index (school_id, deleted_at) for all tenant tables
    //    These optimize the standard query pattern:
    //    WHERE school_id = :schoolId AND deleted_at IS NULL
    // =========================================================
    await queryRunner.query(`
      CREATE INDEX "IDX_academic_years_school_deleted"
      ON "academic_years" ("school_id", "deleted_at")
    `);

    await queryRunner.query(`
      CREATE INDEX "IDX_semesters_school_deleted"
      ON "semesters" ("academic_year_id", "deleted_at")
    `);

    await queryRunner.query(`
      CREATE INDEX "IDX_weeks_school_deleted"
      ON "weeks" ("semester_id", "deleted_at")
    `);

    await queryRunner.query(`
      CREATE INDEX "IDX_sessions_school_deleted"
      ON "sessions" ("school_id", "deleted_at")
    `);

    await queryRunner.query(`
      CREATE INDEX "IDX_period_definitions_school_deleted"
      ON "period_definitions" ("school_id", "deleted_at")
    `);

    await queryRunner.query(`
      CREATE INDEX "IDX_grades_school_deleted"
      ON "grades" ("school_id", "deleted_at")
    `);

    await queryRunner.query(`
      CREATE INDEX "IDX_classes_school_deleted"
      ON "classes" ("school_id", "deleted_at")
    `);

    await queryRunner.query(`
      CREATE INDEX "IDX_departments_school_deleted"
      ON "departments" ("school_id", "deleted_at")
    `);

    await queryRunner.query(`
      CREATE INDEX "IDX_subjects_school_deleted"
      ON "subjects" ("school_id", "deleted_at")
    `);

    await queryRunner.query(`
      CREATE INDEX "IDX_subject_grades_deleted"
      ON "subject_grades" ("subject_id", "deleted_at")
    `);

    await queryRunner.query(`
      CREATE INDEX "IDX_teachers_school_deleted"
      ON "teachers" ("school_id", "deleted_at")
    `);

    await queryRunner.query(`
      CREATE INDEX "IDX_rooms_school_deleted"
      ON "rooms" ("school_id", "deleted_at")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // =========================================================
    // Drop compound (school_id, deleted_at) indexes
    // =========================================================
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_rooms_school_deleted"`);
    await queryRunner.query(
      `DROP INDEX IF EXISTS "IDX_teachers_school_deleted"`,
    );
    await queryRunner.query(
      `DROP INDEX IF EXISTS "IDX_subject_grades_deleted"`,
    );
    await queryRunner.query(
      `DROP INDEX IF EXISTS "IDX_subjects_school_deleted"`,
    );
    await queryRunner.query(
      `DROP INDEX IF EXISTS "IDX_departments_school_deleted"`,
    );
    await queryRunner.query(
      `DROP INDEX IF EXISTS "IDX_classes_school_deleted"`,
    );
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_grades_school_deleted"`);
    await queryRunner.query(
      `DROP INDEX IF EXISTS "IDX_period_definitions_school_deleted"`,
    );
    await queryRunner.query(
      `DROP INDEX IF EXISTS "IDX_sessions_school_deleted"`,
    );
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_weeks_school_deleted"`);
    await queryRunner.query(
      `DROP INDEX IF EXISTS "IDX_semesters_school_deleted"`,
    );
    await queryRunner.query(
      `DROP INDEX IF EXISTS "IDX_academic_years_school_deleted"`,
    );

    // =========================================================
    // Revert classes unique index back to original (without school_id)
    // =========================================================
    await queryRunner.query(
      `DROP INDEX IF EXISTS "IDX_classes_school_grade_year_name"`,
    );
    await queryRunner.query(`
      CREATE UNIQUE INDEX "IDX_classes_unique_name"
      ON "classes" ("grade_id", "academic_year_id", "name")
      WHERE "deleted_at" IS NULL
    `);

    // =========================================================
    // Revert teachers unique constraint back to global
    // =========================================================
    await queryRunner.query(
      `DROP INDEX IF EXISTS "IDX_teachers_school_employee_code"`,
    );
    await queryRunner.query(`
      ALTER TABLE "teachers"
      ADD CONSTRAINT "UQ_teachers_employee_code" UNIQUE ("employee_code")
    `);
  }
}
