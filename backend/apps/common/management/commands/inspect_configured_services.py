import json

from django.conf import settings
from django.core.management.base import BaseCommand

from apps.common.configuration import (
    describe_celery_config,
    describe_database_config,
    describe_redis_url,
)


class Command(BaseCommand):
    help = "Inspect database/Redis/Celery configuration without opening external connections."
    requires_system_checks = []

    def add_arguments(self, parser):
        parser.add_argument(
            "--format",
            choices=["text", "json"],
            default="text",
            help="Output format. Defaults to text.",
        )

    def handle(self, *args, **options):
        database_summary = describe_database_config(settings.DATABASES["default"])
        redis_summary = describe_redis_url(getattr(settings, "CELERY_BROKER_URL", ""))
        celery_summary = describe_celery_config(
            bool(getattr(settings, "CELERY_TASK_ALWAYS_EAGER", True)),
            getattr(settings, "CELERY_BROKER_URL", ""),
        )
        summary = {
            "database": database_summary,
            "redis": redis_summary,
            "celery": celery_summary,
            "external_connections_opened": False,
        }

        if options["format"] == "json":
            self.stdout.write(json.dumps(summary, ensure_ascii=False, sort_keys=True))
            return

        self.stdout.write(f"database.engine={database_summary['engine']}")
        self.stdout.write(f"database.status={database_summary['status']}")
        self.stdout.write(f"redis.configured={str(redis_summary['configured']).lower()}")
        self.stdout.write(f"redis.status={redis_summary['status']}")
        self.stdout.write(f"celery.always_eager={str(celery_summary['always_eager']).lower()}")
        self.stdout.write(f"celery.status={celery_summary['status']}")
        self.stdout.write("external_connections_opened=false")
