from datetime import timedelta

from django.core.management.base import BaseCommand, CommandError
from django.utils import timezone

from apps.files.models import FileStatus, StoredFile
from apps.files.services import get_storage_path


class Command(BaseCommand):
    help = "Delete local media files for StoredFile rows already marked as DELETED."

    def add_arguments(self, parser):
        parser.add_argument("--older-than-days", type=int, required=True)
        parser.add_argument("--dry-run", action="store_true")

    def handle(self, *args, **options):
        older_than_days = options["older_than_days"]
        if older_than_days < 1:
            raise CommandError("--older-than-days must be greater than 0")

        cutoff = timezone.now() - timedelta(days=older_than_days)
        files = StoredFile.objects.filter(
            status=FileStatus.DELETED,
            updated_at__lt=cutoff,
        ).order_by("id")

        matched = files.count()
        existing = 0
        deleted = 0
        missing = 0
        unsafe = 0

        for stored_file in files:
            try:
                path = get_storage_path(stored_file)
            except Exception:
                unsafe += 1
                continue

            if not path.exists():
                missing += 1
                continue

            if not path.is_file():
                unsafe += 1
                continue

            existing += 1
            if not options["dry_run"]:
                path.unlink()
                deleted += 1

        if options["dry_run"]:
            self.stdout.write(
                f"Matched {matched} deleted files older than {older_than_days} days; "
                f"would delete {existing}; missing {missing}; unsafe {unsafe}; dry run only."
            )
            return

        self.stdout.write(
            f"Deleted {deleted} local media files for {matched} deleted file records older than "
            f"{older_than_days} days; missing {missing}; unsafe {unsafe}."
        )
