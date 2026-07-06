import { MigrationInterface, QueryRunner, Table, TableIndex } from 'typeorm';

export class CreateExportTemplates1749300002000 implements MigrationInterface {
  name = 'CreateExportTemplates1749300002000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TYPE "export_entity_target_enum" AS ENUM ('teacher', 'subject', 'class', 'department', 'teaching_assignment')
    `);

    await queryRunner.createTable(
      new Table({
        name: 'export_templates',
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
            name: 'entity_target',
            type: 'export_entity_target_enum',
          },
          {
            name: 'name',
            type: 'varchar',
            length: '100',
          },
          {
            name: 'description',
            type: 'varchar',
            length: '255',
            isNullable: true,
          },
          {
            name: 'field_mappings',
            type: 'jsonb',
          },
          {
            name: 'is_default',
            type: 'boolean',
            default: false,
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

    await queryRunner.createIndices('export_templates', [
      new TableIndex({
        name: 'IDX_export_templates_school_entity',
        columnNames: ['school_id', 'entity_target'],
      }),
      new TableIndex({
        name: 'IDX_export_templates_default',
        columnNames: ['school_id', 'entity_target', 'is_default'],
      }),
    ]);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropTable('export_templates');
    await queryRunner.query(`DROP TYPE "export_entity_target_enum"`);
  }
}
