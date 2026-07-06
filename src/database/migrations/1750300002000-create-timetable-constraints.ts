import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateTimetableConstraints1750300002000 implements MigrationInterface {
  name = 'CreateTimetableConstraints1750300002000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TYPE "constraint_type_enum" AS ENUM (
        'max_periods_per_day', 'max_consecutive', 'min_gap',
        'preferred_slot', 'avoid_slot', 'room_lock',
        'teacher_unavailable', 'class_unavailable',
        'subject_not_available', 'preferred_room',
        'max_hours_daily', 'min_hours_daily', 'break_required'
      )
    `);

    await queryRunner.query(`
      CREATE TYPE "constraint_entity_type_enum" AS ENUM ('teacher', 'class', 'subject', 'room', 'global')
    `);

    await queryRunner.query(`
      CREATE TYPE "constraint_priority_enum" AS ENUM ('required', 'high', 'medium', 'low')
    `);

    await queryRunner.query(`
      CREATE TABLE "timetable_constraints" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "school_id" uuid NOT NULL,
        "timetable_version_id" uuid,
        "constraint_type" "constraint_type_enum" NOT NULL,
        "entity_type" "constraint_entity_type_enum" NOT NULL DEFAULT 'global',
        "entity_id" uuid,
        "priority" "constraint_priority_enum" NOT NULL DEFAULT 'required',
        "parameters" jsonb,
        "description" text,
        "is_active" boolean NOT NULL DEFAULT true,
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
        "deleted_at" TIMESTAMP,
        "created_by" uuid,
        "updated_by" uuid,
        "version" int NOT NULL DEFAULT 1,
        CONSTRAINT "PK_timetable_constraints" PRIMARY KEY ("id")
      )
    `);

    await queryRunner.query(`
      CREATE INDEX "idx_timetable_constraints_school_version" ON "timetable_constraints" ("school_id", "timetable_version_id")
    `);

    await queryRunner.query(`
      CREATE INDEX "idx_timetable_constraints_type_entity" ON "timetable_constraints" ("constraint_type", "entity_type")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX "idx_timetable_constraints_type_entity"`);
    await queryRunner.query(`DROP INDEX "idx_timetable_constraints_school_version"`);
    await queryRunner.query(`DROP TABLE "timetable_constraints"`);
    await queryRunner.query(`DROP TYPE "constraint_priority_enum"`);
    await queryRunner.query(`DROP TYPE "constraint_entity_type_enum"`);
    await queryRunner.query(`DROP TYPE "constraint_type_enum"`);
  }
}
