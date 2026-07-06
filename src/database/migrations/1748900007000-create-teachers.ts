import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateTeachers1748900007000 implements MigrationInterface {
  name = 'CreateTeachers1748900007000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TYPE "gender_enum" AS ENUM ('male', 'female', 'other')
    `);

    await queryRunner.query(`
      CREATE TYPE "teacher_type_enum" AS ENUM ('full_time', 'assistant', 'visiting', 'inter_school')
    `);

    await queryRunner.query(`
      CREATE TYPE "teacher_status_enum" AS ENUM ('active', 'on_leave', 'resigned')
    `);

    await queryRunner.query(`
      CREATE TABLE "teachers" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "school_id" uuid NOT NULL,
        "employee_code" varchar(20) NOT NULL,
        "full_name" varchar(100) NOT NULL,
        "short_name" varchar(50),
        "gender" "gender_enum",
        "date_of_birth" date,
        "phone" varchar(20),
        "email" varchar(100),
        "department_id" uuid,
        "position" varchar(50),
        "teacher_type" "teacher_type_enum" NOT NULL DEFAULT 'full_time',
        "max_periods_per_week" int NOT NULL DEFAULT 20,
        "min_periods_per_week" int NOT NULL DEFAULT 0,
        "max_periods_per_day" int NOT NULL DEFAULT 6,
        "unavailable_slots" jsonb,
        "status" "teacher_status_enum" NOT NULL DEFAULT 'active',
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
        "deleted_at" TIMESTAMP,
        CONSTRAINT "PK_teachers" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_teachers_employee_code" UNIQUE ("employee_code")
      )
    `);

    await queryRunner.query(`
      ALTER TABLE "teachers"
      ADD CONSTRAINT "FK_teachers_school"
      FOREIGN KEY ("school_id") REFERENCES "schools"("id")
      ON DELETE NO ACTION ON UPDATE NO ACTION
    `);

    await queryRunner.query(`
      CREATE INDEX "IDX_teachers_school_id"
      ON "teachers" ("school_id")
    `);

    await queryRunner.query(`
      CREATE INDEX "IDX_teachers_department_id"
      ON "teachers" ("department_id")
      WHERE "department_id" IS NOT NULL
    `);

    await queryRunner.query(`
      CREATE INDEX "IDX_teachers_status"
      ON "teachers" ("school_id", "status")
      WHERE "deleted_at" IS NULL
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX "IDX_teachers_status"`);
    await queryRunner.query(`DROP INDEX "IDX_teachers_department_id"`);
    await queryRunner.query(`DROP INDEX "IDX_teachers_school_id"`);
    await queryRunner.query(
      `ALTER TABLE "teachers" DROP CONSTRAINT "FK_teachers_school"`,
    );
    await queryRunner.query(`DROP TABLE "teachers"`);
    await queryRunner.query(`DROP TYPE "teacher_status_enum"`);
    await queryRunner.query(`DROP TYPE "teacher_type_enum"`);
    await queryRunner.query(`DROP TYPE "gender_enum"`);
  }
}
