import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddIsHolidayToWeeks1749800002000 implements MigrationInterface {
  name = 'AddIsHolidayToWeeks1749800002000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Re-add is_holiday column alongside week_type for convenience (REQ-3.2)
    await queryRunner.query(`
      ALTER TABLE "weeks"
      ADD COLUMN "is_holiday" boolean NOT NULL DEFAULT false
    `);

    // Sync existing data: set is_holiday = true where week_type = 'holiday'
    await queryRunner.query(`
      UPDATE "weeks" SET "is_holiday" = true WHERE "week_type" = 'holiday'
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "weeks" DROP COLUMN "is_holiday"
    `);
  }
}
