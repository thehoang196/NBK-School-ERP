import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddCampusIdToRooms1749800001000 implements MigrationInterface {
  name = 'AddCampusIdToRooms1749800001000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "rooms"
      ADD COLUMN "campus_id" uuid
    `);

    await queryRunner.query(`
      ALTER TABLE "rooms"
      ADD CONSTRAINT "FK_rooms_campus"
      FOREIGN KEY ("campus_id") REFERENCES "campuses"("id")
      ON DELETE SET NULL ON UPDATE NO ACTION
    `);

    await queryRunner.query(`
      CREATE INDEX "IDX_rooms_campus_id"
      ON "rooms" ("campus_id")
      WHERE "deleted_at" IS NULL
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX "IDX_rooms_campus_id"`);
    await queryRunner.query(
      `ALTER TABLE "rooms" DROP CONSTRAINT "FK_rooms_campus"`,
    );
    await queryRunner.query(`ALTER TABLE "rooms" DROP COLUMN "campus_id"`);
  }
}
