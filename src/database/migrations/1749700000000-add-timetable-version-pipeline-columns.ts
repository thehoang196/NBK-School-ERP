import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddTimetableVersionPipelineColumns1749700000000 implements MigrationInterface {
  name = 'AddTimetableVersionPipelineColumns1749700000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Step 1: Add new enum values to timetable version status enum
    // TypeORM naming: {table}_{column}_enum → timetable_versions_status_enum
    const enumName = await queryRunner.query(`
      SELECT t.typname FROM pg_type t
      JOIN pg_enum e ON t.oid = e.enumtypid
      WHERE e.enumlabel = 'draft'
      AND t.typname LIKE '%timetable%status%'
      LIMIT 1
    `);
    const typeName = enumName?.[0]?.typname || 'timetable_versions_status_enum';

    await queryRunner.query(
      `ALTER TYPE "${typeName}" ADD VALUE IF NOT EXISTS 'generating'`,
    );
    await queryRunner.query(
      `ALTER TYPE "${typeName}" ADD VALUE IF NOT EXISTS 'generated'`,
    );
    await queryRunner.query(
      `ALTER TYPE "${typeName}" ADD VALUE IF NOT EXISTS 'failed'`,
    );
    await queryRunner.query(
      `ALTER TYPE "${typeName}" ADD VALUE IF NOT EXISTS 'reviewing'`,
    );

    // Step 2: Add pipeline columns to timetable_versions (IF NOT EXISTS for safety)
    const columnsToAdd = [
      { name: 'job_id', type: 'varchar(100)' },
      { name: 'generation_started_at', type: 'TIMESTAMP' },
      { name: 'generation_completed_at', type: 'TIMESTAMP' },
      { name: 'generation_duration_ms', type: 'int' },
      { name: 'error_message', type: 'text' },
      { name: 'error_stack', type: 'text' },
      { name: 'has_conflicts', type: 'boolean NOT NULL DEFAULT false' },
      { name: 'conflict_count', type: 'int NOT NULL DEFAULT 0' },
      { name: 'conflict_details', type: 'jsonb' },
      { name: 'total_slots', type: 'int NOT NULL DEFAULT 0' },
    ];
    for (const col of columnsToAdd) {
      await queryRunner.query(`
        ALTER TABLE "timetable_versions" ADD COLUMN IF NOT EXISTS "${col.name}" ${col.type}
      `);
    }

    // Step 3: Add index on job_id for quick lookup by job
    await queryRunner.query(`
      CREATE INDEX "IDX_timetable_versions_job_id"
      ON "timetable_versions" ("job_id")
      WHERE "job_id" IS NOT NULL
    `);

    // Step 4: Add index on status for filtering generating/failed versions
    await queryRunner.query(`
      CREATE INDEX "IDX_timetable_versions_status"
      ON "timetable_versions" ("status")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Drop indexes
    await queryRunner.query(
      `DROP INDEX IF EXISTS "IDX_timetable_versions_status"`,
    );
    await queryRunner.query(
      `DROP INDEX IF EXISTS "IDX_timetable_versions_job_id"`,
    );

    // Drop new columns
    await queryRunner.query(`
      ALTER TABLE "timetable_versions"
      DROP COLUMN IF EXISTS "version",
      DROP COLUMN IF EXISTS "total_slots",
      DROP COLUMN IF EXISTS "conflict_details",
      DROP COLUMN IF EXISTS "conflict_count",
      DROP COLUMN IF EXISTS "has_conflicts",
      DROP COLUMN IF EXISTS "error_stack",
      DROP COLUMN IF EXISTS "error_message",
      DROP COLUMN IF EXISTS "generation_duration_ms",
      DROP COLUMN IF EXISTS "generation_completed_at",
      DROP COLUMN IF EXISTS "generation_started_at",
      DROP COLUMN IF EXISTS "job_id"
    `);

    // Note: PostgreSQL does not support removing values from an enum type.
    // To fully revert, you'd need to recreate the enum without the new values.
    // This is left as a manual step since it requires updating all rows using those values first.
    // In practice, the enum values are safe to leave in place.
  }
}
