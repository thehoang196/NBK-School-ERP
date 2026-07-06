import { MigrationInterface, QueryRunner, Table, TableIndex } from 'typeorm';

export class CreateValidationRules1749300001000 implements MigrationInterface {
  name = 'CreateValidationRules1749300001000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TYPE "validation_rule_type_enum" AS ENUM ('range', 'regex', 'enum', 'reference', 'required', 'length', 'custom')
    `);

    await queryRunner.query(`
      CREATE TYPE "validation_entity_target_enum" AS ENUM ('teacher', 'subject', 'class', 'department', 'timetable_slot', 'teaching_assignment')
    `);

    await queryRunner.createTable(
      new Table({
        name: 'validation_rules',
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
            type: 'validation_entity_target_enum',
          },
          {
            name: 'field_name',
            type: 'varchar',
            length: '100',
          },
          {
            name: 'rule_type',
            type: 'validation_rule_type_enum',
          },
          {
            name: 'rule_config',
            type: 'jsonb',
          },
          {
            name: 'error_message',
            type: 'varchar',
            length: '255',
          },
          {
            name: 'is_active',
            type: 'boolean',
            default: true,
          },
          {
            name: 'priority',
            type: 'int',
            default: 0,
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

    await queryRunner.createIndices('validation_rules', [
      new TableIndex({
        name: 'IDX_validation_rules_school_entity',
        columnNames: ['school_id', 'entity_target'],
      }),
      new TableIndex({
        name: 'IDX_validation_rules_field',
        columnNames: ['school_id', 'entity_target', 'field_name'],
      }),
      new TableIndex({
        name: 'IDX_validation_rules_active',
        columnNames: ['is_active'],
      }),
    ]);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropTable('validation_rules');
    await queryRunner.query(`DROP TYPE "validation_rule_type_enum"`);
    await queryRunner.query(`DROP TYPE "validation_entity_target_enum"`);
  }
}
