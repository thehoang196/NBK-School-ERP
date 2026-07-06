import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateTimetableConflictLogs1749800000000 implements MigrationInterface {
  name = 'CreateTimetableConflictLogs1749800000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Create timetable_conflict_logs table
    await queryRunner.query(`
      CREATE TABLE "timetable_conflict_logs" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "school_id" uuid NOT NULL,
        "version_id" uuid NOT NULL,
        "conflict_type" varchar(50) NOT NULL,
        "severity" varchar(10) NOT NULL,
        "day_of_week" smallint NOT NULL,
        "period_id" uuid NOT NULL,
        "teacher_id" uuid,
        "class_id" uuid,
        "room_id" uuid,
        "subject_id" uuid,
        "conflicting_slot_id" uuid,
        "message" text NOT NULL,
        "details" jsonb,
        "validation_context" varchar(20) NOT NULL,
        "status" varchar(20) NOT NULL DEFAULT 'detected',
        "detected_at" TIMESTAMP NOT NULL DEFAULT now(),
        "overridden_by" uuid,
        "overridden_at" TIMESTAMP,
        "override_reason" text,
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
        "deleted_at" TIMESTAMP,
        CONSTRAINT "PK_timetable_conflict_logs" PRIMARY KEY ("id")
      )
    `);

    // Add foreign key constraint on school_id
    await queryRunner.query(`
      ALTER TABLE "timetable_conflict_logs"
      ADD CONSTRAINT "fk_conflict_log_school"
      FOREIGN KEY ("school_id") REFERENCES "schools"("id")
      ON DELETE NO ACTION ON UPDATE NO ACTION
    `);

    // Add foreign key constraint on version_id
    await queryRunner.query(`
      ALTER TABLE "timetable_conflict_logs"
      ADD CONSTRAINT "fk_conflict_log_version"
      FOREIGN KEY ("version_id") REFERENCES "timetable_versions"("id")
      ON DELETE NO ACTION ON UPDATE NO ACTION
    `);

    // Create partial indexes for performance (WHERE deleted_at IS NULL)
    await queryRunner.query(`
      CREATE INDEX "idx_conflict_log_school"
      ON "timetable_conflict_logs" ("school_id")
      WHERE "deleted_at" IS NULL
    `);

    await queryRunner.query(`
      CREATE INDEX "idx_conflict_log_version"
      ON "timetable_conflict_logs" ("version_id")
      WHERE "deleted_at" IS NULL
    `);

    await queryRunner.query(`
      CREATE INDEX "idx_conflict_log_type"
      ON "timetable_conflict_logs" ("conflict_type")
      WHERE "deleted_at" IS NULL
    `);

    await queryRunner.query(`
      CREATE INDEX "idx_conflict_log_teacher"
      ON "timetable_conflict_logs" ("teacher_id")
      WHERE "deleted_at" IS NULL
    `);

    await queryRunner.query(`
      CREATE INDEX "idx_conflict_log_class"
      ON "timetable_conflict_logs" ("class_id")
      WHERE "deleted_at" IS NULL
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Drop indexes
    await queryRunner.query(`DROP INDEX "idx_conflict_log_class"`);
    await queryRunner.query(`DROP INDEX "idx_conflict_log_teacher"`);
    await queryRunner.query(`DROP INDEX "idx_conflict_log_type"`);
    await queryRunner.query(`DROP INDEX "idx_conflict_log_version"`);
    await queryRunner.query(`DROP INDEX "idx_conflict_log_school"`);

    // Drop foreign key constraints
    await queryRunner.query(`
      ALTER TABLE "timetable_conflict_logs"
      DROP CONSTRAINT "fk_conflict_log_version"
    `);
    await queryRunner.query(`
      ALTER TABLE "timetable_conflict_logs"
      DROP CONSTRAINT "fk_conflict_log_school"
    `);

    // Drop table
    await queryRunner.query(`DROP TABLE IF EXISTS "timetable_conflict_logs"`);
  }
}
