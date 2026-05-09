from rest_framework import serializers

from .models import AuditLog


class AuditLogSerializer(serializers.ModelSerializer):
    class Meta:
        model = AuditLog
        fields = [
            "id",
            "operator_type",
            "operator_id",
            "operator_label",
            "action",
            "target_type",
            "target_id",
            "request_method",
            "request_path",
            "status_code",
            "ip_address",
            "user_agent",
            "request_data",
            "response_data",
            "created_at",
        ]
        read_only_fields = fields

