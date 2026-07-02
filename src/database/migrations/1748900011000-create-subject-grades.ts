import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateSubjectGrades1748900011000 implements MigrationInterface {
  name = 'CreateSubjectGrades1748900011000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "subject_grades" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "subject_id" uuid NOT NULL,
        "grade_id" uuid NOT NULL,
        "periods_per_week" int NOT NULL,
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
        "deleted_at" TIMESTAMP,
        CONSTRAINT "PK_subject_grades" PRIMARY KEY ("id")
      )
    `);

    await queryRunner.query(`
      ALTER TABLE "subject_grades"
      ADD CONSTRAINT "FK_subject_grades_subject"
      FOREIGN KEY ("subject_id") REFERENCES "subjects"("id")
      ON DELETE NO ACTION ON UPDATE NO ACTION
    `);

    await queryRunner.query(`
      ALTER TABLE "subject_grades"
      ADD CONSTRAINT "FK_subject_grades_grade"
      FOREIGN KEY ("grade_id") REFERENCES "grades"("id")
      ON DELETE NO ACTION ON UPDATE NO ACTION
    `);

    await queryRunner.query(`
      CREATE INDEX "IDX_subject_grades_subject_id"
      ON "subject_grades" ("subject_id")
    `);

    await queryRunner.query(`
      CREATE INDEX "IDX_subject_grades_grade_id"
      ON "subject_grades" ("grade_id")
    `);

    await queryRunner.query(`
      CREATE UNIQUE INDEX "IDX_subject_grades_unique"
      ON "subject_grades" ("subject_id", "grade_id")
      WHERE "deleted_at" IS NULL
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX "IDX_subject_grades_unique"`);
    await queryRunner.query(`DROP INDEX "IDX_subject_grades_grade_id"`);
    await queryRunner.query(`DROP INDEX "IDX_subject_grades_subject_id"`);
    await queryRunner.query(`ALTER TABLE "subject_grades" DROP CONSTRAINT "FK_subject_grades_grade"`);
    await queryRunner.query(`ALTER TABLE "subject_grades" DROP CONSTRAINT "FK_subject_grades_subject"`);
    await queryRunner.query(`DROP TABLE "subject_grades"`);
  }
}
