import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Migration for Workspace Context Switcher feature:
 * 1. Adds 'company_admin' value to user_role_enum
 * 2. Adds 'company_school_id' (UUID, nullable) column to users table with FK to schools(id)
 * 3. Creates partial index idx_users_company_school_id where company_school_id IS NOT NULL
 *
 * Requirements: 7.1, 7.4
 */
export class AddWorkspaceContextRolesAndColumn1751900000000
  implements MigrationInterface
{
  public async up(queryRunner: QueryRunner): Promise<void> {
    // 1. Add 'company_admin' enum value to user_role_enum
    await queryRunner.query(
      `ALTER TYPE "user_role_enum" ADD VALUE IF NOT EXISTS 'company_admin'`,
    );

    // 2. Add company_school_id column to users table (UUID, nullable, FK to schools)
    await queryRunner.query(`
      ALTER TABLE "users"
      ADD COLUMN IF NOT EXISTS "company_school_id" uuid NULL
    `);

    // 3. Add foreign key constraint referencing schools(id)
    await queryRunner.query(`
      ALTER TABLE "users"
      ADD CONSTRAINT "FK_users_company_school_id"
      FOREIGN KEY ("company_school_id")
      REFERENCES "schools"("id")
      ON DELETE SET NULL
    `);

    // 4. Create partial index on company_school_id where NOT NULL
    await queryRunner.query(`
      CREATE INDEX "idx_users_company_school_id"
      ON "users" ("company_school_id")
      WHERE "company_school_id" IS NOT NULL
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // 1. Drop the partial index
    await queryRunner.query(
      `DROP INDEX IF EXISTS "idx_users_company_school_id"`,
    );

    // 2. Drop the foreign key constraint
    await queryRunner.query(`
      ALTER TABLE "users"
      DROP CONSTRAINT IF EXISTS "FK_users_company_school_id"
    `);

    // 3. Drop the company_school_id column
    await queryRunner.query(`
      ALTER TABLE "users"
      DROP COLUMN IF EXISTS "company_school_id"
    `);

    // 4. Remove 'company_admin' enum value
    // PostgreSQL does not support removing individual enum values directly.
    // We must recreate the enum type without the new value.
    // This requires temporarily changing the column type, dropping and recreating the enum.

    // 4a. Change role column to text temporarily
    await queryRunner.query(`
      ALTER TABLE "users"
      ALTER COLUMN "role" TYPE text
    `);

    // 4b. Drop the old enum type
    await queryRunner.query(`DROP TYPE IF EXISTS "user_role_enum"`);

    // 4c. Recreate enum without company_admin
    await queryRunner.query(`
      CREATE TYPE "user_role_enum" AS ENUM (
        'super_admin',
        'school_admin',
        'hr',
        'scheduler',
        'teacher',
        'viewer'
      )
    `);

    // 4d. Convert column back to enum
    // NOTE: If any users have 'company_admin' role, this rollback will fail.
    // Ensure no users have company_admin role before rolling back.
    await queryRunner.query(`
      ALTER TABLE "users"
      ALTER COLUMN "role" TYPE "user_role_enum"
      USING "role"::"user_role_enum"
    `);
  }
}
