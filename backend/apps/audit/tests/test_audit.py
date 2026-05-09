from decimal import Decimal

import pytest
from django.urls import reverse

from apps.audit.models import AuditLog, AuditOperatorType
from apps.finance.models import CostType, Supplier
from apps.finance.services import create_payable
from apps.iam.models import AdminUser
from apps.iam.services import seed_iam_demo_data
from apps.members.models import User
from apps.members.services import seed_member_demo_data


@pytest.fixture
def seeded_audit(db):
    seed_iam_demo_data()
    seed_member_demo_data()


def admin_token(client, email="admin@example.com"):
    response = client.post(
        reverse("admin-login"),
        {"email": email, "password": "password123"},
        content_type="application/json",
    )
    return response.json()["data"]["access_token"]


def test_finance_admin_wallet_adjustment_writes_audit_log(client, seeded_audit):
    user = User.objects.get(email="user@example.com")
    token = admin_token(client, email="finance@example.com")

    response = client.post(
        reverse("admin-wallet-recharge", kwargs={"user_id": user.id}),
        {"amount": "100.00", "remark": "manual audit top-up"},
        content_type="application/json",
        HTTP_AUTHORIZATION=f"Bearer {token}",
    )

    assert response.status_code == 201
    transaction_id = response.json()["data"]["id"]
    audit_log = AuditLog.objects.get(action="finance.wallet.admin_recharge")
    assert audit_log.operator_type == AuditOperatorType.ADMIN
    assert audit_log.operator_label == "finance@example.com"
    assert audit_log.target_type == "WalletTransaction"
    assert audit_log.target_id == str(transaction_id)
    assert audit_log.request_method == "SERVICE"
    assert audit_log.request_path == "service://finance/finance.wallet.admin_recharge"
    assert audit_log.request_data["amount"] == "100.00"
    assert audit_log.request_data["user_id"] == user.id
    assert audit_log.request_data["balance_after"] == "100.00"


def test_admin_audit_log_list_is_readable_by_super_admin(client, seeded_audit):
    user = User.objects.get(email="user@example.com")
    finance_token = admin_token(client, email="finance@example.com")
    client.post(
        reverse("admin-wallet-recharge", kwargs={"user_id": user.id}),
        {"amount": "80.00", "remark": "audit list"},
        content_type="application/json",
        HTTP_AUTHORIZATION=f"Bearer {finance_token}",
    )
    super_token = admin_token(client, email="admin@example.com")

    response = client.get(
        reverse("admin-audit-log-list"),
        {"action": "finance.wallet.admin_recharge", "method": "SERVICE"},
        HTTP_AUTHORIZATION=f"Bearer {super_token}",
    )

    assert response.status_code == 200
    items = response.json()["data"]["items"]
    assert len(items) == 1
    assert items[0]["action"] == "finance.wallet.admin_recharge"
    assert items[0]["operator_label"] == "finance@example.com"
    assert items[0]["target_type"] == "WalletTransaction"


def test_audit_log_list_requires_role_management_permission(client, seeded_audit):
    user = User.objects.get(email="user@example.com")
    finance_token = admin_token(client, email="finance@example.com")
    client.post(
        reverse("admin-wallet-recharge", kwargs={"user_id": user.id}),
        {"amount": "50.00", "remark": "permission check"},
        content_type="application/json",
        HTTP_AUTHORIZATION=f"Bearer {finance_token}",
    )

    response = client.get(reverse("admin-audit-log-list"), HTTP_AUTHORIZATION=f"Bearer {finance_token}")

    assert response.status_code == 403


def test_payable_state_changes_write_audit_logs(seeded_audit):
    operator = AdminUser.objects.get(email="finance@example.com")
    supplier = Supplier.objects.create(code="AUDSUP", name="Audit Supplier")
    cost_type = CostType.objects.create(code="AUDCOST", name="Audit Cost")

    payable = create_payable(
        operator=operator,
        supplier=supplier,
        cost_type=cost_type,
        amount=Decimal("36.50"),
        description="audit payable",
    )

    audit_log = AuditLog.objects.get(action="finance.payable.create")
    assert audit_log.operator_type == AuditOperatorType.ADMIN
    assert audit_log.operator_id == operator.id
    assert audit_log.target_type == "Payable"
    assert audit_log.target_id == str(payable.id)
    assert audit_log.response_data["target_repr"] == payable.payable_no
    assert audit_log.request_data["amount"] == "36.50"
    assert audit_log.request_data["supplier_id"] == supplier.id
