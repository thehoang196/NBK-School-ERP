import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Rollout migration for the Workspace Context Switcher feature.
 *
 * Deployment strategy step 2: Run DB migration (feature initially disabled).
 * This migration seeds the feature flag record for `workspace_context_switcher`
 * in the `feature_flags` table with `enabled = false` for each organization.
 *
 * This is a companion to the schema migration:
 *   1751900000000-add-workspace-context-roles-and-column.ts
 * which adds the `company_admin` role and `company_school_id` column.
 *
 * Rollout sequence (Requirement 18.2):
 *   1. Deploy backend (feature disabled)
 *   2. Run this migration → seeds feature flag as disabled
 *   3. Deploy frontend supporting both legacy and context APIs
 *   4. Enable for pilot schools (update feature_flags.enabled = true for specific orgs)
 *   5. Enable globally
 *   6. Remove legacy per-module filters
 *
 * Rollback: Removes the feature flag records, reverting to pre-feature state.
 * Since CONTEXT_SWITCHER_ENABLED env var defaults to "true", removing the
 * flag records does not break existing behavior — env-based control remains.
 *
 * Requirements: 18.2, 18.3, 18.5
 */
export class SeedWorkspaceContextSwitcherFeatureFlag1751900100000
  implements MigrationInterface
{
  private readonly FLAG_KEY = 'workspace_context_switcher';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Verify prerequisite: user_role_enum contains 'company_admin'
    const enumCheck = await queryRunner.query(`
      SELECT EXISTS (
        SELECT 1
        FROM pg_enum
        JOIN pg_type ON pg_enum.enumtypid = pg_type.oid
        WHERE pg_type.typname = 'user_role_enum'
          AND pg_enum.enumlabel = 'company_admin'
      ) AS exists
    `);

    if (!enumCheck[0]?.exists) {
      throw new Error(
        'Prerequisite migration missing: user_role_enum must contain "company_admin". ' +
          'Run 1751900000000-add-workspace-context-roles-and-column first.',
      );
    }

    // Verify prerequisite: users table has company_school_id column
    const columnCheck = await queryRunner.query(`
      SELECT EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_name = 'users'
          AND column_name = 'company_school_id'
      ) AS exists
    `);

    if (!columnCheck[0]?.exists) {
      throw new Error(
        'Prerequisite migration missing: users.company_school_id column not found. ' +
          'Run 1751900000000-add-workspace-context-roles-and-column first.',
      );
    }

    // Seed feature flag for each existing organization (top-level schools)
    // Organizations are schools with parent_school_id IS NULL
    await queryRunner.query(`
      INSERT INTO "feature_flags" ("id", "organization_id", "flag_key", "enabled", "created_at", "updated_at")
      SELECT
        gen_random_uuid(),
        s."id",
        '${this.FLAG_KEY}',
        false,
        CURRENT_TIMESTAMP,
        CURRENT_TIMESTAMP
      FROM "schools" s
      WHERE s."parent_school_id" IS NULL
        AND NOT EXISTS (
          SELECT 1 FROM "feature_flags" ff
          WHERE ff."organization_id" = s."id"
            AND ff."flag_key" = '${this.FLAG_KEY}'
        )
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Remove all workspace_context_switcher feature flag records
    await queryRunner.query(`
      DELETE FROM "feature_flags"
      WHERE "flag_key" = '${this.FLAG_KEY}'
    `);
  }
}
