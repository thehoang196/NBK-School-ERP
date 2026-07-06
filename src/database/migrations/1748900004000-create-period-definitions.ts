import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreatePeriodDefinitions1748900004000 implements MigrationInterface {
  name = 'CreatePeriodDefinitions1748900004000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "period_definitions" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "school_id" uuid NOT NULL,
        "session_id" uuid NOT NULL,
        "period_number" int NOT NULL,
        "start_time" time NOT NULL,
        "end_time" time NOT NULL,
        "is_break" boolean NOT NULL DEFAULT false,
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
        "deleted_at" TIMESTAMP,
        CONSTRAINT "PK_period_definitions" PRIMARY KEY ("id")
      )
    `);

    await queryRunner.query(`
      ALTER TABLE "period_definitions"
      ADD CONSTRAINT "FK_period_definitions_school"
      FOREIGN KEY ("school_id") REFERENCES "schools"("id")
      ON DELETE NO ACTION ON UPDATE NO ACTION
    `);

    await queryRunner.query(`
      ALTER TABLE "period_definitions"
      ADD CONSTRAINT "FK_period_definitions_session"
      FOREIGN KEY ("session_id") REFERENCES "sessions"("id")
      ON DELETE NO ACTION ON UPDATE NO ACTION
    `);

    await queryRunner.query(`
      CREATE INDEX "IDX_period_definitions_school_id"
      ON "period_definitions" ("school_id")
    `);

    await queryRunner.query(`
      CREATE INDEX "IDX_period_definitions_session_id"
      ON "period_definitions" ("session_id")
    `);

    await queryRunner.query(`
      CREATE UNIQUE INDEX "IDX_period_definitions_session_number"
      ON "period_definitions" ("session_id", "period_number")
      WHERE "deleted_at" IS NULL
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP INDEX "IDX_period_definitions_session_number"`,
    );
    await queryRunner.query(`DROP INDEX "IDX_period_definitions_session_id"`);
    await queryRunner.query(`DROP INDEX "IDX_period_definitions_school_id"`);
    await queryRunner.query(
      `ALTER TABLE "period_definitions" DROP CONSTRAINT "FK_period_definitions_session"`,
    );
    await queryRunner.query(
      `ALTER TABLE "period_definitions" DROP CONSTRAINT "FK_period_definitions_school"`,
    );
    await queryRunner.query(`DROP TABLE "period_definitions"`);
  }
}
