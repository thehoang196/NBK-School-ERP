import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreatePeriodSwaps1751800500000 implements MigrationInterface {
  name = 'CreatePeriodSwaps1751800500000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Create enum
    await queryRunner.query(`
      CREATE TYPE "period_swap_status_enum" AS ENUM ('pending_teacher', 'pending_admin', 'approved', 'rejected_by_teacher', 'rejected_by_admin', 'cancelled')
    `);

    // Create period_swaps table
    await queryRunner.query(`
      CREATE TABLE "period_swaps" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "school_id" uuid NOT NULL,
        "requester_id" uuid NOT NULL,
        "target_id" uuid NOT NULL,
        "requester_date" date NOT NULL,
        "requester_period" integer NOT NULL,
        "target_date" date NOT NULL,
        "target_period" integer NOT NULL,
        "reason" text NOT NULL,
        "status" "period_swap_status_enum" NOT NULL DEFAULT 'pending_teacher',
        "target_accepted_at" TIMESTAMP,
        "approved_by" uuid,
        "approved_at" TIMESTAMP,
        "rejection_reason" text,
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
        "deleted_at" TIMESTAMP,
        "created_by" uuid,
        "updated_by" uuid,
        "version" integer NOT NULL DEFAULT 1,
        CONSTRAINT "PK_period_swaps" PRIMARY KEY ("id"),
        CONSTRAINT "FK_period_swaps_school" FOREIGN KEY ("school_id") REFERENCES "schools"("id"),
        CONSTRAINT "FK_period_swaps_requester" FOREIGN KEY ("requester_id") REFERENCES "teachers"("id"),
        CONSTRAINT "FK_period_swaps_target" FOREIGN KEY ("target_id") REFERENCES "teachers"("id")
      )
    `);

    await queryRunner.query(`
      CREATE INDEX "idx_period_swaps_school_deleted" ON "period_swaps" ("school_id", "deleted_at")
    `);
    await queryRunner.query(`
      CREATE INDEX "idx_period_swaps_requester" ON "period_swaps" ("requester_id", "status")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE "period_swaps"`);
    await queryRunner.query(`DROP TYPE IF EXISTS "period_swap_status_enum"`);
  }
}
