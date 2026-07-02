import { MigrationInterface, QueryRunner, Table, TableIndex } from 'typeorm';

export class CreateCompensationRules1749200003000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TYPE "rule_action_type_enum" AS ENUM ('set_variable', 'set_coefficient')
    `);

    await queryRunner.createTable(
      new Table({
        name: 'compensation_rules',
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
            name: 'conditions',
            type: 'jsonb',
            isNullable: false,
          },
          {
            name: 'action_type',
            type: 'rule_action_type_enum',
            isNullable: false,
          },
          {
            name: 'action_target',
            type: 'varchar',
            length: '50',
            isNullable: false,
          },
          {
            name: 'action_value',
            type: 'varchar',
            length: '255',
            isNullable: false,
          },
          {
            name: 'priority',
            type: 'int',
            default: 0,
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

    // Indexes
    await queryRunner.createIndex(
      'compensation_rules',
      new TableIndex({
        name: 'IDX_COMP_RULES_SCHOOL_ID',
        columnNames: ['school_id'],
      }),
    );

    await queryRunner.createIndex(
      'compensation_rules',
      new TableIndex({
        name: 'IDX_COMP_RULES_STATUS',
        columnNames: ['status'],
      }),
    );

    await queryRunner.createIndex(
      'compensation_rules',
      new TableIndex({
        name: 'IDX_COMP_RULES_PRIORITY',
        columnNames: ['school_id', 'priority'],
      }),
    );

    await queryRunner.createIndex(
      'compensation_rules',
      new TableIndex({
        name: 'IDX_COMP_RULES_ACTION_TYPE',
        columnNames: ['action_type'],
      }),
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropIndex('compensation_rules', 'IDX_COMP_RULES_ACTION_TYPE');
    await queryRunner.dropIndex('compensation_rules', 'IDX_COMP_RULES_PRIORITY');
    await queryRunner.dropIndex('compensation_rules', 'IDX_COMP_RULES_STATUS');
    await queryRunner.dropIndex('compensation_rules', 'IDX_COMP_RULES_SCHOOL_ID');
    await queryRunner.dropTable('compensation_rules');
    await queryRunner.query('DROP TYPE "rule_action_type_enum"');
  }
}
