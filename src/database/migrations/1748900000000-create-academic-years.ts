import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateAcademicYears1748900000000 implements MigrationInterface {
  name = 'CreateAcademicYears1748900000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TYPE "academic_status_enum" AS ENUM ('planning', 'active', 'completed')
    `);

    await queryRunner.query(`
      CREATE TABLE "academic_years" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "school_id" uuid NOT NULL,
        "name" varchar(50) NOT NULL,
        "start_date" date NOT NULL,
        "end_date" date NOT NULL,
        "is_current" boolean NOT NULL DEFAULT false,
        "status" "academic_status_enum" NOT NULL DEFAULT 'planning',
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
        "deleted_at" TIMESTAMP,
        CONSTRAINT "PK_academic_years" PRIMARY KEY ("id")
      )
    `);

    await queryRunner.query(`
      ALTER TABLE "academic_years"
      ADD CONSTRAINT "FK_academic_years_school"
      FOREIGN KEY ("school_id") REFERENCES "schools"("id")
      ON DELETE NO ACTION ON UPDATE NO ACTION
    `);

    await queryRunner.query(`
      CREATE INDEX "IDX_academic_years_school_id"
      ON "academic_years" ("school_id")
    `);

    await queryRunner.query(`
      CREATE INDEX "IDX_academic_years_is_current"
      ON "academic_years" ("school_id", "is_current")
      WHERE "deleted_at" IS NULL
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX "IDX_academic_years_is_current"`);
    await queryRunner.query(`DROP INDEX "IDX_academic_years_school_id"`);
    await queryRunner.query(`ALTER TABLE "academic_years" DROP CONSTRAINT "FK_academic_years_school"`);
    await queryRunner.query(`DROP TABLE "academic_years"`);
    await queryRunner.query(`DROP TYPE "academic_status_enum"`);
  }
}
