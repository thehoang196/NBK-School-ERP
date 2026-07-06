import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Enable Row-Level Security (RLS) on all tenant-scoped tables and create
 * isolation policies for defense-in-depth multi-tenant enforcement.
 *
 * Policies:
 * 1. tenant_isolation_policy (app_role) — restricts access to rows matching current tenant
 * 2. super_admin_bypass_policy (app_role) — allows full access when session var = 'BYPASS'
 * 3. migration_bypass_policy (migration_role) — unrestricted access for migrations/seeds
 *
 * Requirements: 4.1, 4.2, 4.4, 4.5, 4.6
 */
export class EnableRlsPolicies1750000000000 implements MigrationInterface {
  name = 'EnableRlsPolicies1750000000000';

  /**
   * All 24 tenant-scoped tables that have a school_id column.
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
    // =========================================================
    // 1. Create database roles if they don't exist
    // =========================================================
    await queryRunner.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'app_role') THEN
          CREATE ROLE app_role NOLOGIN;
        END IF;
        IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'migration_role') THEN
          CREATE ROLE migration_role NOLOGIN;
        END IF;
      END
      $$;
    `);

    // =========================================================
    // 2. Enable RLS and create policies on each tenant-scoped table
    // =========================================================
    for (const table of this.tenantTables) {
      // Enable Row-Level Security
      await queryRunner.query(`
        ALTER TABLE "${table}" ENABLE ROW LEVEL SECURITY
      `);

      // Policy 1: Tenant isolation — app_role can only access rows
      // where school_id matches the current session variable
      await queryRunner.query(`
        CREATE POLICY "tenant_isolation_policy" ON "${table}"
          FOR ALL
          TO app_role
          USING (school_id = current_setting('app.current_school_id')::uuid)
          WITH CHECK (school_id = current_setting('app.current_school_id')::uuid)
      `);

      // Policy 2: Super admin bypass — app_role gets unrestricted access
      // when session variable is set to 'BYPASS'
      await queryRunner.query(`
        CREATE POLICY "super_admin_bypass_policy" ON "${table}"
          FOR ALL
          TO app_role
          USING (current_setting('app.current_school_id', true) = 'BYPASS')
          WITH CHECK (current_setting('app.current_school_id', true) = 'BYPASS')
      `);

      // Policy 3: Migration bypass — migration_role has unrestricted access
      await queryRunner.query(`
        CREATE POLICY "migration_bypass_policy" ON "${table}"
          FOR ALL
          TO migration_role
          USING (true)
          WITH CHECK (true)
      `);
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // =========================================================
    // Drop all RLS policies and disable RLS on each table
    // =========================================================
    for (const table of this.tenantTables) {
      // Drop policies (order doesn't matter)
      await queryRunner.query(`
        DROP POLICY IF EXISTS "migration_bypass_policy" ON "${table}"
      `);

      await queryRunner.query(`
        DROP POLICY IF EXISTS "super_admin_bypass_policy" ON "${table}"
      `);

      await queryRunner.query(`
        DROP POLICY IF EXISTS "tenant_isolation_policy" ON "${table}"
      `);

      // Disable Row-Level Security
      await queryRunner.query(`
        ALTER TABLE "${table}" DISABLE ROW LEVEL SECURITY
      `);
    }
  }
}
