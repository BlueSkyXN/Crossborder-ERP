from django.db import migrations, models


class Migration(migrations.Migration):
    initial = True

    dependencies = []

    operations = [
        migrations.CreateModel(
            name="AuditLog",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                (
                    "operator_type",
                    models.CharField(
                        choices=[("ADMIN", "后台管理员"), ("SYSTEM", "系统"), ("UNKNOWN", "未知")],
                        default="UNKNOWN",
                        max_length=20,
                    ),
                ),
                ("operator_id", models.PositiveBigIntegerField(blank=True, null=True)),
                ("operator_label", models.CharField(blank=True, max_length=160)),
                ("action", models.CharField(max_length=180)),
                ("target_type", models.CharField(blank=True, max_length=120)),
                ("target_id", models.CharField(blank=True, max_length=80)),
                ("request_method", models.CharField(max_length=12)),
                ("request_path", models.CharField(max_length=255)),
                ("status_code", models.PositiveSmallIntegerField(default=0)),
                ("ip_address", models.CharField(blank=True, max_length=64)),
                ("user_agent", models.CharField(blank=True, max_length=255)),
                ("request_data", models.JSONField(blank=True, default=dict)),
                ("response_data", models.JSONField(blank=True, default=dict)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
            ],
            options={
                "db_table": "audit_logs",
                "ordering": ["-id"],
            },
        ),
        migrations.AddIndex(
            model_name="auditlog",
            index=models.Index(fields=["operator_type", "operator_id"], name="idx_audit_operator"),
        ),
        migrations.AddIndex(
            model_name="auditlog",
            index=models.Index(fields=["target_type", "target_id"], name="idx_audit_target"),
        ),
        migrations.AddIndex(
            model_name="auditlog",
            index=models.Index(fields=["action"], name="idx_audit_action"),
        ),
        migrations.AddIndex(
            model_name="auditlog",
            index=models.Index(fields=["created_at"], name="idx_audit_created"),
        ),
    ]
