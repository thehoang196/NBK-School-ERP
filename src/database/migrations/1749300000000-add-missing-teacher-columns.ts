import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddMissingTeacherColumns1749300000000 implements MigrationInterface {
  name = 'AddMissingTeacherColumns1749300000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Thêm citizen_id (varchar 20, nullable)
    await queryRunner.query(`
      ALTER TABLE "teachers" ADD COLUMN IF NOT EXISTS "citizen_id" varchar(20)
    `);

    // Thêm grade_id (uuid, nullable)
    await queryRunner.query(`
      ALTER TABLE "teachers" ADD COLUMN IF NOT EXISTS "grade_id" uuid
    `);

    // Thêm FK constraint cho grade_id tham chiếu grades.id
    await queryRunner.query(`
      DO $$ BEGIN
        ALTER TABLE "teachers" ADD CONSTRAINT "FK_teachers_grade"
        FOREIGN KEY ("grade_id") REFERENCES "grades"("id")
        ON DELETE SET NULL ON UPDATE NO ACTION;
      EXCEPTION
        WHEN duplicate_object THEN null;
      END $$;
    `);

    // Thêm job_title (varchar 100, nullable)
    await queryRunner.query(`
      ALTER TABLE "teachers" ADD COLUMN IF NOT EXISTS "job_title" varchar(100)
    `);

    // Thêm management_level (varchar 50, nullable)
    await queryRunner.query(`
      ALTER TABLE "teachers" ADD COLUMN IF NOT EXISTS "management_level" varchar(50)
    `);

    // Tạo partial index cho grade_id
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_teachers_grade_id"
      ON "teachers" ("grade_id") WHERE "grade_id" IS NOT NULL
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Drop partial index trên grade_id
    await queryRunner.query(`
      DROP INDEX IF EXISTS "IDX_teachers_grade_id"
    `);

    // Drop FK constraint cho grade_id
    await queryRunner.query(`
      ALTER TABLE "teachers" DROP CONSTRAINT IF EXISTS "FK_teachers_grade"
    `);

    // Drop 4 cột đã thêm
    await queryRunner.query(`
      ALTER TABLE "teachers" DROP COLUMN IF EXISTS "citizen_id"
    `);
    await queryRunner.query(`
      ALTER TABLE "teachers" DROP COLUMN IF EXISTS "grade_id"
    `);
    await queryRunner.query(`
      ALTER TABLE "teachers" DROP COLUMN IF EXISTS "job_title"
    `);
    await queryRunner.query(`
      ALTER TABLE "teachers" DROP COLUMN IF EXISTS "management_level"
    `);
  }
}
