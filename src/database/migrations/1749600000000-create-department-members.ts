import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateDepartmentMembers1749600000000 implements MigrationInterface {
  name = 'CreateDepartmentMembers1749600000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TYPE "position_title_enum" AS ENUM ('GVBM', 'GVCN', 'PCN')
    `);

    await queryRunner.query(`
      CREATE TYPE "management_level_enum" AS ENUM ('TO_TRUONG', 'TO_PHO', 'NHOM_TRUONG', 'GIAO_VU', 'QUAN_LY_PHONG', 'GIAM_THI')
    `);

    await queryRunner.query(`
      CREATE TABLE "department_members" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "department_id" uuid NOT NULL,
        "teacher_id" uuid NOT NULL,
        "position_title" "position_title_enum" NOT NULL DEFAULT 'GVBM',
        "management_level" "management_level_enum",
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
        "deleted_at" TIMESTAMP,
        CONSTRAINT "PK_department_members" PRIMARY KEY ("id")
      )
    `);

    await queryRunner.query(`
      ALTER TABLE "department_members"
      ADD CONSTRAINT "FK_department_members_department"
      FOREIGN KEY ("department_id") REFERENCES "departments"("id")
      ON DELETE NO ACTION ON UPDATE NO ACTION
    `);

    await queryRunner.query(`
      ALTER TABLE "department_members"
      ADD CONSTRAINT "FK_department_members_teacher"
      FOREIGN KEY ("teacher_id") REFERENCES "teachers"("id")
      ON DELETE NO ACTION ON UPDATE NO ACTION
    `);

    await queryRunner.query(`
      CREATE INDEX "IDX_department_members_department_id"
      ON "department_members" ("department_id")
    `);

    await queryRunner.query(`
      CREATE INDEX "IDX_department_members_teacher_id"
      ON "department_members" ("teacher_id")
    `);

    await queryRunner.query(`
      CREATE UNIQUE INDEX "UQ_department_members_dept_teacher"
      ON "department_members" ("department_id", "teacher_id")
      WHERE "deleted_at" IS NULL
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX "UQ_department_members_dept_teacher"`);
    await queryRunner.query(`DROP INDEX "IDX_department_members_teacher_id"`);
    await queryRunner.query(
      `DROP INDEX "IDX_department_members_department_id"`,
    );
    await queryRunner.query(
      `ALTER TABLE "department_members" DROP CONSTRAINT "FK_department_members_teacher"`,
    );
    await queryRunner.query(
      `ALTER TABLE "department_members" DROP CONSTRAINT "FK_department_members_department"`,
    );
    await queryRunner.query(`DROP TABLE "department_members"`);
    await queryRunner.query(`DROP TYPE "management_level_enum"`);
    await queryRunner.query(`DROP TYPE "position_title_enum"`);
  }
}
