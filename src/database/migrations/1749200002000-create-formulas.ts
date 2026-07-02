import { MigrationInterface, QueryRunner, Table, TableIndex } from 'typeorm';

export class CreateFormulas1749200002000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TYPE "formula_status_enum" AS ENUM ('draft', 'published')
    `);

    await queryRunner.createTable(
      new Table({
        name: 'formulas',
        columns: [
          {
            name: 'id',
            type: 'uuid',
            isPrimary: true,
            generationStrategy: 'uuid',
            default: 'uuid_generate_v4()',
          },
          {
            name: 'pay_component_id',
            type: 'uuid',
            isNullable: false,
          },
          {
            name: 'school_id',
            type: 'uuid',
            isNullable: false,
          },
          {
            name: 'expression',
            type: 'text',
            isNullable: false,
          },
          {
            name: 'parsed_ast',
            type: 'jsonb',
            isNullable: true,
          },
          {
            name: 'dependencies',
            type: 'jsonb',
            isNullable: true,
          },
          {
            name: 'variable_refs',
            type: 'jsonb',
            isNullable: true,
          },
          {
            name: 'version',
            type: 'int',
            default: 1,
          },
          {
            name: 'changelog',
            type: 'text',
            isNullable: true,
          },
          {
            name: 'status',
            type: 'formula_status_enum',
            default: "'draft'",
          },
          {
            name: 'created_by',
            type: 'uuid',
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

    // Indexes
    await queryRunner.createIndex(
      'formulas',
      new TableIndex({
        name: 'IDX_FORMULAS_PAY_COMPONENT',
        columnNames: ['pay_component_id', 'school_id'],
      }),
    );

    await queryRunner.createIndex(
      'formulas',
      new TableIndex({
        name: 'IDX_FORMULAS_SCHOOL_ID',
        columnNames: ['school_id'],
      }),
    );

    await queryRunner.createIndex(
      'formulas',
      new TableIndex({
        name: 'IDX_FORMULAS_STATUS',
        columnNames: ['status'],
      }),
    );

    await queryRunner.createIndex(
      'formulas',
      new TableIndex({
        name: 'IDX_FORMULAS_VERSION',
        columnNames: ['pay_component_id', 'school_id', 'version'],
      }),
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropIndex('formulas', 'IDX_FORMULAS_VERSION');
    await queryRunner.dropIndex('formulas', 'IDX_FORMULAS_STATUS');
    await queryRunner.dropIndex('formulas', 'IDX_FORMULAS_SCHOOL_ID');
    await queryRunner.dropIndex('formulas', 'IDX_FORMULAS_PAY_COMPONENT');
    await queryRunner.dropTable('formulas');
    await queryRunner.query('DROP TYPE "formula_status_enum"');
  }
}
