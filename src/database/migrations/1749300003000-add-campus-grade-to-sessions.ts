import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddCampusGradeToSessions1749300003000 implements MigrationInterface {
  name = 'AddCampusGradeToSessions1749300003000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Add campus_id column (nullable initially for existing data migration)
    await queryRunner.query(`
      ALTER TABLE "sessions"
      ADD COLUMN "campus_id" uuid
    `);

    // Add grade_level column (nullable initially for existing data migration)
    await queryRunner.query(`
      ALTER TABLE "sessions"
      ADD COLUMN "grade_level" "grade_level_enum"
    `);

    // Add partial unique index on (campus_id, grade_level, sort_order, school_id) WHERE deleted_at IS NULL
    await queryRunner.query(`
      CREATE UNIQUE INDEX "UQ_sessions_campus_grade_sort_school"
      ON "sessions" ("campus_id", "grade_level", "sort_order", "school_id")
      WHERE "deleted_at" IS NULL
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Drop the unique index
    await queryRunner.query(`
      DROP INDEX "UQ_sessions_campus_grade_sort_school"
    `);

    // Drop the columns
    await queryRunner.query(`
      ALTER TABLE "sessions" DROP COLUMN "grade_level"
    `);

    await queryRunner.query(`
      ALTER TABLE "sessions" DROP COLUMN "campus_id"
    `);
  }
}
