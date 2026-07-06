import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddGradeLevelToPeriodDefinitions1749300004000 implements MigrationInterface {
  name = 'AddGradeLevelToPeriodDefinitions1749300004000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Add grade_level column (nullable initially for existing data)
    await queryRunner.query(`
      ALTER TABLE "period_definitions"
      ADD COLUMN "grade_level" "grade_level_enum"
    `);

    // Drop the existing unique index on (session_id, period_number)
    await queryRunner.query(`
      DROP INDEX "IDX_period_definitions_session_number"
    `);

    // Create new unique index on (session_id, grade_level, period_number)
    await queryRunner.query(`
      CREATE UNIQUE INDEX "IDX_period_definitions_session_grade_number"
      ON "period_definitions" ("session_id", "grade_level", "period_number")
      WHERE "deleted_at" IS NULL
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Drop the new unique index
    await queryRunner.query(`
      DROP INDEX "IDX_period_definitions_session_grade_number"
    `);

    // Restore the original unique index on (session_id, period_number)
    await queryRunner.query(`
      CREATE UNIQUE INDEX "IDX_period_definitions_session_number"
      ON "period_definitions" ("session_id", "period_number")
      WHERE "deleted_at" IS NULL
    `);

    // Remove the grade_level column
    await queryRunner.query(`
      ALTER TABLE "period_definitions"
      DROP COLUMN "grade_level"
    `);
  }
}
