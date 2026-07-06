import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateMasterDataTables1749300000000 implements MigrationInterface {
  name = 'CreateMasterDataTables1749300000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Ensure gender_enum exists (may have been dropped or not created)
    await queryRunner.query(`
      DO $$ BEGIN
        CREATE TYPE "gender_enum" AS ENUM ('male', 'female', 'other');
      EXCEPTION
        WHEN duplicate_object THEN null;
      END $$;
    `);

    // Create enum types
    await queryRunner.query(`
      CREATE TYPE "sync_direction_enum" AS ENUM ('master_to_module', 'module_to_master')
    `);

    await queryRunner.query(`
      CREATE TYPE "sync_status_enum" AS ENUM ('pending', 'applied', 'conflict', 'resolved')
    `);

    await queryRunner.query(`
      CREATE TYPE "reconciliation_status_enum" AS ENUM ('in_progress', 'completed', 'applied', 'declined')
    `);

    // 1. Create employee_masters table
    await queryRunner.query(`
      CREATE TABLE "employee_masters" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "school_id" uuid NOT NULL,
        "employee_code" varchar(20) NOT NULL,
        "campus_name" varchar(100),
        "full_name" varchar(100) NOT NULL,
        "short_name" varchar(50),
        "grade_name" varchar(50),
        "department_name" varchar(100),
        "job_title" varchar(100),
        "management_level" varchar(50),
        "gender" "gender_enum",
        "max_periods_per_week" int,
        "working_days" decimal(5,2),
        "extended_fields" jsonb NOT NULL DEFAULT '{}',
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
        "deleted_at" TIMESTAMP,
        CONSTRAINT "PK_employee_masters" PRIMARY KEY ("id")
      )
    `);

    // Composite unique index on (school_id, employee_code)
    await queryRunner.query(`
      CREATE UNIQUE INDEX "UQ_employee_masters_school_employee_code"
      ON "employee_masters" ("school_id", "employee_code")
      WHERE "deleted_at" IS NULL
    `);

    // Foreign key to schools
    await queryRunner.query(`
      ALTER TABLE "employee_masters"
      ADD CONSTRAINT "FK_employee_masters_school"
      FOREIGN KEY ("school_id") REFERENCES "schools"("id")
      ON DELETE NO ACTION ON UPDATE NO ACTION
    `);

    // Indexes for employee_masters
    await queryRunner.query(`
      CREATE INDEX "IDX_employee_masters_school_id"
      ON "employee_masters" ("school_id")
      WHERE "deleted_at" IS NULL
    `);

    await queryRunner.query(`
      CREATE INDEX "IDX_employee_masters_full_name"
      ON "employee_masters" ("school_id", "full_name")
      WHERE "deleted_at" IS NULL
    `);

    await queryRunner.query(`
      CREATE INDEX "IDX_employee_masters_department"
      ON "employee_masters" ("school_id", "department_name")
      WHERE "deleted_at" IS NULL AND "department_name" IS NOT NULL
    `);

    // 2. Create field_definitions table
    await queryRunner.query(`
      CREATE TABLE "field_definitions" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "school_id" uuid NOT NULL,
        "field_name" varchar(100) NOT NULL,
        "data_type" varchar(20) NOT NULL,
        "source_module" varchar(50) NOT NULL,
        "display_label" varchar(100) NOT NULL,
        "validation_rules" jsonb,
        "is_required" boolean NOT NULL DEFAULT false,
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
        "deleted_at" TIMESTAMP,
        CONSTRAINT "PK_field_definitions" PRIMARY KEY ("id")
      )
    `);

    // Composite unique index on (school_id, field_name)
    await queryRunner.query(`
      CREATE UNIQUE INDEX "UQ_field_definitions_school_field_name"
      ON "field_definitions" ("school_id", "field_name")
      WHERE "deleted_at" IS NULL
    `);

    // Foreign key to schools
    await queryRunner.query(`
      ALTER TABLE "field_definitions"
      ADD CONSTRAINT "FK_field_definitions_school"
      FOREIGN KEY ("school_id") REFERENCES "schools"("id")
      ON DELETE NO ACTION ON UPDATE NO ACTION
    `);

    // Index for field_definitions
    await queryRunner.query(`
      CREATE INDEX "IDX_field_definitions_school_id"
      ON "field_definitions" ("school_id")
      WHERE "deleted_at" IS NULL
    `);

    // 3. Create employee_audit_logs table
    await queryRunner.query(`
      CREATE TABLE "employee_audit_logs" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "employee_master_id" uuid NOT NULL,
        "field_name" varchar(100) NOT NULL,
        "old_value" text,
        "new_value" text,
        "changed_by" varchar(100) NOT NULL,
        "change_source" varchar(50) NOT NULL DEFAULT 'manual',
        "changed_at" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_employee_audit_logs" PRIMARY KEY ("id")
      )
    `);

    // Foreign key to employee_masters
    await queryRunner.query(`
      ALTER TABLE "employee_audit_logs"
      ADD CONSTRAINT "FK_employee_audit_logs_employee_master"
      FOREIGN KEY ("employee_master_id") REFERENCES "employee_masters"("id")
      ON DELETE NO ACTION ON UPDATE NO ACTION
    `);

    // Indexes for employee_audit_logs
    await queryRunner.query(`
      CREATE INDEX "IDX_employee_audit_logs_employee_master_id"
      ON "employee_audit_logs" ("employee_master_id")
    `);

    await queryRunner.query(`
      CREATE INDEX "IDX_employee_audit_logs_changed_at"
      ON "employee_audit_logs" ("employee_master_id", "changed_at")
    `);

    // 4. Create sync_logs table
    await queryRunner.query(`
      CREATE TABLE "sync_logs" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "school_id" uuid NOT NULL,
        "employee_code" varchar(20) NOT NULL,
        "field_name" varchar(100) NOT NULL,
        "master_value" text,
        "module_value" text,
        "source_module" varchar(50) NOT NULL,
        "direction" "sync_direction_enum" NOT NULL,
        "status" "sync_status_enum" NOT NULL DEFAULT 'pending',
        "resolved_by" varchar(100),
        "resolved_at" TIMESTAMP,
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
        "deleted_at" TIMESTAMP,
        CONSTRAINT "PK_sync_logs" PRIMARY KEY ("id")
      )
    `);

    // Indexes for sync_logs
    await queryRunner.query(`
      CREATE INDEX "IDX_sync_logs_school_id"
      ON "sync_logs" ("school_id")
      WHERE "deleted_at" IS NULL
    `);

    await queryRunner.query(`
      CREATE INDEX "IDX_sync_logs_employee_code"
      ON "sync_logs" ("school_id", "employee_code")
      WHERE "deleted_at" IS NULL
    `);

    await queryRunner.query(`
      CREATE INDEX "IDX_sync_logs_status"
      ON "sync_logs" ("school_id", "status")
      WHERE "deleted_at" IS NULL
    `);

    // 5. Create reconciliation_sessions table
    await queryRunner.query(`
      CREATE TABLE "reconciliation_sessions" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "school_id" uuid NOT NULL,
        "source_module" varchar(50) NOT NULL,
        "status" "reconciliation_status_enum" NOT NULL DEFAULT 'in_progress',
        "total_records" int NOT NULL DEFAULT 0,
        "matched_records" int NOT NULL DEFAULT 0,
        "conflict_records" int NOT NULL DEFAULT 0,
        "new_records" int NOT NULL DEFAULT 0,
        "report_data" jsonb,
        "triggered_by" varchar(100) NOT NULL,
        "completed_at" TIMESTAMP,
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
        "deleted_at" TIMESTAMP,
        CONSTRAINT "PK_reconciliation_sessions" PRIMARY KEY ("id")
      )
    `);

    // Indexes for reconciliation_sessions
    await queryRunner.query(`
      CREATE INDEX "IDX_reconciliation_sessions_school_id"
      ON "reconciliation_sessions" ("school_id")
      WHERE "deleted_at" IS NULL
    `);

    await queryRunner.query(`
      CREATE INDEX "IDX_reconciliation_sessions_status"
      ON "reconciliation_sessions" ("school_id", "status")
      WHERE "deleted_at" IS NULL
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Drop indexes for reconciliation_sessions
    await queryRunner.query(`DROP INDEX "IDX_reconciliation_sessions_status"`);
    await queryRunner.query(
      `DROP INDEX "IDX_reconciliation_sessions_school_id"`,
    );

    // Drop reconciliation_sessions table
    await queryRunner.query(`DROP TABLE "reconciliation_sessions"`);

    // Drop indexes for sync_logs
    await queryRunner.query(`DROP INDEX "IDX_sync_logs_status"`);
    await queryRunner.query(`DROP INDEX "IDX_sync_logs_employee_code"`);
    await queryRunner.query(`DROP INDEX "IDX_sync_logs_school_id"`);

    // Drop sync_logs table
    await queryRunner.query(`DROP TABLE "sync_logs"`);

    // Drop indexes and constraints for employee_audit_logs
    await queryRunner.query(`DROP INDEX "IDX_employee_audit_logs_changed_at"`);
    await queryRunner.query(
      `DROP INDEX "IDX_employee_audit_logs_employee_master_id"`,
    );
    await queryRunner.query(
      `ALTER TABLE "employee_audit_logs" DROP CONSTRAINT "FK_employee_audit_logs_employee_master"`,
    );

    // Drop employee_audit_logs table
    await queryRunner.query(`DROP TABLE "employee_audit_logs"`);

    // Drop indexes and constraints for field_definitions
    await queryRunner.query(`DROP INDEX "IDX_field_definitions_school_id"`);
    await queryRunner.query(
      `ALTER TABLE "field_definitions" DROP CONSTRAINT "FK_field_definitions_school"`,
    );
    await queryRunner.query(
      `DROP INDEX "UQ_field_definitions_school_field_name"`,
    );

    // Drop field_definitions table
    await queryRunner.query(`DROP TABLE "field_definitions"`);

    // Drop indexes and constraints for employee_masters
    await queryRunner.query(`DROP INDEX "IDX_employee_masters_department"`);
    await queryRunner.query(`DROP INDEX "IDX_employee_masters_full_name"`);
    await queryRunner.query(`DROP INDEX "IDX_employee_masters_school_id"`);
    await queryRunner.query(
      `ALTER TABLE "employee_masters" DROP CONSTRAINT "FK_employee_masters_school"`,
    );
    await queryRunner.query(
      `DROP INDEX "UQ_employee_masters_school_employee_code"`,
    );

    // Drop employee_masters table
    await queryRunner.query(`DROP TABLE "employee_masters"`);

    // Drop enum types
    await queryRunner.query(`DROP TYPE "reconciliation_status_enum"`);
    await queryRunner.query(`DROP TYPE "sync_status_enum"`);
    await queryRunner.query(`DROP TYPE "sync_direction_enum"`);
  }
}
