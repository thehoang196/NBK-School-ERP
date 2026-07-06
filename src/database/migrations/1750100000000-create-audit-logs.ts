import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateAuditLogs1750100000000 implements MigrationInterface {
  name = 'CreateAuditLogs1750100000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "audit_logs" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "user_id" uuid,
        "school_id" uuid,
        "action" varchar(50) NOT NULL,
        "entity_type" varchar(100) NOT NULL,
        "entity_id" uuid,
        "changes" jsonb,
        "ip_address" varchar(45),
        "user_agent" text,
        "metadata" jsonb,
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_audit_logs" PRIMARY KEY ("id")
      )
    `);

    await queryRunner.query(`
      CREATE INDEX "idx_audit_logs_school_created" ON "audit_logs" ("school_id", "created_at")
    `);

    await queryRunner.query(`
      CREATE INDEX "idx_audit_logs_entity" ON "audit_logs" ("entity_type", "entity_id")
    `);

    await queryRunner.query(`
      CREATE INDEX "idx_audit_logs_user_created" ON "audit_logs" ("user_id", "created_at")
    `);

    await queryRunner.query(`
      ALTER TABLE "audit_logs"
        ADD CONSTRAINT "FK_audit_logs_school"
        FOREIGN KEY ("school_id") REFERENCES "schools"("id") ON DELETE SET NULL
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "audit_logs" DROP CONSTRAINT "FK_audit_logs_school"`,
    );
    await queryRunner.query(`DROP INDEX "idx_audit_logs_user_created"`);
    await queryRunner.query(`DROP INDEX "idx_audit_logs_entity"`);
    await queryRunner.query(`DROP INDEX "idx_audit_logs_school_created"`);
    await queryRunner.query(`DROP TABLE "audit_logs"`);
  }
}
