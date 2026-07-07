import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateTeacherWorkloads1752100200000
  implements MigrationInterface
{
  name = 'CreateTeacherWorkloads1752100200000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "teacher_workloads" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "school_id" uuid NOT NULL,
        "teacher_id" uuid NOT NULL,
        "pay_period_id" uuid NOT NULL,
        "total_hours" int NOT NULL DEFAULT 0,
        "hours_by_type" jsonb,
        "hours_by_subject" jsonb,
        "created_at" timestamp NOT NULL DEFAULT now(),
        "updated_at" timestamp NOT NULL DEFAULT now(),
        "deleted_at" timestamp,
        "created_by" uuid,
        "updated_by" uuid,
        "version" int NOT NULL DEFAULT 1,
        CONSTRAINT "PK_teacher_workloads" PRIMARY KEY ("id"),
        CONSTRAINT "FK_teacher_workloads_school" FOREIGN KEY ("school_id") REFERENCES "schools"("id"),
        CONSTRAINT "FK_teacher_workloads_teacher" FOREIGN KEY ("teacher_id") REFERENCES "teachers"("id"),
        CONSTRAINT "FK_teacher_workloads_period" FOREIGN KEY ("pay_period_id") REFERENCES "pay_periods"("id"),
        CONSTRAINT "uq_teacher_workload_teacher_period" UNIQUE ("teacher_id", "pay_period_id", "school_id")
      )
    `);

    await queryRunner.query(`
      CREATE INDEX "idx_teacher_workloads_school" ON "teacher_workloads" ("school_id", "deleted_at")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "teacher_workloads"`);
  }
}
