import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddFormulaEffectiveDating1752000000000
  implements MigrationInterface
{
  name = 'AddFormulaEffectiveDating1752000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "formulas"
      ADD COLUMN "effective_from" date,
      ADD COLUMN "effective_to" date
    `);

    await queryRunner.query(`
      CREATE INDEX "idx_formulas_effective_dates"
      ON "formulas" ("school_id", "status", "effective_from", "effective_to")
      WHERE "deleted_at" IS NULL
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DROP INDEX IF EXISTS "idx_formulas_effective_dates"
    `);

    await queryRunner.query(`
      ALTER TABLE "formulas"
      DROP COLUMN IF EXISTS "effective_to",
      DROP COLUMN IF EXISTS "effective_from"
    `);
  }
}
