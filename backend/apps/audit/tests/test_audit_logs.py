import pytest
from django.urls import reverse
from rest_framework.test import APIClient

from apps.audit.models import AuditLog, AuditOperatorType
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
