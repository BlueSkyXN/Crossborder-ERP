from datetime import timedelta
from io import StringIO

import pytest
from django.contrib.auth.hashers import make_password
from django.core.management import call_command
from django.urls import reverse
from django.utils import timezone
from rest_framework.test import APIClient

from apps.audit.models import AuditLog, AuditOperatorType
from apps.iam.models import AdminUser, Permission, Role
from apps.iam.services import seed_iam_demo_data
from apps.members.services import seed_member_demo_data


@pytest.fixture
def seeded_audit_data(db):
    seed_iam_demo_data()
    seed_member_demo_data()


@pytest.fixture
def api_client():
    return APIClient()


def admin_login(client: APIClient, email="admin@example.com", password="password123"):
    return client.post(
        reverse("admin-login"),
        {"email": email, "password": password},
        format="json",
    )


def admin_token(client: APIClient, email="admin@example.com") -> str:
    return admin_login(client, email=email).json()["data"]["access_token"]


def create_admin_with_permissions(email: str, permission_codes: list[str]) -> AdminUser:
    role = Role.objects.create(code=email.split("@", maxsplit=1)[0].replace(".", "_"), name=email)
    role.permissions.set(Permission.objects.filter(code__in=permission_codes))
    admin = AdminUser.objects.create(
        email=email,
        name=email,
        password_hash=make_password("password123"),
    )
    admin.roles.set([role])
    return admin


def test_admin_mutation_writes_audit_log_and_redacts_sensitive_data(api_client, seeded_audit_data):
    token = admin_token(api_client)
    response = api_client.post(
        reverse("admin-wallet-recharge", kwargs={"user_id": 1}),
        {"amount": "10.00", "remark": "审计日志测试", "password": "should-not-leak"},
        HTTP_AUTHORIZATION=f"Bearer {token}",
        format="json",
    )

    assert response.status_code == 201
    log = AuditLog.objects.filter(action="admin-wallet-recharge").latest("id")
    assert log.operator_type == AuditOperatorType.ADMIN
    assert log.operator_id == 1
    assert log.operator_label == "admin@example.com"
    assert log.target_type == "users"
    assert log.target_id == "1"
    assert log.request_method == "POST"
    assert log.status_code == 201
    assert log.request_data["amount"] == "10.00"
    assert log.request_data["password"] == "***REDACTED***"


def test_admin_login_attempt_is_audited_without_plain_password(api_client, seeded_audit_data):
    response = admin_login(api_client)

    assert response.status_code == 200
    log = AuditLog.objects.filter(action="admin-login").latest("id")
    assert log.operator_type == AuditOperatorType.SYSTEM
    assert log.target_type == "auth"
    assert log.request_data["email"] == "admin@example.com"
    assert log.request_data["password"] == "***REDACTED***"
    assert "access_token" not in str(log.response_data)


def test_audit_log_list_requires_audit_permission(api_client, seeded_audit_data):
    super_token = admin_token(api_client)
    warehouse_token = admin_token(api_client, email="warehouse@example.com")

    denied = api_client.get(
        reverse("admin-audit-log-list"),
        HTTP_AUTHORIZATION=f"Bearer {warehouse_token}",
    )
    allowed = api_client.get(
        reverse("admin-audit-log-list"),
        HTTP_AUTHORIZATION=f"Bearer {super_token}",
    )

    assert denied.status_code == 403
    assert allowed.status_code == 200
    assert "items" in allowed.json()["data"]


def test_audit_log_export_csv_requires_permission_and_keeps_redaction(api_client, seeded_audit_data):
    super_token = admin_token(api_client)
    warehouse_token = admin_token(api_client, email="warehouse@example.com")
    create_admin_with_permissions("audit-viewer@example.com", ["dashboard.view", "audit.logs.view"])
    audit_viewer_token = admin_token(api_client, email="audit-viewer@example.com")
    response = api_client.post(
        reverse("admin-wallet-recharge", kwargs={"user_id": 1}),
        {"amount": "10.00", "remark": "导出测试", "password": "should-not-leak"},
        HTTP_AUTHORIZATION=f"Bearer {super_token}",
        format="json",
    )
    assert response.status_code == 201

    denied = api_client.get(
        f"{reverse('admin-audit-log-export')}?action=admin-wallet-recharge",
        HTTP_AUTHORIZATION=f"Bearer {warehouse_token}",
    )
    view_only_denied = api_client.get(
        f"{reverse('admin-audit-log-export')}?action=admin-wallet-recharge",
        HTTP_AUTHORIZATION=f"Bearer {audit_viewer_token}",
    )
    view_only_list = api_client.get(
        f"{reverse('admin-audit-log-list')}?action=admin-wallet-recharge",
        HTTP_AUTHORIZATION=f"Bearer {audit_viewer_token}",
    )
    allowed = api_client.get(
        f"{reverse('admin-audit-log-export')}?action=admin-wallet-recharge",
        HTTP_AUTHORIZATION=f"Bearer {super_token}",
    )

    assert denied.status_code == 403
    assert view_only_list.status_code == 200
    assert view_only_denied.status_code == 403
    assert allowed.status_code == 200
    assert allowed["Content-Type"].startswith("text/csv")
    assert "audit-logs-export.csv" in allowed["Content-Disposition"]
    body = allowed.content.decode("utf-8")
    assert "admin-wallet-recharge" in body
    assert "***REDACTED***" in body
    assert "should-not-leak" not in body
    assert "access_token" not in body


def test_purge_audit_logs_management_command_dry_run_and_delete(db):
    old_log = AuditLog.objects.create(
        operator_type=AuditOperatorType.SYSTEM,
        operator_label="system",
        action="old-action",
        request_method="SERVICE",
        request_path="service://audit/old",
    )
    fresh_log = AuditLog.objects.create(
        operator_type=AuditOperatorType.SYSTEM,
        operator_label="system",
        action="fresh-action",
        request_method="SERVICE",
        request_path="service://audit/fresh",
    )
    AuditLog.objects.filter(id=old_log.id).update(created_at=timezone.now() - timedelta(days=40))

    output = StringIO()
    call_command("purge_audit_logs", "--older-than-days", "30", "--dry-run", stdout=output)
    assert "Matched 1 audit logs" in output.getvalue()
    assert AuditLog.objects.filter(id=old_log.id).exists()

    output = StringIO()
    call_command("purge_audit_logs", "--older-than-days", "30", stdout=output)
    assert "Deleted 1 audit logs" in output.getvalue()
    assert not AuditLog.objects.filter(id=old_log.id).exists()
    assert AuditLog.objects.filter(id=fresh_log.id).exists()
