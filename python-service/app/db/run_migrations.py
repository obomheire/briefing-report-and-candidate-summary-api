import argparse
import os
from pathlib import Path

import psycopg
from sqlalchemy.engine import make_url

from app.config import get_settings

MIGRATIONS_DIR = Path(__file__).resolve().parents[2] / 'db' / 'migrations'


def _get_database_url() -> str:
    database_url = os.getenv('DATABASE_URL') or get_settings().database_url
    if not database_url:
        raise RuntimeError('DATABASE_URL is required')
    return database_url


def _to_psycopg_conninfo(database_url: str) -> str:
    if database_url.startswith('postgresql+'):
        sqlalchemy_url = make_url(database_url)
        return sqlalchemy_url.set(drivername='postgresql').render_as_string(
            hide_password=False
        )
    return database_url


def _ensure_schema_migrations(conn: psycopg.Connection) -> None:
    with conn.cursor() as cur:
        cur.execute(
            '''
            CREATE TABLE IF NOT EXISTS schema_migrations (
              filename TEXT PRIMARY KEY,
              applied_at TIMESTAMPTZ NOT NULL DEFAULT now()
            );
            '''
        )
    conn.commit()


def _applied_migrations(conn: psycopg.Connection) -> set[str]:
    with conn.cursor() as cur:
        cur.execute('SELECT filename FROM schema_migrations;')
        rows = cur.fetchall()
    return {row[0] for row in rows}


def _apply_migration(conn: psycopg.Connection, filename: str, sql: str) -> None:
    with conn.cursor() as cur:
        cur.execute(sql)
        cur.execute(
            'INSERT INTO schema_migrations (filename) VALUES (%s);',
            (filename,),
        )
    conn.commit()


def _revert_migration(conn: psycopg.Connection, filename: str, sql: str) -> None:
    with conn.cursor() as cur:
        cur.execute(sql)
        cur.execute(
            'DELETE FROM schema_migrations WHERE filename = %s;',
            (filename,),
        )
    conn.commit()


def _is_up_migration_filename(filename: str) -> bool:
    if filename.endswith('.down.sql'):
        return False
    return filename.endswith('.up.sql') or filename.endswith('.sql')


def _get_down_filename(up_filename: str) -> str:
    if up_filename.endswith('.up.sql'):
        return up_filename.replace('.up.sql', '.down.sql')
    if up_filename.endswith('.sql'):
        return up_filename[:-4] + '.down.sql'
    raise RuntimeError(f'Unsupported migration filename: {up_filename}')


def _read_migration_sql(path: Path, filename: str) -> str:
    sql = path.read_text(encoding='utf-8').strip()
    if not sql:
        raise RuntimeError(f'Migration file is empty: {filename}')
    return sql


def _apply_pending_migrations(conn: psycopg.Connection) -> int:
    applied = _applied_migrations(conn)
    migration_files = sorted(
        path.name for path in MIGRATIONS_DIR.glob('*.sql') if _is_up_migration_filename(path.name)
    )

    applied_count = 0
    for filename in migration_files:
        if filename in applied:
            continue

        migration_path = MIGRATIONS_DIR / filename
        sql = _read_migration_sql(migration_path, filename)
        print(f'Applying migration: {filename}')
        _apply_migration(conn, filename, sql)
        applied_count += 1

    return applied_count


def _latest_applied_migrations(conn: psycopg.Connection, steps: int) -> list[str]:
    with conn.cursor() as cur:
        cur.execute(
            '''
            SELECT filename
            FROM schema_migrations
            ORDER BY applied_at DESC, filename DESC
            LIMIT %s;
            ''',
            (steps,),
        )
        rows = cur.fetchall()
    return [row[0] for row in rows]


def _rollback_migrations(conn: psycopg.Connection, steps: int) -> int:
    filenames = _latest_applied_migrations(conn, steps)
    if not filenames:
        print('No applied migrations to roll back.')
        return 0

    reverted_count = 0
    for filename in filenames:
        down_filename = _get_down_filename(filename)
        down_path = MIGRATIONS_DIR / down_filename
        if not down_path.exists():
            raise RuntimeError(
                f'Missing down migration file for {filename}: {down_filename}'
            )

        sql = _read_migration_sql(down_path, down_filename)
        print(f'Reverting migration: {filename} using {down_filename}')
        _revert_migration(conn, filename, sql)
        reverted_count += 1

    return reverted_count


def _parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description='Manual SQL migration runner')
    parser.add_argument(
        'command',
        nargs='?',
        choices=('up', 'down'),
        default='up',
        help='Migration direction: up (default) or down.',
    )
    parser.add_argument(
        '--steps',
        type=int,
        default=1,
        help='Number of latest migrations to roll back when command is down.',
    )
    return parser.parse_args()


def main() -> None:
    args = _parse_args()
    if args.steps < 1:
        raise RuntimeError('--steps must be at least 1')

    database_url = _get_database_url()
    conninfo = _to_psycopg_conninfo(database_url)

    if not MIGRATIONS_DIR.exists():
        raise RuntimeError(f'Migrations directory not found: {MIGRATIONS_DIR}')

    with psycopg.connect(conninfo) as conn:
        _ensure_schema_migrations(conn)

        if args.command == 'up':
            count = _apply_pending_migrations(conn)
            print(f'Migrations complete. Applied: {count}.')
            return

        count = _rollback_migrations(conn, args.steps)
        print(f'Rollback complete. Reverted: {count}.')


if __name__ == '__main__':
    main()
