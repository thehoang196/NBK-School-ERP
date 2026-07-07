import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateFormulaVersions1752100300000
  implements MigrationInterface
{
  name = 'CreateFormulaVersions1752100300000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "formula_versions" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "formula_id" uuid NOT NULL,
        "school_id" uuid NOT NULL,
        "version_number" int NOT NULL,
        "expression" text NOT NULL,
        "parsed_ast" jsonb,
        "effective_from" date,
        "effective_to" date,
        "changelog" text,
        "status" varchar(20) NOT NULL DEFAULT 'draft',
        "created_at" timestamp NOT NULL DEFAULT now(),
        "updated_at" timestamp NOT NULL DEFAULT now(),
        "deleted_at" timestamp,
        "created_by" uuid,
        "updated_by" uuid,
        "version" int NOT NULL DEFAULT 1,
        CONSTRAINT "PK_formula_versions" PRIMARY KEY ("id"),
        CONSTRAINT "FK_formula_versions_formula" FOREIGN KEY ("formula_id") REFERENCES "formulas"("id"),
        CONSTRAINT "FK_formula_versions_school" FOREIGN KEY ("school_id") REFERENCES "schools"("id")
      )
    `);

    await queryRunner.query(`
      CREATE INDEX "idx_formula_versions_formula" ON "formula_versions" ("formula_id")
    `);
    await queryRunner.query(`
      CREATE INDEX "idx_formula_versions_school" ON "formula_versions" ("school_id", "deleted_at")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "formula_versions"`);
  }
}
