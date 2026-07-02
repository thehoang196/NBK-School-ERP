import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateGrades1748900005000 implements MigrationInterface {
  name = 'CreateGrades1748900005000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "grades" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "school_id" uuid NOT NULL,
        "name" varchar(50) NOT NULL,
        "level" int NOT NULL,
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
        "deleted_at" TIMESTAMP,
        CONSTRAINT "PK_grades" PRIMARY KEY ("id")
      )
    `);

    await queryRunner.query(`
      ALTER TABLE "grades"
      ADD CONSTRAINT "FK_grades_school"
      FOREIGN KEY ("school_id") REFERENCES "schools"("id")
      ON DELETE NO ACTION ON UPDATE NO ACTION
    `);

    await queryRunner.query(`
      CREATE INDEX "IDX_grades_school_id"
      ON "grades" ("school_id")
    `);

    await queryRunner.query(`
      CREATE UNIQUE INDEX "IDX_grades_school_level"
      ON "grades" ("school_id", "level")
      WHERE "deleted_at" IS NULL
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX "IDX_grades_school_level"`);
    await queryRunner.query(`DROP INDEX "IDX_grades_school_id"`);
    await queryRunner.query(`ALTER TABLE "grades" DROP CONSTRAINT "FK_grades_school"`);
    await queryRunner.query(`DROP TABLE "grades"`);
  }
}
