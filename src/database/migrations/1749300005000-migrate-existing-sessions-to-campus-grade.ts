import { MigrationInterface, QueryRunner } from 'typeorm';

export class MigrateExistingSessionsToCampusGrade1749300005000 implements MigrationInterface {
  name = 'MigrateExistingSessionsToCampusGrade1749300005000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Step 1: For each session with NULL campus_id, find an active campus_grade_level
    // record for the session's school and assign it
    await queryRunner.query(`
      UPDATE "sessions" s
      SET
        "campus_id" = cgl."campus_id",
        "grade_level" = cgl."grade_level"
      FROM (
        SELECT DISTINCT ON (cgl_inner."school_id")
          cgl_inner."school_id",
          cgl_inner."campus_id",
          cgl_inner."grade_level"
        FROM "campus_grade_levels" cgl_inner
        WHERE cgl_inner."deleted_at" IS NULL
        ORDER BY cgl_inner."school_id", cgl_inner."created_at" ASC
      ) cgl
      WHERE s."campus_id" IS NULL
        AND s."school_id" = cgl."school_id"
    `);

    // Step 2: Handle edge case - sessions whose school has no campus_grade_level records
    // Use the first active campus for the school with 'primary' grade level as default
    await queryRunner.query(`
      UPDATE "sessions" s
      SET
        "campus_id" = c."id",
        "grade_level" = 'primary'
      FROM (
        SELECT DISTINCT ON (c_inner."school_id")
          c_inner."school_id",
          c_inner."id"
        FROM "campuses" c_inner
        WHERE c_inner."deleted_at" IS NULL
          AND c_inner."status" = 'active'
        ORDER BY c_inner."school_id", c_inner."created_at" ASC
      ) c
      WHERE s."campus_id" IS NULL
        AND s."school_id" = c."school_id"
    `);

    // Step 3: Final fallback - if there are still sessions with NULL campus_id
    // (school has no campuses at all), use the first campus regardless of status
    await queryRunner.query(`
      UPDATE "sessions" s
      SET
        "campus_id" = c."id",
        "grade_level" = 'primary'
      FROM (
        SELECT DISTINCT ON (c_inner."school_id")
          c_inner."school_id",
          c_inner."id"
        FROM "campuses" c_inner
        WHERE c_inner."deleted_at" IS NULL
        ORDER BY c_inner."school_id", c_inner."created_at" ASC
      ) c
      WHERE s."campus_id" IS NULL
        AND s."school_id" = c."school_id"
    `);

    // Step 4: Make campus_id NOT NULL
    await queryRunner.query(`
      ALTER TABLE "sessions"
      ALTER COLUMN "campus_id" SET NOT NULL
    `);

    // Step 5: Make grade_level NOT NULL
    await queryRunner.query(`
      ALTER TABLE "sessions"
      ALTER COLUMN "grade_level" SET NOT NULL
    `);

    // Step 6: Add foreign key constraint for campus_id
    await queryRunner.query(`
      ALTER TABLE "sessions"
      ADD CONSTRAINT "FK_sessions_campus"
      FOREIGN KEY ("campus_id") REFERENCES "campuses"("id")
      ON DELETE NO ACTION ON UPDATE NO ACTION
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Drop the foreign key constraint
    await queryRunner.query(`
      ALTER TABLE "sessions"
      DROP CONSTRAINT IF EXISTS "FK_sessions_campus"
    `);

    // Make grade_level nullable again
    await queryRunner.query(`
      ALTER TABLE "sessions"
      ALTER COLUMN "grade_level" DROP NOT NULL
    `);

    // Make campus_id nullable again
    await queryRunner.query(`
      ALTER TABLE "sessions"
      ALTER COLUMN "campus_id" DROP NOT NULL
    `);
  }
}
