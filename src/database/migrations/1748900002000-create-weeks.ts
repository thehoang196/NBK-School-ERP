import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateWeeks1748900002000 implements MigrationInterface {
  name = 'CreateWeeks1748900002000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "weeks" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "semester_id" uuid NOT NULL,
        "week_number" int NOT NULL,
        "start_date" date NOT NULL,
        "end_date" date NOT NULL,
        "note" varchar(255),
        "is_holiday" boolean NOT NULL DEFAULT false,
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
        "deleted_at" TIMESTAMP,
        CONSTRAINT "PK_weeks" PRIMARY KEY ("id")
      )
    `);

    await queryRunner.query(`
      ALTER TABLE "weeks"
      ADD CONSTRAINT "FK_weeks_semester"
      FOREIGN KEY ("semester_id") REFERENCES "semesters"("id")
      ON DELETE NO ACTION ON UPDATE NO ACTION
    `);

    await queryRunner.query(`
      CREATE INDEX "IDX_weeks_semester_id"
      ON "weeks" ("semester_id")
    `);

    await queryRunner.query(`
      CREATE UNIQUE INDEX "IDX_weeks_semester_number"
      ON "weeks" ("semester_id", "week_number")
      WHERE "deleted_at" IS NULL
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX "IDX_weeks_semester_number"`);
    await queryRunner.query(`DROP INDEX "IDX_weeks_semester_id"`);
    await queryRunner.query(`ALTER TABLE "weeks" DROP CONSTRAINT "FK_weeks_semester"`);
    await queryRunner.query(`DROP TABLE "weeks"`);
  }
}
