import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreatePayrollAdjustments1751800300000 implements MigrationInterface {
  name = 'CreatePayrollAdjustments1751800300000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "payroll_adjustments" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "school_id" uuid NOT NULL,
        "teacher_id" uuid NOT NULL,
        "original_pay_period_id" uuid NOT NULL,
        "applied_pay_period_id" uuid,
        "type" "pay_component_type_enum" NOT NULL,
        "description" varchar(255) NOT NULL,
        "amount" decimal(15,2) NOT NULL,
        "reason" text NOT NULL,
        "is_applied" boolean NOT NULL DEFAULT false,
        "approved_by" uuid,
        "approved_at" TIMESTAMP,
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
        "deleted_at" TIMESTAMP,
        "created_by" uuid,
        "updated_by" uuid,
        "version" integer NOT NULL DEFAULT 1,
        CONSTRAINT "PK_payroll_adjustments" PRIMARY KEY ("id"),
        CONSTRAINT "FK_payroll_adjustments_school" FOREIGN KEY ("school_id") REFERENCES "schools"("id"),
        CONSTRAINT "FK_payroll_adjustments_teacher" FOREIGN KEY ("teacher_id") REFERENCES "teachers"("id"),
        CONSTRAINT "FK_payroll_adjustments_original_period" FOREIGN KEY ("original_pay_period_id") REFERENCES "pay_periods"("id"),
        CONSTRAINT "FK_payroll_adjustments_applied_period" FOREIGN KEY ("applied_pay_period_id") REFERENCES "pay_periods"("id")
      )
    `);

    await queryRunner.query(`
      CREATE INDEX "idx_payroll_adjustments_school" ON "payroll_adjustments" ("school_id", "deleted_at")
    `);
    await queryRunner.query(`
      CREATE INDEX "idx_payroll_adjustments_teacher" ON "payroll_adjustments" ("teacher_id", "is_applied")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE "payroll_adjustments"`);
  }
}
