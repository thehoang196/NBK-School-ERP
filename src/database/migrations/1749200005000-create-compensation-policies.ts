import { MigrationInterface, QueryRunner, Table, TableIndex } from 'typeorm';

export class CreateCompensationPolicies1749200005000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.createTable(
      new Table({
        name: 'compensation_policies',
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
            name: 'name',
            type: 'varchar',
            length: '100',
            isNullable: false,
          },
          {
            name: 'campus_id',
            type: 'uuid',
            isNullable: true,
          },
          {
            name: 'school_level',
            type: 'varchar',
            length: '50',
            isNullable: true,
          },
          {
            name: 'pay_component_ids',
            type: 'jsonb',
            isNullable: false,
            default: "'[]'",
          },
          {
            name: 'effective_from',
            type: 'date',
            isNullable: false,
          },
          {
            name: 'effective_to',
            type: 'date',
            isNullable: true,
          },
          {
            name: 'status',
            type: 'enum',
            enum: ['active', 'inactive'],
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

    await queryRunner.createIndex(
      'compensation_policies',
      new TableIndex({
        name: 'IDX_compensation_policies_school_id',
        columnNames: ['school_id'],
      }),
    );

    await queryRunner.createIndex(
      'compensation_policies',
      new TableIndex({
        name: 'IDX_compensation_policies_scope',
        columnNames: ['school_id', 'campus_id', 'school_level'],
      }),
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropTable('compensation_policies');
  }
}
