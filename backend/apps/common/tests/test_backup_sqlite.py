import sqlite3
from io import StringIO

import pytest
from django.core.management import call_command
from django.core.management.base import CommandError

pytestmark = pytest.mark.filterwarnings(
    "ignore:Overriding setting DATABASES can lead to unexpected behavior"
)


def _create_sqlite_database(path):
    with sqlite3.connect(path) as connection:
        connection.execute("CREATE TABLE sample (id integer primary key, name text)")
        connection.execute("INSERT INTO sample (name) VALUES (?)", ("ready",))


def _add_database(settings, alias, config):
    settings.DATABASES = {**settings.DATABASES, alias: config}
    return alias


def test_backup_sqlite_creates_restorable_file(tmp_path, settings):
    source = tmp_path / "source.sqlite3"
    output_dir = tmp_path / "backups"
    _create_sqlite_database(source)
    alias = _add_database(
        settings,
        "backup_test",
        {
            "ENGINE": "django.db.backends.sqlite3",
            "NAME": str(source),
        },
    )

    stdout = StringIO()
    call_command(
        "backup_sqlite",
        database=alias,
        output_dir=str(output_dir),
        filename="snapshot.sqlite3",
        stdout=stdout,
    )

    backup = output_dir / "snapshot.sqlite3"
    assert backup.exists()
    with sqlite3.connect(backup) as connection:
        row = connection.execute("SELECT name FROM sample WHERE id = 1").fetchone()
    assert row == ("ready",)
    assert "SQLite backup created" in stdout.getvalue()


def test_backup_sqlite_dry_run_does_not_create_file(tmp_path, settings):
    source = tmp_path / "source.sqlite3"
    output_dir = tmp_path / "backups"
    _create_sqlite_database(source)
    alias = _add_database(
        settings,
        "backup_dry_run",
        {
            "ENGINE": "django.db.backends.sqlite3",
            "NAME": str(source),
        },
    )

    stdout = StringIO()
    call_command(
        "backup_sqlite",
        database=alias,
        output_dir=str(output_dir),
        filename="snapshot.sqlite3",
        dry_run=True,
        stdout=stdout,
    )

    assert not output_dir.exists()
    assert "Dry run only" in stdout.getvalue()


def test_backup_sqlite_rejects_existing_destination_without_force(tmp_path, settings):
    source = tmp_path / "source.sqlite3"
    output_dir = tmp_path / "backups"
    output_dir.mkdir()
    (output_dir / "snapshot.sqlite3").write_bytes(b"existing")
    _create_sqlite_database(source)
    alias = _add_database(
        settings,
        "backup_existing",
        {
            "ENGINE": "django.db.backends.sqlite3",
            "NAME": str(source),
        },
    )

    with pytest.raises(CommandError, match="already exists"):
        call_command(
            "backup_sqlite",
            database=alias,
            output_dir=str(output_dir),
            filename="snapshot.sqlite3",
        )


def test_backup_sqlite_force_overwrites_existing_destination(tmp_path, settings):
    source = tmp_path / "source.sqlite3"
    output_dir = tmp_path / "backups"
    output_dir.mkdir()
    backup = output_dir / "snapshot.sqlite3"
    backup.write_bytes(b"not a sqlite database")
    _create_sqlite_database(source)
    alias = _add_database(
        settings,
        "backup_force",
        {
            "ENGINE": "django.db.backends.sqlite3",
            "NAME": str(source),
        },
    )

    call_command(
        "backup_sqlite",
        database=alias,
        output_dir=str(output_dir),
        filename="snapshot.sqlite3",
        force=True,
    )

    with sqlite3.connect(backup) as connection:
        row = connection.execute("SELECT name FROM sample WHERE id = 1").fetchone()
    assert row == ("ready",)


def test_backup_sqlite_rejects_non_file_or_non_sqlite_databases(settings):
    memory_alias = _add_database(
        settings,
        "backup_memory",
        {
            "ENGINE": "django.db.backends.sqlite3",
            "NAME": ":memory:",
        },
    )
    postgres_alias = _add_database(
        settings,
        "backup_postgres",
        {
            "ENGINE": "django.db.backends.postgresql",
            "NAME": "configured_unverified",
        },
    )

    with pytest.raises(CommandError, match="file-backed SQLite"):
        call_command("backup_sqlite", database=memory_alias)
    with pytest.raises(CommandError, match="only supports"):
        call_command("backup_sqlite", database=postgres_alias)
