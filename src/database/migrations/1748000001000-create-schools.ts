import { MigrationInterface, QueryRunner, Table, TableIndex, TableForeignKey } from 'typeorm';

export class CreateSchools1748000001000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // Create enum type for school status
    await queryRunner.query(`
      CREATE TYPE "school_status_enum" AS ENUM ('active', 'inactive')
    `);

    await queryRunner.createTable(
      new Table({
        name: 'schools',
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
            length: '20',
            isNullable: false,
            isUnique: true,
          },
          {
            name: 'name',
            type: 'varchar',
            length: '255',
            isNullable: false,
          },
          {
            name: 'address',
            type: 'text',
            isNullable: true,
          },
          {
            name: 'phone',
            type: 'varchar',
            length: '20',
            isNullable: true,
          },
          {
            name: 'email',
            type: 'varchar',
            length: '100',
            isNullable: true,
          },
          {
            name: 'principal_name',
            type: 'varchar',
            length: '100',
            isNullable: true,
          },
          {
            name: 'parent_school_id',
            type: 'uuid',
            isNullable: true,
          },
          {
            name: 'status',
            type: 'school_status_enum',
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

    // Self-referencing FK for parent school
    await queryRunner.createForeignKey(
      'schools',
      new TableForeignKey({
        name: 'FK_SCHOOLS_PARENT',
        columnNames: ['parent_school_id'],
        referencedColumnNames: ['id'],
        referencedTableName: 'schools',
        onDelete: 'SET NULL',
      }),
    );

    // Create index on code
    await queryRunner.createIndex(
      'schools',
      new TableIndex({
        name: 'IDX_SCHOOLS_CODE',
        columnNames: ['code'],
        isUnique: true,
        where: '"deleted_at" IS NULL',
      }),
    );

    // Create index on status
    await queryRunner.createIndex(
      'schools',
      new TableIndex({
        name: 'IDX_SCHOOLS_STATUS',
        columnNames: ['status'],
      }),
    );

    // Add FK from users to schools
    await queryRunner.createForeignKey(
      'users',
      new TableForeignKey({
        name: 'FK_USERS_SCHOOL',
        columnNames: ['school_id'],
        referencedColumnNames: ['id'],
        referencedTableName: 'schools',
        onDelete: 'SET NULL',
      }),
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropForeignKey('users', 'FK_USERS_SCHOOL');
    await queryRunner.dropIndex('schools', 'IDX_SCHOOLS_STATUS');
    await queryRunner.dropIndex('schools', 'IDX_SCHOOLS_CODE');
    await queryRunner.dropForeignKey('schools', 'FK_SCHOOLS_PARENT');
    await queryRunner.dropTable('schools');
    await queryRunner.query('DROP TYPE "school_status_enum"');
  }
}
