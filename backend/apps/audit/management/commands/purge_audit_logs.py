from datetime import timedelta

from django.core.management.base import BaseCommand, CommandError
from django.utils import timezone

from apps.audit.models import AuditLog


class Command(BaseCommand):
    help = "Delete audit logs older than the configured retention window."

    def add_arguments(self, parser):
        parser.add_argument("--older-than-days", type=int, required=True)
        parser.add_argument("--dry-run", action="store_true")

    def handle(self, *args, **options):
        older_than_days = options["older_than_days"]
        if older_than_days < 1:
            raise CommandError("--older-than-days must be greater than 0")

        cutoff = timezone.now() - timedelta(days=older_than_days)
        logs = AuditLog.objects.filter(created_at__lt=cutoff)
        count = logs.count()
        if options["dry_run"]:
            self.stdout.write(f"Matched {count} audit logs older than {older_than_days} days; dry run only.")
            return

        deleted, _ = logs.delete()
        self.stdout.write(f"Deleted {deleted} audit logs older than {older_than_days} days.")
