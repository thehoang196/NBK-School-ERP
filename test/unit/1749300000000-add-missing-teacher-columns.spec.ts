import { QueryRunner } from 'typeorm';
import { AddMissingTeacherColumns1749300000000 } from '../../src/database/migrations/1749300000000-add-missing-teacher-columns';

describe('AddMissingTeacherColumns1749300000000', () => {
  let migration: AddMissingTeacherColumns1749300000000;
  let queryRunner: jest.Mocked<QueryRunner>;

  beforeEach(() => {
    migration = new AddMissingTeacherColumns1749300000000();
    queryRunner = {
      query: jest.fn().mockResolvedValue(undefined),
    } as unknown as jest.Mocked<QueryRunner>;
  });

  describe('up()', () => {
    it('should execute 6 queries to add 4 columns, 1 FK constraint, and 1 index', async () => {
      await migration.up(queryRunner);

      expect(queryRunner.query).toHaveBeenCalledTimes(6);
    });

    it('should add citizen_id column (varchar 20, nullable)', async () => {
      await migration.up(queryRunner);

      const firstCall = queryRunner.query.mock.calls[0][0] as string;
      expect(firstCall).toContain(
        'ADD COLUMN IF NOT EXISTS "citizen_id" varchar(20)',
      );
      expect(firstCall).toContain('ALTER TABLE "teachers"');
    });

    it('should add grade_id column (uuid, nullable)', async () => {
      await migration.up(queryRunner);

      const secondCall = queryRunner.query.mock.calls[1][0] as string;
      expect(secondCall).toContain('ADD COLUMN IF NOT EXISTS "grade_id" uuid');
      expect(secondCall).toContain('ALTER TABLE "teachers"');
    });

    it('should add FK constraint referencing grades.id with ON DELETE SET NULL', async () => {
      await migration.up(queryRunner);

      const thirdCall = queryRunner.query.mock.calls[2][0] as string;
      expect(thirdCall).toContain('ADD CONSTRAINT "FK_teachers_grade"');
      expect(thirdCall).toContain('FOREIGN KEY ("grade_id")');
      expect(thirdCall).toContain('REFERENCES "grades"("id")');
      expect(thirdCall).toContain('ON DELETE SET NULL');
    });

    it('should add job_title column (varchar 100, nullable)', async () => {
      await migration.up(queryRunner);

      const fourthCall = queryRunner.query.mock.calls[3][0] as string;
      expect(fourthCall).toContain(
        'ADD COLUMN IF NOT EXISTS "job_title" varchar(100)',
      );
      expect(fourthCall).toContain('ALTER TABLE "teachers"');
    });

    it('should add management_level column (varchar 50, nullable)', async () => {
      await migration.up(queryRunner);

      const fifthCall = queryRunner.query.mock.calls[4][0] as string;
      expect(fifthCall).toContain(
        'ADD COLUMN IF NOT EXISTS "management_level" varchar(50)',
      );
      expect(fifthCall).toContain('ALTER TABLE "teachers"');
    });

    it('should create partial index IDX_teachers_grade_id on grade_id', async () => {
      await migration.up(queryRunner);

      const sixthCall = queryRunner.query.mock.calls[5][0] as string;
      expect(sixthCall).toContain(
        'CREATE INDEX IF NOT EXISTS "IDX_teachers_grade_id"',
      );
      expect(sixthCall).toContain('"teachers" ("grade_id")');
      expect(sixthCall).toContain('WHERE "grade_id" IS NOT NULL');
    });
  });

  describe('down()', () => {
    it('should execute 6 queries to drop index, FK, and 4 columns', async () => {
      await migration.down(queryRunner);

      expect(queryRunner.query).toHaveBeenCalledTimes(6);
    });

    it('should drop index IDX_teachers_grade_id first', async () => {
      await migration.down(queryRunner);

      const firstCall = queryRunner.query.mock.calls[0][0] as string;
      expect(firstCall).toContain(
        'DROP INDEX IF EXISTS "IDX_teachers_grade_id"',
      );
    });

    it('should drop FK constraint FK_teachers_grade second', async () => {
      await migration.down(queryRunner);

      const secondCall = queryRunner.query.mock.calls[1][0] as string;
      expect(secondCall).toContain(
        'DROP CONSTRAINT IF EXISTS "FK_teachers_grade"',
      );
      expect(secondCall).toContain('ALTER TABLE "teachers"');
    });

    it('should drop citizen_id column', async () => {
      await migration.down(queryRunner);

      const thirdCall = queryRunner.query.mock.calls[2][0] as string;
      expect(thirdCall).toContain('DROP COLUMN IF EXISTS "citizen_id"');
      expect(thirdCall).toContain('ALTER TABLE "teachers"');
    });

    it('should drop grade_id column', async () => {
      await migration.down(queryRunner);

      const fourthCall = queryRunner.query.mock.calls[3][0] as string;
      expect(fourthCall).toContain('DROP COLUMN IF EXISTS "grade_id"');
      expect(fourthCall).toContain('ALTER TABLE "teachers"');
    });

    it('should drop job_title column', async () => {
      await migration.down(queryRunner);

      const fifthCall = queryRunner.query.mock.calls[4][0] as string;
      expect(fifthCall).toContain('DROP COLUMN IF EXISTS "job_title"');
      expect(fifthCall).toContain('ALTER TABLE "teachers"');
    });

    it('should drop management_level column', async () => {
      await migration.down(queryRunner);

      const sixthCall = queryRunner.query.mock.calls[5][0] as string;
      expect(sixthCall).toContain('DROP COLUMN IF EXISTS "management_level"');
      expect(sixthCall).toContain('ALTER TABLE "teachers"');
    });
  });
});
