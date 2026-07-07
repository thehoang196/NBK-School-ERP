import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreatePayrollInputSnapshots1752100100000
  implements MigrationInterface
{
  name = 'CreatePayrollInputSnapshots1752100100000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "payroll_input_snapshots" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "school_id" uuid NOT NULL,
        "teacher_id" uuid NOT NULL,
        "payroll_run_id" uuid,
        "pay_period_id" uuid NOT NULL,
        "salary_slip_id" uuid,
        "attendance_days" decimal(5,2) NOT NULL DEFAULT 0,
        "teaching_hours_by_type" jsonb,
        "variable_values" jsonb,
        "formula_versions_used" jsonb,
        "created_at" timestamp NOT NULL DEFAULT now(),
        "updated_at" timestamp NOT NULL DEFAULT now(),
        "deleted_at" timestamp,
        "created_by" uuid,
        "updated_by" uuid,
        "version" int NOT NULL DEFAULT 1,
        CONSTRAINT "PK_payroll_input_snapshots" PRIMARY KEY ("id"),
        CONSTRAINT "FK_payroll_snapshots_school" FOREIGN KEY ("school_id") REFERENCES "schools"("id"),
        CONSTRAINT "FK_payroll_snapshots_teacher" FOREIGN KEY ("teacher_id") REFERENCES "teachers"("id"),
        CONSTRAINT "FK_payroll_snapshots_run" FOREIGN KEY ("payroll_run_id") REFERENCES "payroll_runs"("id"),
        CONSTRAINT "FK_payroll_snapshots_period" FOREIGN KEY ("pay_period_id") REFERENCES "pay_periods"("id")
      )
    `);

    await queryRunner.query(`
      CREATE INDEX "idx_payroll_snapshots_school" ON "payroll_input_snapshots" ("school_id", "deleted_at")
    `);
    await queryRunner.query(`
      CREATE INDEX "idx_payroll_snapshots_teacher_period" ON "payroll_input_snapshots" ("teacher_id", "pay_period_id")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "payroll_input_snapshots"`);
  }
}
