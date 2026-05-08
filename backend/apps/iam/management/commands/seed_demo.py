from django.core.management.base import BaseCommand

from apps.iam.services import seed_iam_demo_data
from apps.members.services import seed_member_demo_data


class Command(BaseCommand):
    help = "Seed demo IAM roles, permissions, and admin users."

    def handle(self, *args, **options):
        seed_iam_demo_data()
        seed_member_demo_data()
        self.stdout.write(self.style.SUCCESS("Seeded demo data."))
