import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateSubjectGroups1750300000000 implements MigrationInterface {
  name = 'CreateSubjectGroups1750300000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "subject_groups" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "school_id" uuid NOT NULL,
        "code" varchar(20) NOT NULL,
        "name" varchar(100) NOT NULL,
        "description" text,
        "display_order" int NOT NULL DEFAULT 0,
        "color_code" varchar(7),
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
        "deleted_at" TIMESTAMP,
        "created_by" uuid,
        "updated_by" uuid,
        "version" int NOT NULL DEFAULT 1,
        CONSTRAINT "PK_subject_groups" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_subject_groups_school_code" UNIQUE ("school_id", "code")
      )
    `);

    await queryRunner.query(`
      CREATE INDEX "idx_subject_groups_school_deleted" ON "subject_groups" ("school_id", "deleted_at")
    `);

    // Add subject_group_id column to subjects table
    await queryRunner.query(`
      ALTER TABLE "subjects" ADD COLUMN "subject_group_id" uuid
    `);

    await queryRunner.query(`
      ALTER TABLE "subjects"
        ADD CONSTRAINT "FK_subjects_subject_group"
        FOREIGN KEY ("subject_group_id") REFERENCES "subject_groups"("id") ON DELETE SET NULL
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "subjects" DROP CONSTRAINT "FK_subjects_subject_group"`);
    await queryRunner.query(`ALTER TABLE "subjects" DROP COLUMN "subject_group_id"`);
    await queryRunner.query(`DROP INDEX "idx_subject_groups_school_deleted"`);
    await queryRunner.query(`DROP TABLE "subject_groups"`);
  }
}
