import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateLeaveRequests1751800400000 implements MigrationInterface {
  name = 'CreateLeaveRequests1751800400000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Create enums
    await queryRunner.query(`
      CREATE TYPE "leave_request_status_enum" AS ENUM ('pending', 'approved', 'rejected', 'cancelled')
    `);
    await queryRunner.query(`
      CREATE TYPE "leave_request_type_enum" AS ENUM ('annual', 'sick', 'unpaid', 'personal', 'maternity', 'other')
    `);

    // Create leave_requests table
    await queryRunner.query(`
      CREATE TABLE "leave_requests" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "school_id" uuid NOT NULL,
        "teacher_id" uuid NOT NULL,
        "leave_type" "leave_request_type_enum" NOT NULL,
        "start_date" date NOT NULL,
        "end_date" date NOT NULL,
        "total_days" decimal(4,1) NOT NULL DEFAULT 1,
        "reason" text NOT NULL,
        "status" "leave_request_status_enum" NOT NULL DEFAULT 'pending',
        "approved_by" uuid,
        "approved_at" TIMESTAMP,
        "rejection_reason" text,
        "admin_note" text,
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
        "deleted_at" TIMESTAMP,
        "created_by" uuid,
        "updated_by" uuid,
        "version" integer NOT NULL DEFAULT 1,
        CONSTRAINT "PK_leave_requests" PRIMARY KEY ("id"),
        CONSTRAINT "FK_leave_requests_school" FOREIGN KEY ("school_id") REFERENCES "schools"("id"),
        CONSTRAINT "FK_leave_requests_teacher" FOREIGN KEY ("teacher_id") REFERENCES "teachers"("id")
      )
    `);

    await queryRunner.query(`
      CREATE INDEX "idx_leave_requests_school_deleted" ON "leave_requests" ("school_id", "deleted_at")
    `);
    await queryRunner.query(`
      CREATE INDEX "idx_leave_requests_teacher_status" ON "leave_requests" ("teacher_id", "status")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE "leave_requests"`);
    await queryRunner.query(`DROP TYPE IF EXISTS "leave_request_type_enum"`);
    await queryRunner.query(`DROP TYPE IF EXISTS "leave_request_status_enum"`);
  }
}
