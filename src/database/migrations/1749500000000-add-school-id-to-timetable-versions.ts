import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddSchoolIdToTimetableVersions1749500000000 implements MigrationInterface {
  name = 'AddSchoolIdToTimetableVersions1749500000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Add school_id column to timetable_versions (nullable for backward compatibility)
    await queryRunner.query(`
      ALTER TABLE "timetable_versions"
      ADD COLUMN "school_id" uuid
    `);

    // Backfill school_id from the semester → academic_year → school chain
    await queryRunner.query(`
      UPDATE "timetable_versions" tv
      SET "school_id" = ay."school_id"
      FROM "semesters" s
      JOIN "academic_years" ay ON ay."id" = s."academic_year_id"
      WHERE tv."semester_id" = s."id"
        AND tv."school_id" IS NULL
    `);

    // Add FK constraint
    await queryRunner.query(`
      ALTER TABLE "timetable_versions"
      ADD CONSTRAINT "FK_timetable_versions_school"
      FOREIGN KEY ("school_id") REFERENCES "schools"("id")
      ON DELETE NO ACTION ON UPDATE NO ACTION
    `);

    // Add index for school-level queries
    await queryRunner.query(`
      CREATE INDEX "IDX_timetable_versions_school_id"
      ON "timetable_versions" ("school_id")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX "IDX_timetable_versions_school_id"`);
    await queryRunner.query(`
      ALTER TABLE "timetable_versions"
      DROP CONSTRAINT "FK_timetable_versions_school"
    `);
    await queryRunner.query(`
      ALTER TABLE "timetable_versions"
      DROP COLUMN "school_id"
    `);
  }
}
