import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateSessions1748900003000 implements MigrationInterface {
  name = 'CreateSessions1748900003000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "sessions" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "school_id" uuid NOT NULL,
        "name" varchar(50) NOT NULL,
        "start_time" time NOT NULL,
        "end_time" time NOT NULL,
        "sort_order" int NOT NULL DEFAULT 0,
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
        "deleted_at" TIMESTAMP,
        CONSTRAINT "PK_sessions" PRIMARY KEY ("id")
      )
    `);

    await queryRunner.query(`
      ALTER TABLE "sessions"
      ADD CONSTRAINT "FK_sessions_school"
      FOREIGN KEY ("school_id") REFERENCES "schools"("id")
      ON DELETE NO ACTION ON UPDATE NO ACTION
    `);

    await queryRunner.query(`
      CREATE INDEX "IDX_sessions_school_id"
      ON "sessions" ("school_id")
    `);

    await queryRunner.query(`
      CREATE INDEX "IDX_sessions_sort_order"
      ON "sessions" ("school_id", "sort_order")
      WHERE "deleted_at" IS NULL
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX "IDX_sessions_sort_order"`);
    await queryRunner.query(`DROP INDEX "IDX_sessions_school_id"`);
    await queryRunner.query(
      `ALTER TABLE "sessions" DROP CONSTRAINT "FK_sessions_school"`,
    );
    await queryRunner.query(`DROP TABLE "sessions"`);
  }
}
