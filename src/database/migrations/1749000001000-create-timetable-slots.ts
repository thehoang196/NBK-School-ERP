import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateTimetableSlots1749000001000 implements MigrationInterface {
  name = 'CreateTimetableSlots1749000001000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Create timetable_slots table
    await queryRunner.query(`
      CREATE TABLE "timetable_slots" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "version_id" uuid NOT NULL,
        "day_of_week" smallint NOT NULL,
        "period_id" uuid NOT NULL,
        "class_id" uuid NOT NULL,
        "teacher_id" uuid NOT NULL,
        "subject_id" uuid NOT NULL,
        "room_id" uuid,
        "is_double_period" boolean NOT NULL DEFAULT false,
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
        "deleted_at" TIMESTAMP,
        CONSTRAINT "PK_timetable_slots" PRIMARY KEY ("id")
      )
    `);

    // Add foreign key constraints
    await queryRunner.query(`
      ALTER TABLE "timetable_slots"
      ADD CONSTRAINT "FK_timetable_slots_version"
      FOREIGN KEY ("version_id") REFERENCES "timetable_versions"("id")
      ON DELETE NO ACTION ON UPDATE NO ACTION
    `);

    await queryRunner.query(`
      ALTER TABLE "timetable_slots"
      ADD CONSTRAINT "FK_timetable_slots_period"
      FOREIGN KEY ("period_id") REFERENCES "period_definitions"("id")
      ON DELETE NO ACTION ON UPDATE NO ACTION
    `);

    await queryRunner.query(`
      ALTER TABLE "timetable_slots"
      ADD CONSTRAINT "FK_timetable_slots_class"
      FOREIGN KEY ("class_id") REFERENCES "classes"("id")
      ON DELETE NO ACTION ON UPDATE NO ACTION
    `);

    await queryRunner.query(`
      ALTER TABLE "timetable_slots"
      ADD CONSTRAINT "FK_timetable_slots_teacher"
      FOREIGN KEY ("teacher_id") REFERENCES "teachers"("id")
      ON DELETE NO ACTION ON UPDATE NO ACTION
    `);

    await queryRunner.query(`
      ALTER TABLE "timetable_slots"
      ADD CONSTRAINT "FK_timetable_slots_subject"
      FOREIGN KEY ("subject_id") REFERENCES "subjects"("id")
      ON DELETE NO ACTION ON UPDATE NO ACTION
    `);

    await queryRunner.query(`
      ALTER TABLE "timetable_slots"
      ADD CONSTRAINT "FK_timetable_slots_room"
      FOREIGN KEY ("room_id") REFERENCES "rooms"("id")
      ON DELETE NO ACTION ON UPDATE NO ACTION
    `);

    // Create indexes for common query patterns
    await queryRunner.query(`
      CREATE INDEX "IDX_timetable_slots_version_day_period"
      ON "timetable_slots" ("version_id", "day_of_week", "period_id")
    `);

    await queryRunner.query(`
      CREATE INDEX "IDX_timetable_slots_version_teacher"
      ON "timetable_slots" ("version_id", "teacher_id")
    `);

    await queryRunner.query(`
      CREATE INDEX "IDX_timetable_slots_version_class"
      ON "timetable_slots" ("version_id", "class_id")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Drop indexes
    await queryRunner.query(`DROP INDEX "IDX_timetable_slots_version_class"`);
    await queryRunner.query(`DROP INDEX "IDX_timetable_slots_version_teacher"`);
    await queryRunner.query(
      `DROP INDEX "IDX_timetable_slots_version_day_period"`,
    );

    // Drop foreign key constraints
    await queryRunner.query(`
      ALTER TABLE "timetable_slots" DROP CONSTRAINT "FK_timetable_slots_room"
    `);
    await queryRunner.query(`
      ALTER TABLE "timetable_slots" DROP CONSTRAINT "FK_timetable_slots_subject"
    `);
    await queryRunner.query(`
      ALTER TABLE "timetable_slots" DROP CONSTRAINT "FK_timetable_slots_teacher"
    `);
    await queryRunner.query(`
      ALTER TABLE "timetable_slots" DROP CONSTRAINT "FK_timetable_slots_class"
    `);
    await queryRunner.query(`
      ALTER TABLE "timetable_slots" DROP CONSTRAINT "FK_timetable_slots_period"
    `);
    await queryRunner.query(`
      ALTER TABLE "timetable_slots" DROP CONSTRAINT "FK_timetable_slots_version"
    `);

    // Drop table
    await queryRunner.query(`DROP TABLE "timetable_slots"`);
  }
}
