import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateAttendanceRecords1751800000000 implements MigrationInterface {
  name = 'CreateAttendanceRecords1751800000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Create enum types FIRST (before table that references them)
    await queryRunner.query(`
      DO $$ BEGIN
        CREATE TYPE "attendance_status_enum" AS ENUM ('present', 'late', 'absent', 'leave', 'half_day');
      EXCEPTION
        WHEN duplicate_object THEN null;
      END $$
    `);

    await queryRunner.query(`
      DO $$ BEGIN
        CREATE TYPE "attendance_method_enum" AS ENUM ('qr', 'gps', 'nfc', 'manual');
      EXCEPTION
        WHEN duplicate_object THEN null;
      END $$
    `);

    await queryRunner.query(`
      DO $$ BEGIN
        CREATE TYPE "leave_type_enum" AS ENUM ('annual', 'sick', 'unpaid', 'maternity', 'holiday', 'other');
      EXCEPTION
        WHEN duplicate_object THEN null;
      END $$
    `);

    // Create attendance_records table
    await queryRunner.query(`
      CREATE TABLE "attendance_records" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "school_id" uuid NOT NULL,
        "teacher_id" uuid NOT NULL,
        "work_date" date NOT NULL,
        "check_in" time,
        "check_out" time,
        "status" "attendance_status_enum" NOT NULL DEFAULT 'present',
        "method" "attendance_method_enum" NOT NULL DEFAULT 'manual',
        "leave_type" "leave_type_enum",
        "overtime_hours" decimal(4,2) NOT NULL DEFAULT 0,
        "work_coefficient" decimal(3,2) NOT NULL DEFAULT 1,
        "note" text,
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
        "deleted_at" TIMESTAMP,
        "created_by" uuid,
        "updated_by" uuid,
        "version" integer NOT NULL DEFAULT 1,
        CONSTRAINT "PK_attendance_records" PRIMARY KEY ("id"),
        CONSTRAINT "FK_attendance_records_school" FOREIGN KEY ("school_id") REFERENCES "schools"("id"),
        CONSTRAINT "FK_attendance_records_teacher" FOREIGN KEY ("teacher_id") REFERENCES "teachers"("id")
      )
    `);

    // Create indexes
    await queryRunner.query(`
      CREATE INDEX "idx_attendance_records_school_deleted" ON "attendance_records" ("school_id", "deleted_at")
    `);
    await queryRunner.query(`
      CREATE INDEX "idx_attendance_records_teacher_date" ON "attendance_records" ("teacher_id", "work_date")
    `);
    await queryRunner.query(`
      CREATE INDEX "idx_attendance_records_school_date" ON "attendance_records" ("school_id", "work_date")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP TABLE IF EXISTS "attendance_records"');
    await queryRunner.query('DROP TYPE IF EXISTS "leave_type_enum"');
    await queryRunner.query('DROP TYPE IF EXISTS "attendance_method_enum"');
    await queryRunner.query('DROP TYPE IF EXISTS "attendance_status_enum"');
  }
}
