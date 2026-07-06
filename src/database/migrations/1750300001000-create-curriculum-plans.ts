import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateCurriculumPlans1750300001000 implements MigrationInterface {
  name = 'CreateCurriculumPlans1750300001000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TYPE "curriculum_plan_status_enum" AS ENUM ('draft', 'approved', 'published', 'archived')
    `);

    await queryRunner.query(`
      CREATE TABLE "curriculum_plans" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "school_id" uuid NOT NULL,
        "academic_year_id" uuid NOT NULL,
        "grade_id" uuid NOT NULL,
        "name" varchar(200) NOT NULL,
        "description" text,
        "status" "curriculum_plan_status_enum" NOT NULL DEFAULT 'draft',
        "total_periods_per_week" int NOT NULL DEFAULT 0,
        "approved_by" uuid,
        "approved_at" TIMESTAMP,
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
        "deleted_at" TIMESTAMP,
        "created_by" uuid,
        "updated_by" uuid,
        "version" int NOT NULL DEFAULT 1,
        CONSTRAINT "PK_curriculum_plans" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_curriculum_plans_school_year_grade" UNIQUE ("school_id", "academic_year_id", "grade_id")
      )
    `);

    await queryRunner.query(`
      CREATE INDEX "idx_curriculum_plans_school_deleted" ON "curriculum_plans" ("school_id", "deleted_at")
    `);

    await queryRunner.query(`
      CREATE TABLE "curriculum_plan_items" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "curriculum_plan_id" uuid NOT NULL,
        "subject_id" uuid NOT NULL,
        "periods_per_week" int NOT NULL,
        "is_required" boolean NOT NULL DEFAULT true,
        "note" text,
        "display_order" int NOT NULL DEFAULT 0,
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
        "deleted_at" TIMESTAMP,
        "created_by" uuid,
        "updated_by" uuid,
        "version" int NOT NULL DEFAULT 1,
        CONSTRAINT "PK_curriculum_plan_items" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_curriculum_plan_items_plan_subject" UNIQUE ("curriculum_plan_id", "subject_id"),
        CONSTRAINT "FK_curriculum_plan_items_plan" FOREIGN KEY ("curriculum_plan_id") REFERENCES "curriculum_plans"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_curriculum_plan_items_subject" FOREIGN KEY ("subject_id") REFERENCES "subjects"("id") ON DELETE RESTRICT
      )
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE "curriculum_plan_items"`);
    await queryRunner.query(`DROP INDEX "idx_curriculum_plans_school_deleted"`);
    await queryRunner.query(`DROP TABLE "curriculum_plans"`);
    await queryRunner.query(`DROP TYPE "curriculum_plan_status_enum"`);
  }
}
