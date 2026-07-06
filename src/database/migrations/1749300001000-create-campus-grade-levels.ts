import {
  MigrationInterface,
  QueryRunner,
  Table,
  TableIndex,
  TableForeignKey,
} from 'typeorm';

export class CreateCampusGradeLevels1749300001000 implements MigrationInterface {
  name = 'CreateCampusGradeLevels1749300001000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.createTable(
      new Table({
        name: 'campus_grade_levels',
        columns: [
          {
            name: 'id',
            type: 'uuid',
            isPrimary: true,
            generationStrategy: 'uuid',
            default: 'gen_random_uuid()',
          },
          {
            name: 'campus_id',
            type: 'uuid',
            isNullable: false,
          },
          {
            name: 'school_id',
            type: 'uuid',
            isNullable: false,
          },
          {
            name: 'grade_level',
            type: 'grade_level_enum',
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

    // FK to campuses table
    await queryRunner.createForeignKey(
      'campus_grade_levels',
      new TableForeignKey({
        name: 'FK_CAMPUS_GRADE_LEVELS_CAMPUS',
        columnNames: ['campus_id'],
        referencedColumnNames: ['id'],
        referencedTableName: 'campuses',
        onDelete: 'CASCADE',
      }),
    );

    // FK to schools table
    await queryRunner.createForeignKey(
      'campus_grade_levels',
      new TableForeignKey({
        name: 'FK_CAMPUS_GRADE_LEVELS_SCHOOL',
        columnNames: ['school_id'],
        referencedColumnNames: ['id'],
        referencedTableName: 'schools',
        onDelete: 'CASCADE',
      }),
    );

    // Index on campus_id for faster lookups
    await queryRunner.createIndex(
      'campus_grade_levels',
      new TableIndex({
        name: 'IDX_CAMPUS_GRADE_LEVELS_CAMPUS_ID',
        columnNames: ['campus_id'],
      }),
    );

    // Index on school_id for multi-tenant filtering
    await queryRunner.createIndex(
      'campus_grade_levels',
      new TableIndex({
        name: 'IDX_CAMPUS_GRADE_LEVELS_SCHOOL_ID',
        columnNames: ['school_id'],
      }),
    );

    // Partial unique index on (campus_id, grade_level) WHERE deleted_at IS NULL
    await queryRunner.createIndex(
      'campus_grade_levels',
      new TableIndex({
        name: 'UQ_CAMPUS_GRADE_LEVELS_CAMPUS_GRADE',
        columnNames: ['campus_id', 'grade_level'],
        isUnique: true,
        where: '"deleted_at" IS NULL',
      }),
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropIndex(
      'campus_grade_levels',
      'UQ_CAMPUS_GRADE_LEVELS_CAMPUS_GRADE',
    );
    await queryRunner.dropIndex(
      'campus_grade_levels',
      'IDX_CAMPUS_GRADE_LEVELS_SCHOOL_ID',
    );
    await queryRunner.dropIndex(
      'campus_grade_levels',
      'IDX_CAMPUS_GRADE_LEVELS_CAMPUS_ID',
    );
    await queryRunner.dropForeignKey(
      'campus_grade_levels',
      'FK_CAMPUS_GRADE_LEVELS_SCHOOL',
    );
    await queryRunner.dropForeignKey(
      'campus_grade_levels',
      'FK_CAMPUS_GRADE_LEVELS_CAMPUS',
    );
    await queryRunner.dropTable('campus_grade_levels');
  }
}
