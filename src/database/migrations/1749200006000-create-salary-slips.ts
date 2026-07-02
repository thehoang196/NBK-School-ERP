import { MigrationInterface, QueryRunner, Table, TableIndex } from 'typeorm';

export class CreateSalarySlips1749200006000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.createTable(
      new Table({
        name: 'salary_slips',
        columns: [
          {
            name: 'id',
            type: 'uuid',
            isPrimary: true,
            generationStrategy: 'uuid',
            default: 'uuid_generate_v4()',
          },
          {
            name: 'teacher_id',
            type: 'uuid',
            isNullable: false,
          },
          {
            name: 'school_id',
            type: 'uuid',
            isNullable: false,
          },
          {
            name: 'pay_period_id',
            type: 'uuid',
            isNullable: false,
          },
          {
            name: 'earnings',
            type: 'jsonb',
            isNullable: false,
            default: "'[]'",
          },
          {
            name: 'deductions',
            type: 'jsonb',
            isNullable: false,
            default: "'[]'",
          },
          {
            name: 'gross_amount',
            type: 'decimal',
            precision: 15,
            scale: 2,
            default: 0,
          },
          {
            name: 'total_deductions',
            type: 'decimal',
            precision: 15,
            scale: 2,
            default: 0,
          },
          {
            name: 'net_amount',
            type: 'decimal',
            precision: 15,
            scale: 2,
            default: 0,
          },
          {
            name: 'snapshot',
            type: 'jsonb',
            isNullable: true,
          },
          {
            name: 'status',
            type: 'enum',
            enum: ['draft', 'confirmed', 'paid'],
            default: "'draft'",
          },
          {
            name: 'errors',
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

    await queryRunner.createIndex(
      'salary_slips',
      new TableIndex({
        name: 'IDX_salary_slips_teacher_period',
        columnNames: ['teacher_id', 'pay_period_id'],
      }),
    );

    await queryRunner.createIndex(
      'salary_slips',
      new TableIndex({
        name: 'IDX_salary_slips_school_id',
        columnNames: ['school_id'],
      }),
    );

    await queryRunner.createIndex(
      'salary_slips',
      new TableIndex({
        name: 'IDX_salary_slips_status',
        columnNames: ['status'],
      }),
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropTable('salary_slips');
  }
}
