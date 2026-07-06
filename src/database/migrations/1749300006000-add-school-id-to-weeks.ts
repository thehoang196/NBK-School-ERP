import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddSchoolIdToWeeks1749300006000 implements MigrationInterface {
  name = 'AddSchoolIdToWeeks1749300006000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Add school_id column (nullable initially for data migration)
    await queryRunner.query(`
      ALTER TABLE "weeks"
      ADD COLUMN "school_id" uuid
    `);

    // Populate school_id from semester → academic_year → school
    await queryRunner.query(`
      UPDATE "weeks" w
      SET "school_id" = ay."school_id"
      FROM "semesters" s
      JOIN "academic_years" ay ON s."academic_year_id" = ay."id"
      WHERE w."semester_id" = s."id"
    `);

    // Make school_id NOT NULL after data population
    await queryRunner.query(`
      ALTER TABLE "weeks"
      ALTER COLUMN "school_id" SET NOT NULL
    `);

    // Add foreign key constraint
    await queryRunner.query(`
      ALTER TABLE "weeks"
      ADD CONSTRAINT "FK_weeks_school"
      FOREIGN KEY ("school_id") REFERENCES "schools"("id")
      ON DELETE NO ACTION ON UPDATE NO ACTION
    `);

    // Add compound index for multi-tenant queries
    await queryRunner.query(`
      CREATE INDEX "IDX_weeks_school_deleted"
      ON "weeks" ("school_id", "deleted_at")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX "IDX_weeks_school_deleted"`);
    await queryRunner.query(
      `ALTER TABLE "weeks" DROP CONSTRAINT "FK_weeks_school"`,
    );
    await queryRunner.query(`ALTER TABLE "weeks" DROP COLUMN "school_id"`);
  }
}
