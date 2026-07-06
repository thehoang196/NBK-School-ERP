import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateJobRecords1750200000000 implements MigrationInterface {
  name = 'CreateJobRecords1750200000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TYPE "job_status_enum" AS ENUM ('pending', 'active', 'completed', 'failed', 'delayed')
    `);

    await queryRunner.query(`
      CREATE TABLE "job_records" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "school_id" uuid NOT NULL,
        "job_type" varchar(50) NOT NULL,
        "status" "job_status_enum" NOT NULL DEFAULT 'pending',
        "progress" int NOT NULL DEFAULT 0,
        "bull_job_id" varchar(100),
        "queue_name" varchar(50),
        "payload" jsonb,
        "result" jsonb,
        "error_message" text,
        "created_by" uuid,
        "attempts" int NOT NULL DEFAULT 0,
        "max_attempts" int NOT NULL DEFAULT 3,
        "started_at" TIMESTAMP,
        "completed_at" TIMESTAMP,
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_job_records" PRIMARY KEY ("id")
      )
    `);

    await queryRunner.query(`
      CREATE INDEX "idx_job_records_school_status" ON "job_records" ("school_id", "status")
    `);

    await queryRunner.query(`
      CREATE INDEX "idx_job_records_type_created" ON "job_records" ("job_type", "created_at")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX "idx_job_records_type_created"`);
    await queryRunner.query(`DROP INDEX "idx_job_records_school_status"`);
    await queryRunner.query(`DROP TABLE "job_records"`);
    await queryRunner.query(`DROP TYPE "job_status_enum"`);
  }
}
