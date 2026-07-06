import { MigrationInterface, QueryRunner, Table, TableIndex } from 'typeorm';

export class CreatePayComponents1749200000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // Create enum type for pay component type
    await queryRunner.query(`
      CREATE TYPE "pay_component_type_enum" AS ENUM ('earning', 'deduction')
    `);

    await queryRunner.createTable(
      new Table({
        name: 'pay_components',
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
            isNullable: false,
          },
          {
            name: 'code',
            type: 'varchar',
            length: '50',
            isNullable: false,
          },
          {
            name: 'name',
            type: 'varchar',
            length: '100',
            isNullable: false,
          },
          {
            name: 'type',
            type: 'pay_component_type_enum',
            isNullable: false,
          },
          {
            name: 'sort_order',
            type: 'int',
            default: 0,
          },
          {
            name: 'is_taxable',
            type: 'boolean',
            default: false,
          },
          {
            name: 'is_insurance_applicable',
            type: 'boolean',
            default: false,
          },
          {
            name: 'is_statutory',
            type: 'boolean',
            default: false,
          },
          {
            name: 'status',
            type: 'varchar',
            length: '20',
            default: "'active'",
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

    // Index on school_id
    await queryRunner.createIndex(
      'pay_components',
      new TableIndex({
        name: 'IDX_PAY_COMPONENTS_SCHOOL_ID',
        columnNames: ['school_id'],
      }),
    );

    // Unique constraint on (school_id, code) where deleted_at IS NULL
    await queryRunner.createIndex(
      'pay_components',
      new TableIndex({
        name: 'IDX_PAY_COMPONENTS_SCHOOL_CODE_UNIQUE',
        columnNames: ['school_id', 'code'],
        isUnique: true,
        where: '"deleted_at" IS NULL',
      }),
    );

    // Index on type
    await queryRunner.createIndex(
      'pay_components',
      new TableIndex({
        name: 'IDX_PAY_COMPONENTS_TYPE',
        columnNames: ['type'],
      }),
    );

    // Index on status
    await queryRunner.createIndex(
      'pay_components',
      new TableIndex({
        name: 'IDX_PAY_COMPONENTS_STATUS',
        columnNames: ['status'],
      }),
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropIndex('pay_components', 'IDX_PAY_COMPONENTS_STATUS');
    await queryRunner.dropIndex('pay_components', 'IDX_PAY_COMPONENTS_TYPE');
    await queryRunner.dropIndex(
      'pay_components',
      'IDX_PAY_COMPONENTS_SCHOOL_CODE_UNIQUE',
    );
    await queryRunner.dropIndex(
      'pay_components',
      'IDX_PAY_COMPONENTS_SCHOOL_ID',
    );
    await queryRunner.dropTable('pay_components');
    await queryRunner.query('DROP TYPE "pay_component_type_enum"');
  }
}
