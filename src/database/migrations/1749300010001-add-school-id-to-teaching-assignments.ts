import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddSchoolIdToTeachingAssignments1749300010001 implements MigrationInterface {
  name = 'AddSchoolIdToTeachingAssignments1749300010001';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Step 1: Add school_id column (nullable initially for backfill)
    await queryRunner.query(`
      ALTER TABLE "teaching_assignments"
      ADD COLUMN "school_id" uuid
    `);

    // Step 2: Add assignment_status column with default 'active'
    await queryRunner.query(`
      ALTER TABLE "teaching_assignments"
      ADD COLUMN "assignment_status" varchar(30) NOT NULL DEFAULT 'active'
    `);

    // Step 3: Backfill school_id from class → school relationship
    await queryRunner.query(`
      UPDATE "teaching_assignments" ta
      SET "school_id" = c."school_id"
      FROM "classes" c
      WHERE ta."class_id" = c."id"
        AND ta."school_id" IS NULL
    `);

    // Step 4: Set school_id NOT NULL after backfill
    await queryRunner.query(`
      ALTER TABLE "teaching_assignments"
      ALTER COLUMN "school_id" SET NOT NULL
    `);

    // Step 5: Add foreign key constraint to schools table
    await queryRunner.query(`
      ALTER TABLE "teaching_assignments"
      ADD CONSTRAINT "FK_teaching_assignments_school"
      FOREIGN KEY ("school_id") REFERENCES "schools"("id")
      ON DELETE NO ACTION ON UPDATE NO ACTION
    `);

    // Step 6: Create partial index on school_id (WHERE deleted_at IS NULL)
    await queryRunner.query(`
      CREATE INDEX "idx_ta_school_id"
      ON "teaching_assignments" ("school_id")
      WHERE "deleted_at" IS NULL
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Drop index
    await queryRunner.query(`DROP INDEX "idx_ta_school_id"`);

    // Drop foreign key constraint
    await queryRunner.query(`
      ALTER TABLE "teaching_assignments"
      DROP CONSTRAINT "FK_teaching_assignments_school"
    `);

    // Drop columns
    await queryRunner.query(`
      ALTER TABLE "teaching_assignments"
      DROP COLUMN "assignment_status"
    `);

    await queryRunner.query(`
      ALTER TABLE "teaching_assignments"
      DROP COLUMN "school_id"
    `);
  }
}
