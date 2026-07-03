import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddCompensationFkConstraints1749500001000 implements MigrationInterface {
  name = 'AddCompensationFkConstraints1749500001000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // ===== formulas =====
    // FK: formulas.pay_component_id → pay_components.id
    await queryRunner.query(`
      ALTER TABLE "formulas"
      ADD CONSTRAINT "FK_formulas_pay_component"
      FOREIGN KEY ("pay_component_id") REFERENCES "pay_components"("id")
      ON DELETE NO ACTION ON UPDATE NO ACTION
    `);

    // FK: formulas.school_id → schools.id
    await queryRunner.query(`
      ALTER TABLE "formulas"
      ADD CONSTRAINT "FK_formulas_school"
      FOREIGN KEY ("school_id") REFERENCES "schools"("id")
      ON DELETE NO ACTION ON UPDATE NO ACTION
    `);

    // ===== salary_slips =====
    // FK: salary_slips.teacher_id → teachers.id
    await queryRunner.query(`
      ALTER TABLE "salary_slips"
      ADD CONSTRAINT "FK_salary_slips_teacher"
      FOREIGN KEY ("teacher_id") REFERENCES "teachers"("id")
      ON DELETE NO ACTION ON UPDATE NO ACTION
    `);

    // FK: salary_slips.school_id → schools.id
    await queryRunner.query(`
      ALTER TABLE "salary_slips"
      ADD CONSTRAINT "FK_salary_slips_school"
      FOREIGN KEY ("school_id") REFERENCES "schools"("id")
      ON DELETE NO ACTION ON UPDATE NO ACTION
    `);

    // FK: salary_slips.pay_period_id → pay_periods.id
    await queryRunner.query(`
      ALTER TABLE "salary_slips"
      ADD CONSTRAINT "FK_salary_slips_pay_period"
      FOREIGN KEY ("pay_period_id") REFERENCES "pay_periods"("id")
      ON DELETE NO ACTION ON UPDATE NO ACTION
    `);

    // ===== compensation_policies =====
    // FK: compensation_policies.school_id → schools.id
    await queryRunner.query(`
      ALTER TABLE "compensation_policies"
      ADD CONSTRAINT "FK_compensation_policies_school"
      FOREIGN KEY ("school_id") REFERENCES "schools"("id")
      ON DELETE NO ACTION ON UPDATE NO ACTION
    `);

    // FK: compensation_policies.campus_id → campuses.id
    await queryRunner.query(`
      ALTER TABLE "compensation_policies"
      ADD CONSTRAINT "FK_compensation_policies_campus"
      FOREIGN KEY ("campus_id") REFERENCES "campuses"("id")
      ON DELETE NO ACTION ON UPDATE NO ACTION
    `);

    // ===== pay_components =====
    // FK: pay_components.school_id → schools.id
    await queryRunner.query(`
      ALTER TABLE "pay_components"
      ADD CONSTRAINT "FK_pay_components_school"
      FOREIGN KEY ("school_id") REFERENCES "schools"("id")
      ON DELETE NO ACTION ON UPDATE NO ACTION
    `);

    // ===== variable_overrides =====
    // FK: variable_overrides.variable_id → compensation_variables.id
    await queryRunner.query(`
      ALTER TABLE "variable_overrides"
      ADD CONSTRAINT "FK_variable_overrides_variable"
      FOREIGN KEY ("variable_id") REFERENCES "compensation_variables"("id")
      ON DELETE NO ACTION ON UPDATE NO ACTION
    `);

    // ===== compensation_audit_logs =====
    // FK: compensation_audit_logs.performed_by → users.id
    await queryRunner.query(`
      ALTER TABLE "compensation_audit_logs"
      ADD CONSTRAINT "FK_compensation_audit_logs_user"
      FOREIGN KEY ("performed_by") REFERENCES "users"("id")
      ON DELETE NO ACTION ON UPDATE NO ACTION
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Drop FK constraints in reverse order
    await queryRunner.query(`
      ALTER TABLE "compensation_audit_logs"
      DROP CONSTRAINT IF EXISTS "FK_compensation_audit_logs_user"
    `);
    await queryRunner.query(`
      ALTER TABLE "variable_overrides"
      DROP CONSTRAINT IF EXISTS "FK_variable_overrides_variable"
    `);
    await queryRunner.query(`
      ALTER TABLE "pay_components"
      DROP CONSTRAINT IF EXISTS "FK_pay_components_school"
    `);
    await queryRunner.query(`
      ALTER TABLE "compensation_policies"
      DROP CONSTRAINT IF EXISTS "FK_compensation_policies_campus"
    `);
    await queryRunner.query(`
      ALTER TABLE "compensation_policies"
      DROP CONSTRAINT IF EXISTS "FK_compensation_policies_school"
    `);
    await queryRunner.query(`
      ALTER TABLE "salary_slips"
      DROP CONSTRAINT IF EXISTS "FK_salary_slips_pay_period"
    `);
    await queryRunner.query(`
      ALTER TABLE "salary_slips"
      DROP CONSTRAINT IF EXISTS "FK_salary_slips_school"
    `);
    await queryRunner.query(`
      ALTER TABLE "salary_slips"
      DROP CONSTRAINT IF EXISTS "FK_salary_slips_teacher"
    `);
    await queryRunner.query(`
      ALTER TABLE "formulas"
      DROP CONSTRAINT IF EXISTS "FK_formulas_school"
    `);
    await queryRunner.query(`
      ALTER TABLE "formulas"
      DROP CONSTRAINT IF EXISTS "FK_formulas_pay_component"
    `);
  }
}
