import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateSubjects1748900008000 implements MigrationInterface {
  name = 'CreateSubjects1748900008000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TYPE "subject_type_enum" AS ENUM ('required', 'elective', 'extracurricular')
    `);

    await queryRunner.query(`
      CREATE TYPE "room_type_enum" AS ENUM ('standard', 'lab', 'gym', 'music', 'art', 'other')
    `);

    await queryRunner.query(`
      CREATE TABLE "subjects" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "school_id" uuid NOT NULL,
        "code" varchar(20) NOT NULL,
        "name" varchar(100) NOT NULL,
        "short_name" varchar(10),
        "subject_type" "subject_type_enum" NOT NULL DEFAULT 'required',
        "periods_per_week" int NOT NULL DEFAULT 0,
        "requires_room_type" "room_type_enum" NOT NULL DEFAULT 'standard',
        "color_code" varchar(7),
        "is_double_period" boolean NOT NULL DEFAULT false,
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
        "deleted_at" TIMESTAMP,
        CONSTRAINT "PK_subjects" PRIMARY KEY ("id")
      )
    `);

    await queryRunner.query(`
      ALTER TABLE "subjects"
      ADD CONSTRAINT "FK_subjects_school"
      FOREIGN KEY ("school_id") REFERENCES "schools"("id")
      ON DELETE NO ACTION ON UPDATE NO ACTION
    `);

    await queryRunner.query(`
      CREATE INDEX "IDX_subjects_school_id"
      ON "subjects" ("school_id")
    `);

    await queryRunner.query(`
      CREATE UNIQUE INDEX "IDX_subjects_school_code"
      ON "subjects" ("school_id", "code")
      WHERE "deleted_at" IS NULL
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX "IDX_subjects_school_code"`);
    await queryRunner.query(`DROP INDEX "IDX_subjects_school_id"`);
    await queryRunner.query(`ALTER TABLE "subjects" DROP CONSTRAINT "FK_subjects_school"`);
    await queryRunner.query(`DROP TABLE "subjects"`);
    await queryRunner.query(`DROP TYPE "room_type_enum"`);
    await queryRunner.query(`DROP TYPE "subject_type_enum"`);
  }
}
