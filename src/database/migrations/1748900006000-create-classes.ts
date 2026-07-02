import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateClasses1748900006000 implements MigrationInterface {
  name = 'CreateClasses1748900006000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TYPE "entity_status_enum" AS ENUM ('active', 'inactive')
    `);

    await queryRunner.query(`
      CREATE TABLE "classes" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "school_id" uuid NOT NULL,
        "grade_id" uuid NOT NULL,
        "academic_year_id" uuid NOT NULL,
        "name" varchar(50) NOT NULL,
        "homeroom_teacher_id" uuid,
        "student_count" int NOT NULL DEFAULT 0,
        "status" "entity_status_enum" NOT NULL DEFAULT 'active',
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
        "deleted_at" TIMESTAMP,
        CONSTRAINT "PK_classes" PRIMARY KEY ("id")
      )
    `);

    await queryRunner.query(`
      ALTER TABLE "classes"
      ADD CONSTRAINT "FK_classes_school"
      FOREIGN KEY ("school_id") REFERENCES "schools"("id")
      ON DELETE NO ACTION ON UPDATE NO ACTION
    `);

    await queryRunner.query(`
      ALTER TABLE "classes"
      ADD CONSTRAINT "FK_classes_grade"
      FOREIGN KEY ("grade_id") REFERENCES "grades"("id")
      ON DELETE NO ACTION ON UPDATE NO ACTION
    `);

    await queryRunner.query(`
      ALTER TABLE "classes"
      ADD CONSTRAINT "FK_classes_academic_year"
      FOREIGN KEY ("academic_year_id") REFERENCES "academic_years"("id")
      ON DELETE NO ACTION ON UPDATE NO ACTION
    `);

    await queryRunner.query(`
      CREATE INDEX "IDX_classes_school_id"
      ON "classes" ("school_id")
    `);

    await queryRunner.query(`
      CREATE INDEX "IDX_classes_grade_id"
      ON "classes" ("grade_id")
    `);

    await queryRunner.query(`
      CREATE INDEX "IDX_classes_academic_year_id"
      ON "classes" ("academic_year_id")
    `);

    await queryRunner.query(`
      CREATE UNIQUE INDEX "IDX_classes_unique_name"
      ON "classes" ("grade_id", "academic_year_id", "name")
      WHERE "deleted_at" IS NULL
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX "IDX_classes_unique_name"`);
    await queryRunner.query(`DROP INDEX "IDX_classes_academic_year_id"`);
    await queryRunner.query(`DROP INDEX "IDX_classes_grade_id"`);
    await queryRunner.query(`DROP INDEX "IDX_classes_school_id"`);
    await queryRunner.query(`ALTER TABLE "classes" DROP CONSTRAINT "FK_classes_academic_year"`);
    await queryRunner.query(`ALTER TABLE "classes" DROP CONSTRAINT "FK_classes_grade"`);
    await queryRunner.query(`ALTER TABLE "classes" DROP CONSTRAINT "FK_classes_school"`);
    await queryRunner.query(`DROP TABLE "classes"`);
    await queryRunner.query(`DROP TYPE "entity_status_enum"`);
  }
}
