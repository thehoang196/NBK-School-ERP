import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateAttendanceSummaries1751800100000 implements MigrationInterface {
  name = 'CreateAttendanceSummaries1751800100000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "attendance_summaries" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "school_id" uuid NOT NULL,
        "teacher_id" uuid NOT NULL,
        "month" smallint NOT NULL,
        "year" smallint NOT NULL,
        "actual_work_days" decimal(5,2) NOT NULL DEFAULT 0,
        "standard_work_days" decimal(5,2) NOT NULL DEFAULT 22,
        "total_overtime_hours" decimal(6,2) NOT NULL DEFAULT 0,
        "paid_leave_days" decimal(5,2) NOT NULL DEFAULT 0,
        "unpaid_leave_days" decimal(5,2) NOT NULL DEFAULT 0,
        "late_days" integer NOT NULL DEFAULT 0,
        "absent_days" integer NOT NULL DEFAULT 0,
        "is_finalized" boolean NOT NULL DEFAULT false,
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
        "deleted_at" TIMESTAMP,
        "created_by" uuid,
        "updated_by" uuid,
        "version" integer NOT NULL DEFAULT 1,
        CONSTRAINT "PK_attendance_summaries" PRIMARY KEY ("id"),
        CONSTRAINT "FK_attendance_summaries_school" FOREIGN KEY ("school_id") REFERENCES "schools"("id"),
        CONSTRAINT "FK_attendance_summaries_teacher" FOREIGN KEY ("teacher_id") REFERENCES "teachers"("id"),
        CONSTRAINT "uq_attendance_summary_teacher_period" UNIQUE ("school_id", "teacher_id", "month", "year")
      )
    `);

    await queryRunner.query(`
      CREATE INDEX "idx_attendance_summaries_school_deleted" ON "attendance_summaries" ("school_id", "deleted_at")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE "attendance_summaries"`);
  }
}
