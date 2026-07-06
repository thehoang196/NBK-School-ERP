import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddSchoolIdToActualTimetableSlots1750400000000
  implements MigrationInterface
{
  name = 'AddSchoolIdToActualTimetableSlots1750400000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Add school_id column
    await queryRunner.query(`
      ALTER TABLE "actual_timetable_slots"
        ADD COLUMN "school_id" uuid
    `);

    // Backfill school_id from class table
    await queryRunner.query(`
      UPDATE "actual_timetable_slots" ats
      SET "school_id" = c."school_id"
      FROM "classes" c
      WHERE ats."class_id" = c."id"
        AND ats."school_id" IS NULL
    `);

    // Set NOT NULL after backfill
    await queryRunner.query(`
      ALTER TABLE "actual_timetable_slots"
        ALTER COLUMN "school_id" SET NOT NULL
    `);

    // Add index for tenant filtering
    await queryRunner.query(`
      CREATE INDEX "idx_actual_timetable_slots_school_deleted"
      ON "actual_timetable_slots" ("school_id", "deleted_at")
    `);

    // Add FK constraint
    await queryRunner.query(`
      ALTER TABLE "actual_timetable_slots"
        ADD CONSTRAINT "FK_actual_timetable_slots_school"
        FOREIGN KEY ("school_id") REFERENCES "schools"("id") ON DELETE RESTRICT
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "actual_timetable_slots" DROP CONSTRAINT "FK_actual_timetable_slots_school"`,
    );
    await queryRunner.query(
      `DROP INDEX "idx_actual_timetable_slots_school_deleted"`,
    );
    await queryRunner.query(
      `ALTER TABLE "actual_timetable_slots" DROP COLUMN "school_id"`,
    );
  }
}
