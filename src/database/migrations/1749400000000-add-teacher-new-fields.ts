import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddTeacherNewFields1749400000000 implements MigrationInterface {
  name = 'AddTeacherNewFields1749400000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Add citizen_id column
    await queryRunner.query(
      'ALTER TABLE "teachers" ADD COLUMN IF NOT EXISTS "citizen_id" varchar(20)',
    );

    // Add grade_id column (FK to grades)
    await queryRunner.query(
      'ALTER TABLE "teachers" ADD COLUMN IF NOT EXISTS "grade_id" uuid',
    );

    // Add job_title column
    await queryRunner.query(
      'ALTER TABLE "teachers" ADD COLUMN IF NOT EXISTS "job_title" varchar(100)',
    );

    // Add management_level column
    await queryRunner.query(
      'ALTER TABLE "teachers" ADD COLUMN IF NOT EXISTS "management_level" varchar(50)',
    );

    // Add FK constraint for grade_id (if not exists)
    await queryRunner.query(`
      DO $$ BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM information_schema.table_constraints
          WHERE constraint_name = 'FK_teachers_grade'
          AND table_name = 'teachers'
        ) THEN
          ALTER TABLE "teachers"
          ADD CONSTRAINT "FK_teachers_grade"
          FOREIGN KEY ("grade_id") REFERENCES "grades"("id")
          ON DELETE SET NULL ON UPDATE NO ACTION;
        END IF;
      END $$;
    `);

    // Add FK constraint for department_id (if not exists)
    await queryRunner.query(`
      DO $$ BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM information_schema.table_constraints
          WHERE constraint_name = 'FK_teachers_department'
          AND table_name = 'teachers'
        ) THEN
          ALTER TABLE "teachers"
          ADD CONSTRAINT "FK_teachers_department"
          FOREIGN KEY ("department_id") REFERENCES "departments"("id")
          ON DELETE SET NULL ON UPDATE NO ACTION;
        END IF;
      END $$;
    `);

    // Index on grade_id (if not exists)
    await queryRunner.query(
      'CREATE INDEX IF NOT EXISTS "IDX_teachers_grade_id" ON "teachers" ("grade_id") WHERE "grade_id" IS NOT NULL',
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP INDEX IF EXISTS "IDX_teachers_grade_id"');
    await queryRunner.query(
      'ALTER TABLE "teachers" DROP CONSTRAINT IF EXISTS "FK_teachers_department"',
    );
    await queryRunner.query(
      'ALTER TABLE "teachers" DROP CONSTRAINT IF EXISTS "FK_teachers_grade"',
    );
    await queryRunner.query(
      'ALTER TABLE "teachers" DROP COLUMN IF EXISTS "management_level"',
    );
    await queryRunner.query(
      'ALTER TABLE "teachers" DROP COLUMN IF EXISTS "job_title"',
    );
    await queryRunner.query(
      'ALTER TABLE "teachers" DROP COLUMN IF EXISTS "grade_id"',
    );
    await queryRunner.query(
      'ALTER TABLE "teachers" DROP COLUMN IF EXISTS "citizen_id"',
    );
  }
}
