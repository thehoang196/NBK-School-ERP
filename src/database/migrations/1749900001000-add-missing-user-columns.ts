import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Migration to add missing BaseEntity columns (created_by, updated_by, version)
 * to ALL tables that extend BaseEntity.
 *
 * Root cause: BaseEntity defines these columns but the original migrations
 * never included them, causing TypeORM SELECT/UPDATE queries to fail with
 * "column does not exist" errors.
 */
export class AddMissingBaseEntityColumns1749900001000
  implements MigrationInterface
{
  private readonly tables = [
    'users',
    'academic_years',
    'actual_timetable_slots',
    'campuses',
    'classes',
    'compensation_audit_logs',
    'compensation_policies',
    'compensation_rules',
    'compensation_variables',
    'department_members',
    'departments',
    'employee_masters',
    'events',
    'export_templates',
    'field_definitions',
    'formulas',
    'grades',
    'import_batches',
    'pay_components',
    'pay_periods',
    'period_definitions',
    'reconciliation_sessions',
    'rooms',
    'salary_slips',
    'schools',
    'semesters',
    'sessions',
    'subject_grades',
    'subjects',
    'sync_logs',
    'teacher_subjects',
    'teachers',
    'teaching_assignments',
    'timetable_slots',
    'timetable_versions',
    'validation_rules',
    'variable_overrides',
    'weeks',
  ];

  public async up(queryRunner: QueryRunner): Promise<void> {
    for (const table of this.tables) {
      await queryRunner.query(`
        ALTER TABLE "${table}"
        ADD COLUMN IF NOT EXISTS "created_by" uuid NULL
      `);
      await queryRunner.query(`
        ALTER TABLE "${table}"
        ADD COLUMN IF NOT EXISTS "updated_by" uuid NULL
      `);
      await queryRunner.query(`
        ALTER TABLE "${table}"
        ADD COLUMN IF NOT EXISTS "version" integer NOT NULL DEFAULT 1
      `);
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    for (const table of this.tables) {
      await queryRunner.query(
        `ALTER TABLE "${table}" DROP COLUMN IF EXISTS "version"`,
      );
      await queryRunner.query(
        `ALTER TABLE "${table}" DROP COLUMN IF EXISTS "updated_by"`,
      );
      await queryRunner.query(
        `ALTER TABLE "${table}" DROP COLUMN IF EXISTS "created_by"`,
      );
    }
  }
}
