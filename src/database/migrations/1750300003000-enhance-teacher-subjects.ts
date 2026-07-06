import { MigrationInterface, QueryRunner } from 'typeorm';

export class EnhanceTeacherSubjects1750300003000 implements MigrationInterface {
  name = 'EnhanceTeacherSubjects1750300003000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TYPE "proficiency_level_enum" AS ENUM ('basic', 'intermediate', 'advanced', 'expert')
    `);

    await queryRunner.query(`
      ALTER TABLE "teacher_subjects"
        ADD COLUMN "proficiency_level" "proficiency_level_enum" NOT NULL DEFAULT 'intermediate',
        ADD COLUMN "certification" varchar(200),
        ADD COLUMN "notes" text,
        ADD COLUMN "is_primary" boolean NOT NULL DEFAULT false
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "teacher_subjects"
        DROP COLUMN "is_primary",
        DROP COLUMN "notes",
        DROP COLUMN "certification",
        DROP COLUMN "proficiency_level"
    `);
    await queryRunner.query(`DROP TYPE "proficiency_level_enum"`);
  }
}
