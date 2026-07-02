import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateActualTimetableSlots1749000002000 implements MigrationInterface {
  name = 'CreateActualTimetableSlots1749000002000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Create enum type for slot status
    await queryRunner.query(`
      CREATE TYPE "slot_status_enum" AS ENUM ('scheduled', 'cancelled', 'substituted')
    `);

    // Create actual_timetable_slots table
    await queryRunner.query(`
      CREATE TABLE "actual_timetable_slots" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "semester_id" uuid NOT NULL,
        "week_id" uuid NOT NULL,
        "day_of_week" smallint NOT NULL,
        "period_id" uuid NOT NULL,
        "class_id" uuid NOT NULL,
        "teacher_id" uuid NOT NULL,
        "subject_id" uuid NOT NULL,
        "room_id" uuid,
        "original_teacher_id" uuid,
        "slot_status" "slot_status_enum" NOT NULL DEFAULT 'scheduled',
        "note" text,
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
        "deleted_at" TIMESTAMP,
        CONSTRAINT "PK_actual_timetable_slots" PRIMARY KEY ("id")
      )
    `);

    // Add foreign key constraints
    await queryRunner.query(`
      ALTER TABLE "actual_timetable_slots"
      ADD CONSTRAINT "FK_actual_timetable_slots_semester"
      FOREIGN KEY ("semester_id") REFERENCES "semesters"("id")
      ON DELETE NO ACTION ON UPDATE NO ACTION
    `);

    await queryRunner.query(`
      ALTER TABLE "actual_timetable_slots"
      ADD CONSTRAINT "FK_actual_timetable_slots_week"
      FOREIGN KEY ("week_id") REFERENCES "weeks"("id")
      ON DELETE NO ACTION ON UPDATE NO ACTION
    `);

    await queryRunner.query(`
      ALTER TABLE "actual_timetable_slots"
      ADD CONSTRAINT "FK_actual_timetable_slots_period"
      FOREIGN KEY ("period_id") REFERENCES "period_definitions"("id")
      ON DELETE NO ACTION ON UPDATE NO ACTION
    `);

    await queryRunner.query(`
      ALTER TABLE "actual_timetable_slots"
      ADD CONSTRAINT "FK_actual_timetable_slots_class"
      FOREIGN KEY ("class_id") REFERENCES "classes"("id")
      ON DELETE NO ACTION ON UPDATE NO ACTION
    `);

    await queryRunner.query(`
      ALTER TABLE "actual_timetable_slots"
      ADD CONSTRAINT "FK_actual_timetable_slots_teacher"
      FOREIGN KEY ("teacher_id") REFERENCES "teachers"("id")
      ON DELETE NO ACTION ON UPDATE NO ACTION
    `);

    await queryRunner.query(`
      ALTER TABLE "actual_timetable_slots"
      ADD CONSTRAINT "FK_actual_timetable_slots_subject"
      FOREIGN KEY ("subject_id") REFERENCES "subjects"("id")
      ON DELETE NO ACTION ON UPDATE NO ACTION
    `);

    await queryRunner.query(`
      ALTER TABLE "actual_timetable_slots"
      ADD CONSTRAINT "FK_actual_timetable_slots_room"
      FOREIGN KEY ("room_id") REFERENCES "rooms"("id")
      ON DELETE NO ACTION ON UPDATE NO ACTION
    `);

    await queryRunner.query(`
      ALTER TABLE "actual_timetable_slots"
      ADD CONSTRAINT "FK_actual_timetable_slots_original_teacher"
      FOREIGN KEY ("original_teacher_id") REFERENCES "teachers"("id")
      ON DELETE NO ACTION ON UPDATE NO ACTION
    `);

    // Create indexes for common query patterns
    await queryRunner.query(`
      CREATE INDEX "IDX_actual_timetable_slots_semester_week_day_period"
      ON "actual_timetable_slots" ("semester_id", "week_id", "day_of_week", "period_id")
    `);

    await queryRunner.query(`
      CREATE INDEX "IDX_actual_timetable_slots_week_teacher"
      ON "actual_timetable_slots" ("week_id", "teacher_id")
    `);

    await queryRunner.query(`
      CREATE INDEX "IDX_actual_timetable_slots_week_class"
      ON "actual_timetable_slots" ("week_id", "class_id")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Drop indexes
    await queryRunner.query(`DROP INDEX "IDX_actual_timetable_slots_week_class"`);
    await queryRunner.query(`DROP INDEX "IDX_actual_timetable_slots_week_teacher"`);
    await queryRunner.query(`DROP INDEX "IDX_actual_timetable_slots_semester_week_day_period"`);

    // Drop foreign key constraints
    await queryRunner.query(`
      ALTER TABLE "actual_timetable_slots" DROP CONSTRAINT "FK_actual_timetable_slots_original_teacher"
    `);
    await queryRunner.query(`
      ALTER TABLE "actual_timetable_slots" DROP CONSTRAINT "FK_actual_timetable_slots_room"
    `);
    await queryRunner.query(`
      ALTER TABLE "actual_timetable_slots" DROP CONSTRAINT "FK_actual_timetable_slots_subject"
    `);
    await queryRunner.query(`
      ALTER TABLE "actual_timetable_slots" DROP CONSTRAINT "FK_actual_timetable_slots_teacher"
    `);
    await queryRunner.query(`
      ALTER TABLE "actual_timetable_slots" DROP CONSTRAINT "FK_actual_timetable_slots_class"
    `);
    await queryRunner.query(`
      ALTER TABLE "actual_timetable_slots" DROP CONSTRAINT "FK_actual_timetable_slots_period"
    `);
    await queryRunner.query(`
      ALTER TABLE "actual_timetable_slots" DROP CONSTRAINT "FK_actual_timetable_slots_week"
    `);
    await queryRunner.query(`
      ALTER TABLE "actual_timetable_slots" DROP CONSTRAINT "FK_actual_timetable_slots_semester"
    `);

    // Drop table
    await queryRunner.query(`DROP TABLE "actual_timetable_slots"`);

    // Drop enum type
    await queryRunner.query(`DROP TYPE "slot_status_enum"`);
  }
}
