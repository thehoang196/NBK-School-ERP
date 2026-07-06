import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateTimetableVersions1749000000000 implements MigrationInterface {
  name = 'CreateTimetableVersions1749000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Create enum type for timetable status
    await queryRunner.query(`
      CREATE TYPE "timetable_status_enum" AS ENUM ('draft', 'published', 'archived')
    `);

    // Create timetable_versions table
    await queryRunner.query(`
      CREATE TABLE "timetable_versions" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "semester_id" uuid NOT NULL,
        "name" varchar(100) NOT NULL,
        "version_number" int NOT NULL,
        "status" "timetable_status_enum" NOT NULL DEFAULT 'draft',
        "effective_date" date,
        "published_at" TIMESTAMP,
        "published_by" uuid,
        "note" text,
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
        "deleted_at" TIMESTAMP,
        CONSTRAINT "PK_timetable_versions" PRIMARY KEY ("id")
      )
    `);

    // Add foreign key constraint on semester_id
    await queryRunner.query(`
      ALTER TABLE "timetable_versions"
      ADD CONSTRAINT "FK_timetable_versions_semester"
      FOREIGN KEY ("semester_id") REFERENCES "semesters"("id")
      ON DELETE NO ACTION ON UPDATE NO ACTION
    `);

    // Create index on (semester_id, status) for querying published versions per semester
    await queryRunner.query(`
      CREATE INDEX "IDX_timetable_versions_semester_status"
      ON "timetable_versions" ("semester_id", "status")
    `);

    // Create index on (semester_id, version_number) for version numbering
    await queryRunner.query(`
      CREATE INDEX "IDX_timetable_versions_semester_version"
      ON "timetable_versions" ("semester_id", "version_number")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Drop indexes
    await queryRunner.query(
      `DROP INDEX "IDX_timetable_versions_semester_version"`,
    );
    await queryRunner.query(
      `DROP INDEX "IDX_timetable_versions_semester_status"`,
    );

    // Drop foreign key constraint
    await queryRunner.query(`
      ALTER TABLE "timetable_versions"
      DROP CONSTRAINT "FK_timetable_versions_semester"
    `);

    // Drop table
    await queryRunner.query(`DROP TABLE "timetable_versions"`);

    // Drop enum type
    await queryRunner.query(`DROP TYPE "timetable_status_enum"`);
  }
}
