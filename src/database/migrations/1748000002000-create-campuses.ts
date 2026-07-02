import { MigrationInterface, QueryRunner, Table, TableIndex, TableForeignKey } from 'typeorm';

export class CreateCampuses1748000002000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // Create enum type for campus status
    await queryRunner.query(`
      CREATE TYPE "campus_status_enum" AS ENUM ('active', 'inactive')
    `);

    await queryRunner.createTable(
      new Table({
        name: 'campuses',
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
            name: 'school_id',
            type: 'uuid',
            isNullable: false,
          },
          {
            name: 'status',
            type: 'campus_status_enum',
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

    // FK to schools table
    await queryRunner.createForeignKey(
      'campuses',
      new TableForeignKey({
        name: 'FK_CAMPUSES_SCHOOL',
        columnNames: ['school_id'],
        referencedColumnNames: ['id'],
        referencedTableName: 'schools',
        onDelete: 'CASCADE',
      }),
    );

    // Create index on school_id
    await queryRunner.createIndex(
      'campuses',
      new TableIndex({
        name: 'IDX_CAMPUSES_SCHOOL_ID',
        columnNames: ['school_id'],
      }),
    );

    // Create unique index on code + school_id (campus code unique within a school)
    await queryRunner.createIndex(
      'campuses',
      new TableIndex({
        name: 'IDX_CAMPUSES_CODE_SCHOOL',
        columnNames: ['code', 'school_id'],
        isUnique: true,
        where: '"deleted_at" IS NULL',
      }),
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropIndex('campuses', 'IDX_CAMPUSES_CODE_SCHOOL');
    await queryRunner.dropIndex('campuses', 'IDX_CAMPUSES_SCHOOL_ID');
    await queryRunner.dropForeignKey('campuses', 'FK_CAMPUSES_SCHOOL');
    await queryRunner.dropTable('campuses');
    await queryRunner.query('DROP TYPE "campus_status_enum"');
  }
}
