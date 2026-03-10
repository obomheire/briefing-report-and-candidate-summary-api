import { MigrationInterface, QueryRunner, Table, TableForeignKey, TableIndex } from 'typeorm';

export class InitialStarterEntities1710000000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.createTable(
      new Table({
        name: 'sample_workspaces',
        columns: [
          {
            name: 'id',
            type: 'varchar',
            length: '64',
            isPrimary: true,
          },
          {
            name: 'name',
            type: 'varchar',
            length: '120',
            isNullable: false,
          },
          {
            name: 'created_at',
            type: 'timestamptz',
            default: 'now()',
            isNullable: false,
          },
        ],
      }),
    );

    await queryRunner.createTable(
      new Table({
        name: 'sample_candidates',
        columns: [
          {
            name: 'id',
            type: 'varchar',
            length: '64',
            isPrimary: true,
          },
          {
            name: 'workspace_id',
            type: 'varchar',
            length: '64',
            isNullable: false,
          },
          {
            name: 'full_name',
            type: 'varchar',
            length: '160',
            isNullable: false,
          },
          {
            name: 'email',
            type: 'varchar',
            length: '160',
            isNullable: true,
          },
          {
            name: 'created_at',
            type: 'timestamptz',
            default: 'now()',
            isNullable: false,
          },
        ],
      }),
    );

    await queryRunner.createForeignKey(
      'sample_candidates',
      new TableForeignKey({
        name: 'fk_sample_candidates_workspace_id',
        columnNames: ['workspace_id'],
        referencedTableName: 'sample_workspaces',
        referencedColumnNames: ['id'],
        onDelete: 'CASCADE',
      }),
    );

    await queryRunner.createIndex(
      'sample_candidates',
      new TableIndex({
        name: 'idx_sample_candidates_workspace_id',
        columnNames: ['workspace_id'],
      }),
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropIndex('sample_candidates', 'idx_sample_candidates_workspace_id');
    await queryRunner.dropForeignKey(
      'sample_candidates',
      'fk_sample_candidates_workspace_id',
    );
    await queryRunner.dropTable('sample_candidates');
    await queryRunner.dropTable('sample_workspaces');
  }
}
