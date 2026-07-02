import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateSemesters1748900001000 implements MigrationInterface {
  name = 'CreateSemesters1748900001000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "semesters" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "academic_year_id" uuid NOT NULL,
        "name" varchar(50) NOT NULL,
        "semester_number" smallint NOT NULL,
        "start_date" date NOT NULL,
        "end_date" date NOT NULL,
        "status" "academic_status_enum" NOT NULL DEFAULT 'planning',
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
        "deleted_at" TIMESTAMP,
        CONSTRAINT "PK_semesters" PRIMARY KEY ("id")
      )
    `);

    await queryRunner.query(`
      ALTER TABLE "semesters"
      ADD CONSTRAINT "FK_semesters_academic_year"
      FOREIGN KEY ("academic_year_id") REFERENCES "academic_years"("id")
      ON DELETE NO ACTION ON UPDATE NO ACTION
    `);

    await queryRunner.query(`
      CREATE INDEX "IDX_semesters_academic_year_id"
      ON "semesters" ("academic_year_id")
    `);

    await queryRunner.query(`
      CREATE UNIQUE INDEX "IDX_semesters_year_number"
      ON "semesters" ("academic_year_id", "semester_number")
      WHERE "deleted_at" IS NULL
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX "IDX_semesters_year_number"`);
    await queryRunner.query(`DROP INDEX "IDX_semesters_academic_year_id"`);
    await queryRunner.query(`ALTER TABLE "semesters" DROP CONSTRAINT "FK_semesters_academic_year"`);
    await queryRunner.query(`DROP TABLE "semesters"`);
  }
}
