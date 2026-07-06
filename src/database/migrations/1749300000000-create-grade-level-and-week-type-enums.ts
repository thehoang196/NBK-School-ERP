import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateGradeLevelAndWeekTypeEnums1749300000000 implements MigrationInterface {
  name = 'CreateGradeLevelAndWeekTypeEnums1749300000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TYPE "grade_level_enum" AS ENUM ('primary', 'middle_school', 'high_school')
    `);

    await queryRunner.query(`
      CREATE TYPE "week_type_enum" AS ENUM ('regular', 'exam', 'holiday', 'makeup')
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TYPE "week_type_enum"`);
    await queryRunner.query(`DROP TYPE "grade_level_enum"`);
  }
}
