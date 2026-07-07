import {
  MigrationInterface,
  QueryRunner,
  Table,
  TableForeignKey,
  TableIndex,
  TableUnique,
} from 'typeorm';

export class CreateFeatureFlags1749300020000 implements MigrationInterface {
  name = 'CreateFeatureFlags1749300020000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.createTable(
      new Table({
        name: 'feature_flags',
        columns: [
          {
            name: 'id',
            type: 'uuid',
            isPrimary: true,
            generationStrategy: 'uuid',
            default: 'gen_random_uuid()',
          },
          {
            name: 'organization_id',
            type: 'uuid',
          },
          {
            name: 'flag_key',
            type: 'varchar',
            length: '100',
          },
          {
            name: 'enabled',
            type: 'boolean',
            default: false,
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
        ],
        uniques: [
          new TableUnique({
            name: 'uq_feature_flags_org_flag_key',
            columnNames: ['organization_id', 'flag_key'],
          }),
        ],
      }),
      true,
    );

    await queryRunner.createForeignKey(
      'feature_flags',
      new TableForeignKey({
        name: 'fk_feature_flags_organization',
        columnNames: ['organization_id'],
        referencedTableName: 'schools',
        referencedColumnNames: ['id'],
        onDelete: 'CASCADE',
      }),
    );

    await queryRunner.createIndex(
      'feature_flags',
      new TableIndex({
        name: 'idx_feature_flags_organization_id',
        columnNames: ['organization_id'],
      }),
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropForeignKey(
      'feature_flags',
      'fk_feature_flags_organization',
    );
    await queryRunner.dropTable('feature_flags');
  }
}
