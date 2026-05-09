from django.db import models


class AuditOperatorType(models.TextChoices):
    ADMIN = "ADMIN", "后台管理员"
    SYSTEM = "SYSTEM", "系统"
    UNKNOWN = "UNKNOWN", "未知"


class AuditLog(models.Model):
    operator_type = models.CharField(
        max_length=20,
        choices=AuditOperatorType.choices,
        default=AuditOperatorType.UNKNOWN,
    )
    operator_id = models.PositiveBigIntegerField(null=True, blank=True)
    operator_label = models.CharField(max_length=160, blank=True)
    action = models.CharField(max_length=180)
    target_type = models.CharField(max_length=120, blank=True)
    target_id = models.CharField(max_length=80, blank=True)
    request_method = models.CharField(max_length=12)
    request_path = models.CharField(max_length=255)
    status_code = models.PositiveSmallIntegerField(default=0)
    ip_address = models.CharField(max_length=64, blank=True)
    user_agent = models.CharField(max_length=255, blank=True)
    request_data = models.JSONField(default=dict, blank=True)
    response_data = models.JSONField(default=dict, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "audit_logs"
        ordering = ["-id"]
        indexes = [
            models.Index(fields=["operator_type", "operator_id"], name="idx_audit_operator"),
            models.Index(fields=["target_type", "target_id"], name="idx_audit_target"),
            models.Index(fields=["action"], name="idx_audit_action"),
            models.Index(fields=["created_at"], name="idx_audit_created"),
        ]

    def __str__(self) -> str:
        return f"{self.action} {self.target_type}:{self.target_id}"

