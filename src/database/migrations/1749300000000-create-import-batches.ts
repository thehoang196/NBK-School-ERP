import { MigrationInterface, QueryRunner, Table, TableIndex } from 'typeorm';

export class CreateImportBatches1749300000000 implements MigrationInterface {
  name = 'CreateImportBatches1749300000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Create enum types
    await queryRunner.query(`
      CREATE TYPE "import_batch_status_enum" AS ENUM ('queued', 'processing', 'completed', 'failed')
    `);

    await queryRunner.query(`
      CREATE TYPE "import_entity_type_enum" AS ENUM ('teacher', 'subject', 'class', 'department', 'timetable')
    `);

    await queryRunner.createTable(
      new Table({
        name: 'import_batches',
        columns: [
          {
            name: 'id',
            type: 'uuid',
            isPrimary: true,
            generationStrategy: 'uuid',
            default: 'uuid_generate_v4()',
          },
          {
            name: 'school_id',
            type: 'uuid',
          },
          {
            name: 'entity_type',
            type: 'import_entity_type_enum',
          },
          {
            name: 'file_name',
            type: 'varchar',
            length: '255',
          },
          {
            name: 'file_size',
            type: 'int',
          },
          {
            name: 'total_rows',
            type: 'int',
            default: 0,
          },
          {
            name: 'success_count',
            type: 'int',
            default: 0,
          },
          {
            name: 'error_count',
            type: 'int',
            default: 0,
          },
          {
            name: 'progress',
            type: 'int',
            default: 0,
          },
          {
            name: 'status',
            type: 'import_batch_status_enum',
            default: "'queued'",
          },
          {
            name: 'errors',
            type: 'jsonb',
            isNullable: true,
          },
          {
            name: 'conflict_strategy',
            type: 'varchar',
            length: '20',
            isNullable: true,
          },
          {
            name: 'uploaded_by_user_id',
            type: 'uuid',
          },
          {
            name: 'started_at',
            type: 'timestamp',
            isNullable: true,
          },
          {
            name: 'completed_at',
            type: 'timestamp',
            isNullable: true,
          },
          {
            name: 'created_at',
            type: 'timestamp',
            default: 'CURRENT_TIMESTAMP',
          },
          {
            name: 'updated_at',
            type: 'timestamp',
            default: 'CURRENT_TIMESTAMP',
          },
          {
            name: 'deleted_at',
            type: 'timestamp',
            isNullable: true,
          },
        ],
      }),
      true,
    );

    await queryRunner.createIndices('import_batches', [
      new TableIndex({
        name: 'IDX_import_batches_school_id',
        columnNames: ['school_id'],
      }),
      new TableIndex({
        name: 'IDX_import_batches_uploaded_by',
        columnNames: ['uploaded_by_user_id'],
      }),
      new TableIndex({
        name: 'IDX_import_batches_status',
        columnNames: ['status'],
      }),
    ]);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropTable('import_batches');
    await queryRunner.query(`DROP TYPE "import_batch_status_enum"`);
    await queryRunner.query(`DROP TYPE "import_entity_type_enum"`);
  }
}
