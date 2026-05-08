# Generated for ADDR-001 address book.

import django.db.models.deletion
from django.db import migrations, models


class Migration(migrations.Migration):
    initial = True

    dependencies = [
        ("members", "0001_initial"),
    ]

    operations = [
        migrations.CreateModel(
            name="Address",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                (
                    "address_type",
                    models.CharField(
                        choices=[
                            ("RECIPIENT", "收件人"),
                            ("DECLARANT", "申报人"),
                            ("CONTACT", "联系人"),
                            ("SENDER", "寄件人"),
                        ],
                        default="RECIPIENT",
                        max_length=30,
                    ),
                ),
                ("contact_name", models.CharField(max_length=100)),
                ("phone", models.CharField(max_length=30)),
                ("country_region", models.CharField(blank=True, max_length=80)),
                ("province_city", models.CharField(blank=True, max_length=120)),
                ("detail_address", models.TextField()),
                ("postal_code", models.CharField(blank=True, max_length=30)),
                ("company", models.CharField(blank=True, max_length=120)),
                ("is_default", models.BooleanField(default=False)),
                ("is_active", models.BooleanField(default=True)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("updated_at", models.DateTimeField(auto_now=True)),
                (
                    "user",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="addresses",
                        to="members.user",
                    ),
                ),
            ],
            options={
                "db_table": "addresses",
                "ordering": ["-is_default", "-id"],
            },
        ),
        migrations.AddIndex(
            model_name="address",
            index=models.Index(fields=["user", "address_type", "is_active"], name="idx_addr_user_type_active"),
        ),
    ]
