import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddPayrollRunIdToSalarySlips1752100000000
  implements MigrationInterface
{
  name = 'AddPayrollRunIdToSalarySlips1752100000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "salary_slips"
      ADD COLUMN "payroll_run_id" uuid REFERENCES "payroll_runs"("id")
    `);

    await queryRunner.query(`
      CREATE INDEX "idx_salary_slips_payroll_run"
      ON "salary_slips" ("payroll_run_id")
      WHERE "deleted_at" IS NULL
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "idx_salary_slips_payroll_run"`);
    await queryRunner.query(`ALTER TABLE "salary_slips" DROP COLUMN IF EXISTS "payroll_run_id"`);
  }
}
