import { MigrationInterface, QueryRunner, Table, TableIndex } from 'typeorm';

export class CreateCompensationVariables1749200001000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // Create enum types
    await queryRunner.query(`
      CREATE TYPE "variable_data_type_enum" AS ENUM ('number', 'string', 'boolean')
    `);
    await queryRunner.query(`
      CREATE TYPE "variable_scope_enum" AS ENUM ('system', 'school', 'school_level')
    `);

    // Create compensation_variables table
    await queryRunner.createTable(
      new Table({
        name: 'compensation_variables',
        columns: [
          {
            name: 'id',
            type: 'uuid',
            isPrimary: true,
            generationStrategy: 'uuid',
            default: 'uuid_generate_v4()',
          },
          {
            name: 'code',
            type: 'varchar',
            length: '50',
            isUnique: true,
            isNullable: false,
          },
          {
            name: 'name',
            type: 'varchar',
            length: '100',
            isNullable: false,
          },
          {
            name: 'data_type',
            type: 'variable_data_type_enum',
            isNullable: false,
          },
          {
            name: 'default_value',
            type: 'varchar',
            length: '255',
            isNullable: true,
          },
          {
            name: 'scope',
            type: 'variable_scope_enum',
            isNullable: false,
          },
          {
            name: 'scope_id',
            type: 'uuid',
            isNullable: true,
          },
          {
            name: 'scope_level',
            type: 'varchar',
            length: '50',
            isNullable: true,
          },
          {
            name: 'description',
            type: 'text',
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

    // Create variable_overrides table
    await queryRunner.createTable(
      new Table({
        name: 'variable_overrides',
        columns: [
          {
            name: 'id',
            type: 'uuid',
            isPrimary: true,
            generationStrategy: 'uuid',
            default: 'uuid_generate_v4()',
          },
          {
            name: 'variable_id',
            type: 'uuid',
            isNullable: false,
          },
          {
            name: 'scope',
            type: 'variable_scope_enum',
            isNullable: false,
          },
          {
            name: 'scope_id',
            type: 'uuid',
            isNullable: true,
          },
          {
            name: 'scope_level',
            type: 'varchar',
            length: '50',
            isNullable: true,
          },
          {
            name: 'value',
            type: 'varchar',
            length: '255',
            isNullable: false,
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

    // Create audit_logs table
    await queryRunner.createTable(
      new Table({
        name: 'compensation_audit_logs',
        columns: [
          {
            name: 'id',
            type: 'uuid',
            isPrimary: true,
            generationStrategy: 'uuid',
            default: 'uuid_generate_v4()',
          },
          {
            name: 'entity_type',
            type: 'varchar',
            length: '50',
            isNullable: false,
          },
          {
            name: 'entity_id',
            type: 'uuid',
            isNullable: false,
          },
          {
            name: 'action',
            type: 'varchar',
            length: '20',
            isNullable: false,
          },
          {
            name: 'old_value',
            type: 'jsonb',
            isNullable: true,
          },
          {
            name: 'new_value',
            type: 'jsonb',
            isNullable: true,
          },
          {
            name: 'performed_by',
            type: 'uuid',
            isNullable: false,
          },
          {
            name: 'metadata',
            type: 'jsonb',
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

    // Indexes for compensation_variables
    await queryRunner.createIndex(
      'compensation_variables',
      new TableIndex({
        name: 'IDX_COMP_VARIABLES_CODE',
        columnNames: ['code'],
        isUnique: true,
        where: '"deleted_at" IS NULL',
      }),
    );

    await queryRunner.createIndex(
      'compensation_variables',
      new TableIndex({
        name: 'IDX_COMP_VARIABLES_SCOPE',
        columnNames: ['scope'],
      }),
    );

    // Indexes for variable_overrides
    await queryRunner.createIndex(
      'variable_overrides',
      new TableIndex({
        name: 'IDX_VAR_OVERRIDES_VARIABLE_ID',
        columnNames: ['variable_id'],
      }),
    );

    await queryRunner.createIndex(
      'variable_overrides',
      new TableIndex({
        name: 'IDX_VAR_OVERRIDES_SCOPE',
        columnNames: ['scope', 'scope_id', 'scope_level'],
      }),
    );

    // Indexes for audit_logs
    await queryRunner.createIndex(
      'compensation_audit_logs',
      new TableIndex({
        name: 'IDX_COMP_AUDIT_ENTITY',
        columnNames: ['entity_type', 'entity_id'],
      }),
    );

    await queryRunner.createIndex(
      'compensation_audit_logs',
      new TableIndex({
        name: 'IDX_COMP_AUDIT_PERFORMED_BY',
        columnNames: ['performed_by'],
      }),
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropIndex('compensation_audit_logs', 'IDX_COMP_AUDIT_PERFORMED_BY');
    await queryRunner.dropIndex('compensation_audit_logs', 'IDX_COMP_AUDIT_ENTITY');
    await queryRunner.dropIndex('variable_overrides', 'IDX_VAR_OVERRIDES_SCOPE');
    await queryRunner.dropIndex('variable_overrides', 'IDX_VAR_OVERRIDES_VARIABLE_ID');
    await queryRunner.dropIndex('compensation_variables', 'IDX_COMP_VARIABLES_SCOPE');
    await queryRunner.dropIndex('compensation_variables', 'IDX_COMP_VARIABLES_CODE');
    await queryRunner.dropTable('compensation_audit_logs');
    await queryRunner.dropTable('variable_overrides');
    await queryRunner.dropTable('compensation_variables');
    await queryRunner.query('DROP TYPE "variable_scope_enum"');
    await queryRunner.query('DROP TYPE "variable_data_type_enum"');
  }
}
