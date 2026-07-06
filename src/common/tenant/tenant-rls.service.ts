import { Injectable, Logger } from '@nestjs/common';
import { DataSource } from 'typeorm';

/**
 * Result of an RLS health check that verifies Row-Level Security
 * policies are enabled on all expected tenant-scoped tables.
 */
export interface RlsHealthCheckResult {
  healthy: boolean;
  tablesChecked: number;
  tablesWithRls: number;
  tablesMissingRls: string[];
  checkedAt: Date;
}

/**
 * List of all tables expected to have RLS policies enabled.
 * These are tenant-scoped tables that contain a school_id column.
 */
const TENANT_SCOPED_TABLES: string[] = [
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

/**
 * Service responsible for managing PostgreSQL Row-Level Security (RLS)
 * session variables and verifying RLS policy health across tenant tables.
 *
 * Validates: Requirements 4.3, 4.4, 8.4
 */
@Injectable()
export class TenantRlsService {
  private readonly logger = new Logger(TenantRlsService.name);

  constructor(private readonly dataSource: DataSource) {}

  /**
   * Sets the PostgreSQL session variable `app.current_school_id` for the
   * current transaction. Uses SET LOCAL so the value is scoped to the
   * current transaction only and automatically resets on transaction end.
   *
   * For Super Admin bypass mode, pass 'BYPASS' as the schoolId value.
   *
   * @param schoolId - The school UUID or 'BYPASS' for super admin mode
   */
  async setSessionSchoolId(schoolId: string): Promise<void> {
    await this.dataSource.query(
      `SET LOCAL app.current_school_id = '${schoolId}'`,
    );
  }

  /**
   * Clears (resets) the PostgreSQL session variable `app.current_school_id`.
   * This ensures no stale tenant context leaks between operations.
   */
  async clearSessionSchoolId(): Promise<void> {
    await this.dataSource.query(`RESET app.current_school_id`);
  }

  /**
   * Verifies that RLS policies are enabled on all expected tenant-scoped tables.
   * Queries pg_catalog to check which tables have row_security enabled.
   *
   * @returns RlsHealthCheckResult indicating health status
   */
  async verifyRlsPolicies(): Promise<RlsHealthCheckResult> {
    const checkedAt = new Date();

    try {
      // Query pg_class to find tables with RLS enabled
      const result: Array<{ tablename: string }> = await this.dataSource.query(
        `SELECT c.relname AS tablename
         FROM pg_catalog.pg_class c
         JOIN pg_catalog.pg_namespace n ON n.oid = c.relnamespace
         WHERE c.relkind = 'r'
           AND n.nspname = 'public'
           AND c.relrowsecurity = true
           AND c.relname = ANY($1)`,
        [TENANT_SCOPED_TABLES],
      );

      const tablesWithRls = result.map((row) => row.tablename);
      const tablesMissingRls = TENANT_SCOPED_TABLES.filter(
        (table) => !tablesWithRls.includes(table),
      );

      const healthy = tablesMissingRls.length === 0;

      if (!healthy) {
        this.logger.warn(
          `RLS health check: ${tablesMissingRls.length} tables missing RLS policies`,
          { tablesMissingRls },
        );
      }

      return {
        healthy,
        tablesChecked: TENANT_SCOPED_TABLES.length,
        tablesWithRls: tablesWithRls.length,
        tablesMissingRls,
        checkedAt,
      };
    } catch (error) {
      this.logger.error('RLS health check failed', { error });

      return {
        healthy: false,
        tablesChecked: TENANT_SCOPED_TABLES.length,
        tablesWithRls: 0,
        tablesMissingRls: [...TENANT_SCOPED_TABLES],
        checkedAt,
      };
    }
  }
}
