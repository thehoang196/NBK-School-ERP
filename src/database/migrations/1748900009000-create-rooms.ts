import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateRooms1748900009000 implements MigrationInterface {
  name = 'CreateRooms1748900009000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TYPE "room_status_enum" AS ENUM ('available', 'maintenance', 'unavailable')
    `);

    await queryRunner.query(`
      CREATE TABLE "rooms" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "school_id" uuid NOT NULL,
        "code" varchar(20) NOT NULL,
        "name" varchar(100) NOT NULL,
        "building" varchar(50),
        "floor" int,
        "capacity" int NOT NULL DEFAULT 40,
        "room_type" "room_type_enum" NOT NULL DEFAULT 'standard',
        "facilities" jsonb,
        "status" "room_status_enum" NOT NULL DEFAULT 'available',
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
        "deleted_at" TIMESTAMP,
        CONSTRAINT "PK_rooms" PRIMARY KEY ("id")
      )
    `);

    await queryRunner.query(`
      ALTER TABLE "rooms"
      ADD CONSTRAINT "FK_rooms_school"
      FOREIGN KEY ("school_id") REFERENCES "schools"("id")
      ON DELETE NO ACTION ON UPDATE NO ACTION
    `);

    await queryRunner.query(`
      CREATE INDEX "IDX_rooms_school_id"
      ON "rooms" ("school_id")
    `);

    await queryRunner.query(`
      CREATE UNIQUE INDEX "IDX_rooms_school_code"
      ON "rooms" ("school_id", "code")
      WHERE "deleted_at" IS NULL
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX "IDX_rooms_school_code"`);
    await queryRunner.query(`DROP INDEX "IDX_rooms_school_id"`);
    await queryRunner.query(
      `ALTER TABLE "rooms" DROP CONSTRAINT "FK_rooms_school"`,
    );
    await queryRunner.query(`DROP TABLE "rooms"`);
    await queryRunner.query(`DROP TYPE "room_status_enum"`);
  }
}
