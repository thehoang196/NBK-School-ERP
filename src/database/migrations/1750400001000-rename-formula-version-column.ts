import { MigrationInterface, QueryRunner } from 'typeorm';

export class RenameFormulaVersionColumn1750400001000
  implements MigrationInterface
{
  name = 'RenameFormulaVersionColumn1750400001000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Rename version → formula_version to avoid conflict with BaseEntity @VersionColumn
    await queryRunner.query(`
      ALTER TABLE "formulas" RENAME COLUMN "version" TO "formula_version"
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "formulas" RENAME COLUMN "formula_version" TO "version"
    `);
  }
}
