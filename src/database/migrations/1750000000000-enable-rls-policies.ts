import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Enable Row-Level Security (RLS) on all tenant-scoped tables and create
 * isolation policies for defense-in-depth multi-tenant enforcement.
 */
export class EnableRlsPolicies1750000000000 implements MigrationInterface {
  name = 'EnableRlsPolicies1750000000000';

  /**
   * All tenant-scoped tables that have a school_id column.
   */
  private readonly tenantTables: string[] = [
    'campuses',
    'academic_years',
    'semesters',
    'weeks',
    'sessions',
    'period_definitions',
    'grades',
    'classes',
    'teachers',
    'subjects',
    'rooms',
    'departments',
    'subject_grades',
    'timetable_versions',
    'timetable_slots',
    'actual_timetable_slots',
    'teaching_assignments',
    'events',
    'pay_components',
    'compensation_variables',
    'formulas',
    'compensation_rules',
    'pay_periods',
  ];

  public async up(queryRunner: QueryRunner): Promise<void> {
    // 1. Create database roles if they don't exist
    await queryRunner.query(`
      DO $$ BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'app_role') THEN
          CREATE ROLE app_role NOLOGIN;
        END IF;
        IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'migration_role') THEN
          CREATE ROLE migration_role NOLOGIN;
        END IF;
      END $$;
    `);

    // 2. Enable RLS and create policies on each tenant-scoped table
    //    Only apply to tables that actually have a school_id column.
    for (const table of this.tenantTables) {
      const hasSchoolId = await queryRunner.query(`
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = '${table}'
          AND column_name = 'school_id'
        LIMIT 1
      `);

      if (!hasSchoolId || hasSchoolId.length === 0) {
        continue; // Skip tables without school_id
      }

      await queryRunner.query(`ALTER TABLE "${table}" ENABLE ROW LEVEL SECURITY`);

      await queryRunner.query(`
        DO $$ BEGIN
          IF NOT EXISTS (
            SELECT 1 FROM pg_policies WHERE tablename = '${table}' AND policyname = 'tenant_isolation_policy'
          ) THEN
            CREATE POLICY "tenant_isolation_policy" ON "${table}"
              FOR ALL TO app_role
              USING (school_id = current_setting('app.current_school_id')::uuid)
              WITH CHECK (school_id = current_setting('app.current_school_id')::uuid);
          END IF;
        END $$;
      `);

      await queryRunner.query(`
        DO $$ BEGIN
          IF NOT EXISTS (
            SELECT 1 FROM pg_policies WHERE tablename = '${table}' AND policyname = 'super_admin_bypass_policy'
          ) THEN
            CREATE POLICY "super_admin_bypass_policy" ON "${table}"
              FOR ALL TO app_role
              USING (current_setting('app.current_school_id', true) = 'BYPASS')
              WITH CHECK (current_setting('app.current_school_id', true) = 'BYPASS');
          END IF;
        END $$;
      `);

      await queryRunner.query(`
        DO $$ BEGIN
          IF NOT EXISTS (
            SELECT 1 FROM pg_policies WHERE tablename = '${table}' AND policyname = 'migration_bypass_policy'
          ) THEN
            CREATE POLICY "migration_bypass_policy" ON "${table}"
              FOR ALL TO migration_role
              USING (true)
              WITH CHECK (true);
          END IF;
        END $$;
      `);
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    for (const table of this.tenantTables) {
      await queryRunner.query(`DROP POLICY IF EXISTS "migration_bypass_policy" ON "${table}"`);
      await queryRunner.query(`DROP POLICY IF EXISTS "super_admin_bypass_policy" ON "${table}"`);
      await queryRunner.query(`DROP POLICY IF EXISTS "tenant_isolation_policy" ON "${table}"`);
      await queryRunner.query(`ALTER TABLE "${table}" DISABLE ROW LEVEL SECURITY`);
    }
  }
}
