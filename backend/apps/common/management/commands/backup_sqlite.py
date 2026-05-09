import re
import sqlite3
from datetime import UTC, datetime
from pathlib import Path

from django.conf import settings
from django.core.management.base import BaseCommand, CommandError
from django.db import connections


def _safe_alias(value: str) -> str:
    safe = re.sub(r"[^a-zA-Z0-9_-]+", "-", value).strip("-")
    return safe or "default"


class Command(BaseCommand):
    help = "Create an explicit backup of a file-backed SQLite database."

    def add_arguments(self, parser):
        parser.add_argument(
            "--database",
            default="default",
            help="Django database alias to back up. Defaults to 'default'.",
        )
        parser.add_argument(
            "--output-dir",
            default=None,
            help="Directory for the backup file. Defaults to backend/backups/.",
        )
        parser.add_argument(
            "--filename",
            default=None,
            help="Backup filename. Defaults to crossborder-erp-<alias>-<timestamp>.sqlite3.",
        )
        parser.add_argument(
            "--force",
            action="store_true",
            help="Overwrite the destination file if it already exists.",
        )
        parser.add_argument(
            "--dry-run",
            action="store_true",
            help="Validate source and destination without creating a backup file.",
        )

    def handle(self, *args, **options):
        database = options["database"]
        databases = settings.DATABASES
        if database not in databases:
            raise CommandError(f"Unknown database alias: {database}")

        config = databases[database]
        engine = config.get("ENGINE", "")
        if engine != "django.db.backends.sqlite3":
            raise CommandError(
                "backup_sqlite only supports django.db.backends.sqlite3 databases."
            )

        source_name = str(config.get("NAME", ""))
        if not source_name or source_name == ":memory:":
            raise CommandError("backup_sqlite requires a file-backed SQLite database.")

        source_path = Path(source_name).expanduser().resolve()
        if not source_path.exists():
            raise CommandError(f"SQLite database file does not exist: {source_path}")

        output_dir = Path(
            options["output_dir"] or (settings.BASE_DIR / "backups")
        ).expanduser()
        filename = options["filename"] or self._default_filename(database)
        destination_path = (output_dir / filename).resolve()
        if source_path == destination_path:
            raise CommandError("Backup destination must be different from source database.")
        if destination_path.exists() and not options["force"]:
            raise CommandError(
                f"Backup destination already exists: {destination_path}. Use --force to overwrite."
            )

        self.stdout.write(f"SQLite source: {source_path}")
        self.stdout.write(f"Backup destination: {destination_path}")

        if options["dry_run"]:
            self.stdout.write("Dry run only; no backup file created.")
            return

        destination_path.parent.mkdir(parents=True, exist_ok=True)
        if destination_path.exists() and options["force"]:
            destination_path.unlink()
        try:
            if database in connections.databases:
                connections[database].close()
        except Exception:
            pass
        self._backup(source_path, destination_path)
        size = destination_path.stat().st_size
        self.stdout.write(self.style.SUCCESS(f"SQLite backup created: {destination_path}"))
        self.stdout.write(f"Backup size: {size} bytes")

    def _default_filename(self, database: str) -> str:
        timestamp = datetime.now(UTC).strftime("%Y%m%dT%H%M%SZ")
        return f"crossborder-erp-{_safe_alias(database)}-{timestamp}.sqlite3"

    def _backup(self, source_path: Path, destination_path: Path) -> None:
        source_uri = f"file:{source_path}?mode=ro"
        try:
            with sqlite3.connect(source_uri, uri=True) as source:
                with sqlite3.connect(destination_path) as destination:
                    source.backup(destination)
        except sqlite3.Error as exc:
            raise CommandError("SQLite backup failed.") from exc
