import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreatePayrollRuns1751800200000 implements MigrationInterface {
  name = 'CreatePayrollRuns1751800200000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Create payroll_run_status enum
    await queryRunner.query(`
      CREATE TYPE "payroll_run_status_enum" AS ENUM ('draft', 'reviewed', 'approved', 'paid', 'rejected')
    `);

    // Create approval_action enum
    await queryRunner.query(`
      CREATE TYPE "approval_action_enum" AS ENUM ('submit_for_review', 'review', 'approve', 'reject', 'mark_paid')
    `);

    // Create payroll_runs table
    await queryRunner.query(`
      CREATE TABLE "payroll_runs" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "school_id" uuid NOT NULL,
        "pay_period_id" uuid NOT NULL,
        "name" varchar(200) NOT NULL,
        "status" "payroll_run_status_enum" NOT NULL DEFAULT 'draft',
        "total_teachers" integer NOT NULL DEFAULT 0,
        "success_count" integer NOT NULL DEFAULT 0,
        "error_count" integer NOT NULL DEFAULT 0,
        "total_gross" decimal(15,2) NOT NULL DEFAULT 0,
        "total_net" decimal(15,2) NOT NULL DEFAULT 0,
        "submitted_by" uuid,
        "submitted_at" TIMESTAMP,
        "reviewed_by" uuid,
        "reviewed_at" TIMESTAMP,
        "approved_by" uuid,
        "approved_at" TIMESTAMP,
        "paid_at" TIMESTAMP,
        "rejection_reason" text,
        "note" text,
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
        "deleted_at" TIMESTAMP,
        "created_by" uuid,
        "updated_by" uuid,
        "version" integer NOT NULL DEFAULT 1,
        CONSTRAINT "PK_payroll_runs" PRIMARY KEY ("id"),
        CONSTRAINT "FK_payroll_runs_school" FOREIGN KEY ("school_id") REFERENCES "schools"("id"),
        CONSTRAINT "FK_payroll_runs_pay_period" FOREIGN KEY ("pay_period_id") REFERENCES "pay_periods"("id")
      )
    `);

    // Create payroll_approvals table
    await queryRunner.query(`
      CREATE TABLE "payroll_approvals" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "school_id" uuid NOT NULL,
        "payroll_run_id" uuid NOT NULL,
        "action" "approval_action_enum" NOT NULL,
        "from_status" varchar(20) NOT NULL,
        "to_status" varchar(20) NOT NULL,
        "performed_by" uuid NOT NULL,
        "comment" text,
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
        "deleted_at" TIMESTAMP,
        "created_by" uuid,
        "updated_by" uuid,
        "version" integer NOT NULL DEFAULT 1,
        CONSTRAINT "PK_payroll_approvals" PRIMARY KEY ("id"),
        CONSTRAINT "FK_payroll_approvals_school" FOREIGN KEY ("school_id") REFERENCES "schools"("id"),
        CONSTRAINT "FK_payroll_approvals_run" FOREIGN KEY ("payroll_run_id") REFERENCES "payroll_runs"("id")
      )
    `);

    // Indexes
    await queryRunner.query(`
      CREATE INDEX "idx_payroll_runs_school_status" ON "payroll_runs" ("school_id", "status")
    `);
    await queryRunner.query(`
      CREATE INDEX "idx_payroll_approvals_run" ON "payroll_approvals" ("payroll_run_id")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE "payroll_approvals"`);
    await queryRunner.query(`DROP TABLE "payroll_runs"`);
    await queryRunner.query(`DROP TYPE IF EXISTS "approval_action_enum"`);
    await queryRunner.query(`DROP TYPE IF EXISTS "payroll_run_status_enum"`);
  }
}
