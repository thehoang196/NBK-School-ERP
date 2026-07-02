import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateEvents1749100000000 implements MigrationInterface {
  name = 'CreateEvents1749100000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Create enum types
    await queryRunner.query(`
      CREATE TYPE "event_type_enum" AS ENUM ('exam', 'holiday', 'event', 'meeting', 'other')
    `);

    await queryRunner.query(`
      CREATE TYPE "event_status_enum" AS ENUM ('active', 'cancelled')
    `);

    // Create events table
    await queryRunner.query(`
      CREATE TABLE "events" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "school_id" uuid NOT NULL,
        "title" varchar(200) NOT NULL,
        "description" text,
        "event_type" "event_type_enum" NOT NULL,
        "start_date" TIMESTAMP NOT NULL,
        "end_date" TIMESTAMP NOT NULL,
        "all_day" boolean NOT NULL DEFAULT false,
        "affects_schedule" boolean NOT NULL DEFAULT false,
        "is_recurring" boolean NOT NULL DEFAULT false,
        "recurrence_rule" jsonb,
        "affected_grades" jsonb,
        "affected_classes" jsonb,
        "status" "event_status_enum" NOT NULL DEFAULT 'active',
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
        "deleted_at" TIMESTAMP,
        CONSTRAINT "PK_events" PRIMARY KEY ("id")
      )
    `);

    // Add foreign key constraint on school_id
    await queryRunner.query(`
      ALTER TABLE "events"
      ADD CONSTRAINT "FK_events_school"
      FOREIGN KEY ("school_id") REFERENCES "schools"("id")
      ON DELETE NO ACTION ON UPDATE NO ACTION
    `);

    // Index on school_id for filtering by school
    await queryRunner.query(`
      CREATE INDEX "IDX_events_school_id"
      ON "events" ("school_id")
    `);

    // Index on (school_id, event_type) for filtering
    await queryRunner.query(`
      CREATE INDEX "IDX_events_school_type"
      ON "events" ("school_id", "event_type")
    `);

    // Index on (start_date, end_date) for date range queries and calendar view
    await queryRunner.query(`
      CREATE INDEX "IDX_events_dates"
      ON "events" ("start_date", "end_date")
    `);

    // Index for schedule-affecting events lookup
    await queryRunner.query(`
      CREATE INDEX "IDX_events_affects_schedule"
      ON "events" ("school_id", "affects_schedule")
      WHERE "affects_schedule" = true AND "deleted_at" IS NULL
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Drop indexes
    await queryRunner.query(`DROP INDEX "IDX_events_affects_schedule"`);
    await queryRunner.query(`DROP INDEX "IDX_events_dates"`);
    await queryRunner.query(`DROP INDEX "IDX_events_school_type"`);
    await queryRunner.query(`DROP INDEX "IDX_events_school_id"`);

    // Drop foreign key constraint
    await queryRunner.query(`
      ALTER TABLE "events"
      DROP CONSTRAINT "FK_events_school"
    `);

    // Drop table
    await queryRunner.query(`DROP TABLE "events"`);

    // Drop enum types
    await queryRunner.query(`DROP TYPE "event_status_enum"`);
    await queryRunner.query(`DROP TYPE "event_type_enum"`);
  }
}
