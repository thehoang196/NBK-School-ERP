import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Migration: Setup database roles for Row-Level Security (RLS)
 *
 * Creates two PostgreSQL roles:
 * - `app_role`: Used by the NestJS application connection pool. Subject to RLS policies.
 * - `migration_role`: Used for migrations and seeds. Bypasses RLS (BYPASSRLS privilege).
 *
 * This migration MUST run BEFORE the RLS policies migration (enable-rls-policies).
 *
 * To configure the application connection pool to use `app_role`:
 * 1. Create a PostgreSQL user that is a member of `app_role`:
 *    CREATE USER app_user WITH PASSWORD 'xxx';
 *    GRANT app_role TO app_user;
 * 2. Set DB_USERNAME=app_user in your .env for application connections.
 * 3. For migrations, use a user that is a member of `migration_role`:
 *    CREATE USER migration_user WITH PASSWORD 'xxx';
 *    GRANT migration_role TO migration_user;
 *    Set DB_USERNAME=migration_user in your migration datasource config.
 *
 * Alternatively, GRANT app_role to your existing application DB user:
 *    GRANT app_role TO postgres;
 *    SET ROLE app_role;  -- executed per-connection in the middleware
 */
export class SetupDatabaseRoles1749900100000 implements MigrationInterface {
  name = 'SetupDatabaseRoles1749900100000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // =========================================================
    // 1. Create app_role (subject to RLS policies)
    // =========================================================
    await queryRunner.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'app_role') THEN
          CREATE ROLE app_role NOLOGIN;
        END IF;
      END
      $$;
    `);

    // =========================================================
    // 2. Create migration_role (bypasses RLS)
    // =========================================================
    await queryRunner.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'migration_role') THEN
          CREATE ROLE migration_role NOLOGIN BYPASSRLS;
        END IF;
      END
      $$;
    `);

    // =========================================================
    // 3. Grant permissions to app_role on public schema
    //    - USAGE on schema
    //    - SELECT, INSERT, UPDATE, DELETE on all tables
    //    - USAGE, SELECT on all sequences (for generated columns)
    // =========================================================
    await queryRunner.query(`
      GRANT USAGE ON SCHEMA public TO app_role;
    `);

    await queryRunner.query(`
      GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO app_role;
    `);

    await queryRunner.query(`
      GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO app_role;
    `);

    // Ensure future tables/sequences also get these grants
    await queryRunner.query(`
      ALTER DEFAULT PRIVILEGES IN SCHEMA public
      GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO app_role;
    `);

    await queryRunner.query(`
      ALTER DEFAULT PRIVILEGES IN SCHEMA public
      GRANT USAGE, SELECT ON SEQUENCES TO app_role;
    `);

    // =========================================================
    // 4. Grant permissions to migration_role on public schema
    //    - Full access for schema modifications, data seeding
    // =========================================================
    await queryRunner.query(`
      GRANT ALL PRIVILEGES ON SCHEMA public TO migration_role;
    `);

    await queryRunner.query(`
      GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO migration_role;
    `);

    await queryRunner.query(`
      GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO migration_role;
    `);

    // Ensure future tables/sequences also get full grants for migration_role
    await queryRunner.query(`
      ALTER DEFAULT PRIVILEGES IN SCHEMA public
      GRANT ALL PRIVILEGES ON TABLES TO migration_role;
    `);

    await queryRunner.query(`
      ALTER DEFAULT PRIVILEGES IN SCHEMA public
      GRANT ALL PRIVILEGES ON SEQUENCES TO migration_role;
    `);

    // =========================================================
    // 5. Allow app_role to use SET LOCAL for session variables
    //    (needed for SET LOCAL app.current_school_id = ...)
    // =========================================================
    // Note: SET LOCAL on custom GUC variables does not require
    // special privileges in PostgreSQL 9.2+. Any role can set
    // custom session variables (app.* namespace).
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // =========================================================
    // Revoke default privileges
    // =========================================================
    await queryRunner.query(`
      ALTER DEFAULT PRIVILEGES IN SCHEMA public
      REVOKE ALL PRIVILEGES ON SEQUENCES FROM migration_role;
    `);

    await queryRunner.query(`
      ALTER DEFAULT PRIVILEGES IN SCHEMA public
      REVOKE ALL PRIVILEGES ON TABLES FROM migration_role;
    `);

    await queryRunner.query(`
      ALTER DEFAULT PRIVILEGES IN SCHEMA public
      REVOKE USAGE, SELECT ON SEQUENCES FROM app_role;
    `);

    await queryRunner.query(`
      ALTER DEFAULT PRIVILEGES IN SCHEMA public
      REVOKE SELECT, INSERT, UPDATE, DELETE ON TABLES FROM app_role;
    `);

    // =========================================================
    // Revoke permissions from migration_role
    // =========================================================
    await queryRunner.query(`
      REVOKE ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public FROM migration_role;
    `);

    await queryRunner.query(`
      REVOKE ALL PRIVILEGES ON ALL TABLES IN SCHEMA public FROM migration_role;
    `);

    await queryRunner.query(`
      REVOKE ALL PRIVILEGES ON SCHEMA public FROM migration_role;
    `);

    // =========================================================
    // Revoke permissions from app_role
    // =========================================================
    await queryRunner.query(`
      REVOKE USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public FROM app_role;
    `);

    await queryRunner.query(`
      REVOKE SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public FROM app_role;
    `);

    await queryRunner.query(`
      REVOKE USAGE ON SCHEMA public FROM app_role;
    `);

    // =========================================================
    // Drop roles
    // =========================================================
    await queryRunner.query(`
      DROP ROLE IF EXISTS migration_role;
    `);

    await queryRunner.query(`
      DROP ROLE IF EXISTS app_role;
    `);
  }
}
