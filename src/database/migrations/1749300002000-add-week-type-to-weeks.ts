import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddWeekTypeToWeeks1749300002000 implements MigrationInterface {
  name = 'AddWeekTypeToWeeks1749300002000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // 1. Add week_type column with default 'regular'
    await queryRunner.query(`
      ALTER TABLE "weeks"
      ADD COLUMN "week_type" "week_type_enum" NOT NULL DEFAULT 'regular'
    `);

    // 2. Migrate data from is_holiday to week_type
    await queryRunner.query(`
      UPDATE "weeks" SET "week_type" = 'holiday' WHERE "is_holiday" = true
    `);
    await queryRunner.query(`
      UPDATE "weeks" SET "week_type" = 'regular' WHERE "is_holiday" = false
    `);

    // 3. Drop is_holiday column
    await queryRunner.query(`
      ALTER TABLE "weeks" DROP COLUMN "is_holiday"
    `);

    // 4. Ensure partial unique index on (semester_id, week_number) WHERE deleted_at IS NULL
    // Drop existing index if present, then recreate to ensure consistency
    await queryRunner.query(`
      DROP INDEX IF EXISTS "IDX_weeks_semester_number"
    `);
    await queryRunner.query(`
      CREATE UNIQUE INDEX "IDX_weeks_semester_number"
      ON "weeks" ("semester_id", "week_number")
      WHERE "deleted_at" IS NULL
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // 1. Drop the partial unique index
    await queryRunner.query(`
      DROP INDEX IF EXISTS "IDX_weeks_semester_number"
    `);

    // 2. Add is_holiday column back
    await queryRunner.query(`
      ALTER TABLE "weeks"
      ADD COLUMN "is_holiday" boolean NOT NULL DEFAULT false
    `);

    // 3. Migrate data back from week_type to is_holiday
    await queryRunner.query(`
      UPDATE "weeks" SET "is_holiday" = true WHERE "week_type" = 'holiday'
    `);
    await queryRunner.query(`
      UPDATE "weeks" SET "is_holiday" = false WHERE "week_type" != 'holiday'
    `);

    // 4. Drop week_type column
    await queryRunner.query(`
      ALTER TABLE "weeks" DROP COLUMN "week_type"
    `);

    // 5. Recreate the original partial unique index
    await queryRunner.query(`
      CREATE UNIQUE INDEX "IDX_weeks_semester_number"
      ON "weeks" ("semester_id", "week_number")
      WHERE "deleted_at" IS NULL
    `);
  }
}
