import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateDepartments1748900010000 implements MigrationInterface {
  name = 'CreateDepartments1748900010000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "departments" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "school_id" uuid NOT NULL,
        "name" varchar(100) NOT NULL,
        "head_teacher_id" uuid,
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
        "deleted_at" TIMESTAMP,
        CONSTRAINT "PK_departments" PRIMARY KEY ("id")
      )
    `);

    await queryRunner.query(`
      ALTER TABLE "departments"
      ADD CONSTRAINT "FK_departments_school"
      FOREIGN KEY ("school_id") REFERENCES "schools"("id")
      ON DELETE NO ACTION ON UPDATE NO ACTION
    `);

    await queryRunner.query(`
      CREATE INDEX "IDX_departments_school_id"
      ON "departments" ("school_id")
    `);

    await queryRunner.query(`
      CREATE UNIQUE INDEX "IDX_departments_school_name"
      ON "departments" ("school_id", "name")
      WHERE "deleted_at" IS NULL
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX "IDX_departments_school_name"`);
    await queryRunner.query(`DROP INDEX "IDX_departments_school_id"`);
    await queryRunner.query(`ALTER TABLE "departments" DROP CONSTRAINT "FK_departments_school"`);
    await queryRunner.query(`DROP TABLE "departments"`);
  }
}
