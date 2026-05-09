from decimal import Decimal

import pytest
from django.contrib.auth.hashers import make_password
from django.core.files.uploadedfile import SimpleUploadedFile
from django.urls import reverse

from apps.files.models import FileUsage
from apps.finance.models import (
    CostType,
    CostTypeStatus,
    Payable,
    PayableStatus,
    PaymentOrder,
    PaymentOrderStatus,
    RechargeRequest,
    RechargeRequestStatus,
    Supplier,
    SupplierStatus,
    Wallet,
    WalletTransaction,
    WalletTransactionType,
)
from apps.iam.models import AdminUser, Permission, Role
from apps.iam.services import seed_iam_demo_data
from apps.members.models import User
from apps.members.services import issue_member_access_token, register_user, seed_member_demo_data
from apps.parcels.services import forecast_parcel, inbound_parcel
from apps.warehouses.models import ShippingChannel, Warehouse
from apps.warehouses.services import seed_warehouse_demo_data
from apps.waybills.models import WaybillStatus
from apps.waybills.services import create_waybill, review_waybill, set_waybill_fee


@pytest.fixture
def seeded_finance(db):
    seed_iam_demo_data()
    seed_member_demo_data()
    seed_warehouse_demo_data()


def member_token(client, email="user@example.com", password="password123"):
    response = client.post(
        reverse("member-login"),
        {"email": email, "password": password},
        content_type="application/json",
    )
    return response.json()["data"]["access_token"]


def upload_remittance_proof(client, token, name="remittance.jpg"):
    response = client.post(
        reverse("file-list"),
        {
            "usage": FileUsage.REMITTANCE_PROOF,
            "file": SimpleUploadedFile(name, b"remittance-proof", content_type="image/jpeg"),
        },
        HTTP_AUTHORIZATION=f"Bearer {token}",
    )
    assert response.status_code == 201
    return response.json()["data"]["file_id"]


def admin_token(client, email="finance@example.com"):
    response = client.post(
        reverse("admin-login"),
        {"email": email, "password": "password123"},
        content_type="application/json",
    )
    return response.json()["data"]["access_token"]


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


def payable_waybill(tracking_no="FIN10001", fee_total=Decimal("25.80")):
    user = User.objects.get(email="user@example.com")
    warehouse = Warehouse.objects.get(code="SZ")
    parcel = forecast_parcel(user=user, warehouse=warehouse, tracking_no=tracking_no)
    inbound_parcel(parcel=parcel, operator=None, weight_kg=Decimal("1.500"))
    waybill = create_waybill(
        user=user,
        parcel_ids=[parcel.id],
        channel=ShippingChannel.objects.get(code="TEST_AIR"),
        destination_country="US",
        recipient_snapshot={
            "name": "Finance Receiver",
            "phone": "15500000000",
            "address": "100 Test Street",
            "postal_code": "90001",
        },
    )
    operator = AdminUser.objects.get(email="warehouse@example.com")
    reviewed = review_waybill(waybill=waybill, operator=operator)
    return set_waybill_fee(waybill=reviewed, operator=operator, fee_total=fee_total)


def test_admin_recharge_generates_wallet_transaction(client, seeded_finance):
    user = User.objects.get(email="user@example.com")
    token = admin_token(client)

    response = client.post(
        reverse("admin-wallet-recharge", kwargs={"user_id": user.id}),
        {"amount": "100.00", "remark": "manual top-up"},
        content_type="application/json",
        HTTP_AUTHORIZATION=f"Bearer {token}",
    )

    assert response.status_code == 201
    data = response.json()["data"]
    assert data["type"] == WalletTransactionType.ADMIN_RECHARGE
    assert data["amount"] == "100.00"
    assert data["balance_after"] == "100.00"
    assert Wallet.objects.get(user=user).balance == Decimal("100.00")

    wallet_response = client.get(reverse("wallet-detail"), HTTP_AUTHORIZATION=f"Bearer {member_token(client)}")
    assert wallet_response.status_code == 200
    assert wallet_response.json()["data"]["balance"] == "100.00"


def test_member_submits_offline_remittance_with_own_proof(client, seeded_finance):
    token = member_token(client)
    proof_file_id = upload_remittance_proof(client, token)

    response = client.post(
        reverse("remittance-list"),
        {"amount": "120.50", "proof_file_id": proof_file_id, "remark": "bank transfer"},
        content_type="application/json",
        HTTP_AUTHORIZATION=f"Bearer {token}",
    )

    assert response.status_code == 201
    data = response.json()["data"]
    assert data["request_no"].startswith("RCG")
    assert data["status"] == RechargeRequestStatus.PENDING
    assert data["amount"] == "120.50"
    assert data["proof_file_id"] == proof_file_id
    assert data["proof_file_name"] == "remittance.jpg"
    assert data["proof_download_url"] == f"/api/v1/files/{proof_file_id}/download"
    assert Wallet.objects.get(user__email="user@example.com").balance == 0


def test_member_cannot_submit_remittance_with_another_members_proof(client, seeded_finance):
    owner = register_user("remittance-owner@example.com", "password123")
    other = register_user("remittance-other@example.com", "password123")
    owner_token = issue_member_access_token(owner)
    other_token = issue_member_access_token(other)
    proof_file_id = upload_remittance_proof(client, owner_token)

    response = client.post(
        reverse("remittance-list"),
        {"amount": "88.00", "proof_file_id": proof_file_id},
        content_type="application/json",
        HTTP_AUTHORIZATION=f"Bearer {other_token}",
    )

    assert response.status_code == 400
    assert response.json()["code"] == "VALIDATION_ERROR"
    assert RechargeRequest.objects.count() == 0


def test_member_lists_only_own_offline_remittances(client, seeded_finance):
    user_token = member_token(client)
    other = register_user("remittance-list-other@example.com", "password123")
    other_token = issue_member_access_token(other)
    user_proof_id = upload_remittance_proof(client, user_token, "own.jpg")
    other_proof_id = upload_remittance_proof(client, other_token, "other.jpg")

    client.post(
        reverse("remittance-list"),
        {"amount": "50.00", "proof_file_id": user_proof_id},
        content_type="application/json",
        HTTP_AUTHORIZATION=f"Bearer {user_token}",
    )
    client.post(
        reverse("remittance-list"),
        {"amount": "75.00", "proof_file_id": other_proof_id},
        content_type="application/json",
        HTTP_AUTHORIZATION=f"Bearer {other_token}",
    )

    response = client.get(reverse("remittance-list"), HTTP_AUTHORIZATION=f"Bearer {user_token}")

    assert response.status_code == 200
    items = response.json()["data"]["items"]
    assert len(items) == 1
    assert items[0]["proof_file_id"] == user_proof_id


def test_admin_approves_offline_remittance_once(client, seeded_finance):
    user = User.objects.get(email="user@example.com")
    member = member_token(client)
    proof_file_id = upload_remittance_proof(client, member)
    submit = client.post(
        reverse("remittance-list"),
        {"amount": "230.00", "proof_file_id": proof_file_id, "remark": "offline bank transfer"},
        content_type="application/json",
        HTTP_AUTHORIZATION=f"Bearer {member}",
    )
    remittance_id = submit.json()["data"]["id"]
    admin = admin_token(client)

    approve = client.post(
        reverse("admin-remittance-approve", kwargs={"remittance_id": remittance_id}),
        {"review_remark": "received"},
        content_type="application/json",
        HTTP_AUTHORIZATION=f"Bearer {admin}",
    )
    repeat = client.post(
        reverse("admin-remittance-approve", kwargs={"remittance_id": remittance_id}),
        {"review_remark": "received again"},
        content_type="application/json",
        HTTP_AUTHORIZATION=f"Bearer {admin}",
    )

    assert approve.status_code == 200
    assert approve.json()["data"]["type"] == WalletTransactionType.OFFLINE_REMITTANCE
    assert approve.json()["data"]["balance_after"] == "230.00"
    assert repeat.status_code == 409
    assert repeat.json()["code"] == "STATE_CONFLICT"
    assert Wallet.objects.get(user=user).balance == Decimal("230.00")
    assert WalletTransaction.objects.filter(type=WalletTransactionType.OFFLINE_REMITTANCE).count() == 1
    remittance = RechargeRequest.objects.get(id=remittance_id)
    assert remittance.status == RechargeRequestStatus.COMPLETED
    assert remittance.review_remark == "received"
    assert remittance.operator.email == "finance@example.com"
    assert remittance.reviewed_at is not None


def test_admin_cancels_offline_remittance_without_credit(client, seeded_finance):
    user = User.objects.get(email="user@example.com")
    member = member_token(client)
    proof_file_id = upload_remittance_proof(client, member)
    submit = client.post(
        reverse("remittance-list"),
        {"amount": "60.00", "proof_file_id": proof_file_id},
        content_type="application/json",
        HTTP_AUTHORIZATION=f"Bearer {member}",
    )
    remittance_id = submit.json()["data"]["id"]
    admin = admin_token(client)

    cancel = client.post(
        reverse("admin-remittance-cancel", kwargs={"remittance_id": remittance_id}),
        {"review_remark": "amount not matched"},
        content_type="application/json",
        HTTP_AUTHORIZATION=f"Bearer {admin}",
    )
    approve_after_cancel = client.post(
        reverse("admin-remittance-approve", kwargs={"remittance_id": remittance_id}),
        {"review_remark": "late approve"},
        content_type="application/json",
        HTTP_AUTHORIZATION=f"Bearer {admin}",
    )

    assert cancel.status_code == 200
    assert cancel.json()["data"]["status"] == RechargeRequestStatus.CANCELLED
    assert approve_after_cancel.status_code == 409
    assert Wallet.objects.get(user=user).balance == Decimal("0.00")
    assert WalletTransaction.objects.filter(type=WalletTransactionType.OFFLINE_REMITTANCE).count() == 0


def test_admin_remittance_review_requires_finance_permission(client, seeded_finance):
    member = member_token(client)
    proof_file_id = upload_remittance_proof(client, member)
    submit = client.post(
        reverse("remittance-list"),
        {"amount": "45.00", "proof_file_id": proof_file_id},
        content_type="application/json",
        HTTP_AUTHORIZATION=f"Bearer {member}",
    )
    remittance_id = submit.json()["data"]["id"]
    warehouse_admin = admin_token(client, email="warehouse@example.com")

    list_response = client.get(
        reverse("admin-remittance-list"),
        HTTP_AUTHORIZATION=f"Bearer {warehouse_admin}",
    )
    review_response = client.post(
        reverse("admin-remittance-approve", kwargs={"remittance_id": remittance_id}),
        {"review_remark": "try"},
        content_type="application/json",
        HTTP_AUTHORIZATION=f"Bearer {warehouse_admin}",
    )

    assert list_response.status_code == 403
    assert review_response.status_code == 403
    assert WalletTransaction.objects.filter(type=WalletTransactionType.OFFLINE_REMITTANCE).count() == 0


def test_admin_deduct_decreases_balance_and_blocks_overdraft(client, seeded_finance):
    user = User.objects.get(email="user@example.com")
    token = admin_token(client)
    client.post(
        reverse("admin-wallet-recharge", kwargs={"user_id": user.id}),
        {"amount": "80.00"},
        content_type="application/json",
        HTTP_AUTHORIZATION=f"Bearer {token}",
    )

    deduct_response = client.post(
        reverse("admin-wallet-deduct", kwargs={"user_id": user.id}),
        {"amount": "30.00", "remark": "manual adjustment"},
        content_type="application/json",
        HTTP_AUTHORIZATION=f"Bearer {token}",
    )
    assert deduct_response.status_code == 201
    assert deduct_response.json()["data"]["type"] == WalletTransactionType.ADMIN_DEDUCT
    assert deduct_response.json()["data"]["balance_after"] == "50.00"

    overdraft = client.post(
        reverse("admin-wallet-deduct", kwargs={"user_id": user.id}),
        {"amount": "60.00"},
        content_type="application/json",
        HTTP_AUTHORIZATION=f"Bearer {token}",
    )
    assert overdraft.status_code == 409
    assert overdraft.json()["code"] == "INSUFFICIENT_BALANCE"
    assert Wallet.objects.get(user=user).balance == Decimal("50.00")


def test_wallet_payment_deducts_once_and_advances_waybill(client, seeded_finance):
    user = User.objects.get(email="user@example.com")
    admin = admin_token(client)
    client.post(
        reverse("admin-wallet-recharge", kwargs={"user_id": user.id}),
        {"amount": "100.00"},
        content_type="application/json",
        HTTP_AUTHORIZATION=f"Bearer {admin}",
    )
    waybill = payable_waybill()
    token = member_token(client)

    first = client.post(
        reverse("waybill-pay", kwargs={"waybill_id": waybill.id}),
        {"idempotency_key": "pay-fin-10001"},
        content_type="application/json",
        HTTP_AUTHORIZATION=f"Bearer {token}",
    )
    assert first.status_code == 200
    first_data = first.json()["data"]
    assert first_data["payment_order"]["status"] == PaymentOrderStatus.PAID
    assert first_data["wallet"]["balance"] == "74.20"
    assert first_data["waybill"]["status"] == WaybillStatus.PENDING_SHIPMENT
    assert first_data["already_paid"] is False

    second = client.post(
        reverse("waybill-pay", kwargs={"waybill_id": waybill.id}),
        {"idempotency_key": "pay-fin-10001"},
        content_type="application/json",
        HTTP_AUTHORIZATION=f"Bearer {token}",
    )
    assert second.status_code == 200
    second_data = second.json()["data"]
    assert second_data["already_paid"] is True
    assert second_data["wallet"]["balance"] == "74.20"
    assert second_data["payment_order"]["id"] == first_data["payment_order"]["id"]
    assert WalletTransaction.objects.filter(type=WalletTransactionType.WAYBILL_PAYMENT).count() == 1


def test_wallet_payment_requires_sufficient_balance(client, seeded_finance):
    waybill = payable_waybill("FIN10002")
    token = member_token(client)

    response = client.post(
        reverse("waybill-pay", kwargs={"waybill_id": waybill.id}),
        {"idempotency_key": "pay-fin-insufficient"},
        content_type="application/json",
        HTTP_AUTHORIZATION=f"Bearer {token}",
    )

    assert response.status_code == 409
    assert response.json()["code"] == "INSUFFICIENT_BALANCE"
    waybill.refresh_from_db()
    assert waybill.status == WaybillStatus.PENDING_PAYMENT
    assert PaymentOrder.objects.count() == 0


def test_admin_finance_lists_require_permission(client, seeded_finance):
    response = client.get(
        reverse("admin-wallet-transaction-list"),
        HTTP_AUTHORIZATION=f"Bearer {admin_token(client, email='warehouse@example.com')}",
    )

    assert response.status_code == 403
    assert response.json()["code"] == "FORBIDDEN"


def test_finance_viewer_without_manage_cannot_write(client, seeded_finance):
    user = User.objects.get(email="user@example.com")
    create_admin_with_permissions("finance-viewer@example.com", ["dashboard.view", "finance.view"])
    token = admin_token(client, email="finance-viewer@example.com")

    list_response = client.get(reverse("admin-remittance-list"), HTTP_AUTHORIZATION=f"Bearer {token}")
    recharge_response = client.post(
        reverse("admin-wallet-recharge", kwargs={"user_id": user.id}),
        {"amount": "10.00", "remark": "view only"},
        content_type="application/json",
        HTTP_AUTHORIZATION=f"Bearer {token}",
    )
    supplier_response = client.post(
        reverse("admin-supplier-list"),
        {"code": "view-only", "name": "只读供应商"},
        content_type="application/json",
        HTTP_AUTHORIZATION=f"Bearer {token}",
    )

    assert list_response.status_code == 200
    assert recharge_response.status_code == 403
    assert supplier_response.status_code == 403
    assert Wallet.objects.filter(user=user).exists() is False
    assert not Supplier.objects.filter(code="VIEW-ONLY").exists()


def test_admin_payment_order_list(client, seeded_finance):
    user = User.objects.get(email="user@example.com")
    admin = admin_token(client)
    client.post(
        reverse("admin-wallet-recharge", kwargs={"user_id": user.id}),
        {"amount": "100.00"},
        content_type="application/json",
        HTTP_AUTHORIZATION=f"Bearer {admin}",
    )
    waybill = payable_waybill("FIN10003")
    client.post(
        reverse("waybill-pay", kwargs={"waybill_id": waybill.id}),
        {"idempotency_key": "pay-fin-list"},
        content_type="application/json",
        HTTP_AUTHORIZATION=f"Bearer {member_token(client)}",
    )

    response = client.get(reverse("admin-payment-order-list"), HTTP_AUTHORIZATION=f"Bearer {admin}")

    assert response.status_code == 200
    items = response.json()["data"]["items"]
    assert len(items) == 1
    assert items[0]["business_id"] == waybill.id
    assert items[0]["status"] == PaymentOrderStatus.PAID


def test_admin_supplier_cost_type_and_payable_lifecycle(client, seeded_finance):
    token = admin_token(client)
    supplier_response = client.post(
        reverse("admin-supplier-list"),
        {
            "code": "sf-express",
            "name": "顺丰测试供应商",
            "contact_name": "张三",
            "phone": "13800001111",
            "email": "supplier@example.com",
            "bank_account": "TODO_CONFIRM: demo bank account",
        },
        content_type="application/json",
        HTTP_AUTHORIZATION=f"Bearer {token}",
    )
    assert supplier_response.status_code == 201
    supplier = supplier_response.json()["data"]
    assert supplier["code"] == "SF-EXPRESS"
    assert supplier["status"] == SupplierStatus.ACTIVE

    cost_type_response = client.post(
        reverse("admin-cost-type-list"),
        {"code": "international-freight", "name": "国际运费", "category": "LOGISTICS"},
        content_type="application/json",
        HTTP_AUTHORIZATION=f"Bearer {token}",
    )
    assert cost_type_response.status_code == 201
    cost_type = cost_type_response.json()["data"]
    assert cost_type["code"] == "INTERNATIONAL-FREIGHT"
    assert cost_type["status"] == CostTypeStatus.ACTIVE

    payable_response = client.post(
        reverse("admin-payable-list"),
        {
            "supplier_id": supplier["id"],
            "cost_type_id": cost_type["id"],
            "amount": "123.45",
            "currency": "CNY",
            "source_type": "WAYBILL_BATCH",
            "source_id": 1,
            "description": "批次国际运费",
            "due_date": "2026-05-31",
        },
        content_type="application/json",
        HTTP_AUTHORIZATION=f"Bearer {token}",
    )
    assert payable_response.status_code == 201
    payable = payable_response.json()["data"]
    assert payable["payable_no"].startswith("AP")
    assert payable["supplier_name"] == "顺丰测试供应商"
    assert payable["cost_type_name"] == "国际运费"
    assert payable["status"] == PayableStatus.PENDING_REVIEW
    assert payable["amount"] == "123.45"
    assert payable["due_date"] == "2026-05-31"

    confirm_response = client.post(
        reverse("admin-payable-confirm", kwargs={"payable_id": payable["id"]}),
        {},
        content_type="application/json",
        HTTP_AUTHORIZATION=f"Bearer {token}",
    )
    assert confirm_response.status_code == 200
    assert confirm_response.json()["data"]["status"] == PayableStatus.CONFIRMED
    assert confirm_response.json()["data"]["confirmed_by_name"] == "财务人员"

    settle_response = client.post(
        reverse("admin-payable-settle", kwargs={"payable_id": payable["id"]}),
        {"settlement_reference": "BANK-AP-001", "settlement_note": "人工核销"},
        content_type="application/json",
        HTTP_AUTHORIZATION=f"Bearer {token}",
    )
    assert settle_response.status_code == 200
    settled = settle_response.json()["data"]
    assert settled["status"] == PayableStatus.SETTLED
    assert settled["settlement_reference"] == "BANK-AP-001"
    assert settled["settled_by_name"] == "财务人员"
    assert Payable.objects.get(id=payable["id"]).amount == Decimal("123.45")
    assert WalletTransaction.objects.count() == 0


def test_payable_settle_rejects_repeat_and_unconfirmed(client, seeded_finance):
    token = admin_token(client)
    supplier = Supplier.objects.create(code="SUP-REPEAT", name="重复核销供应商")
    cost_type = CostType.objects.create(code="COST-REPEAT", name="重复核销成本")
    pending = client.post(
        reverse("admin-payable-list"),
        {"supplier_id": supplier.id, "cost_type_id": cost_type.id, "amount": "10.00"},
        content_type="application/json",
        HTTP_AUTHORIZATION=f"Bearer {token}",
    ).json()["data"]

    settle_pending = client.post(
        reverse("admin-payable-settle", kwargs={"payable_id": pending["id"]}),
        {"settlement_reference": "BANK-PENDING"},
        content_type="application/json",
        HTTP_AUTHORIZATION=f"Bearer {token}",
    )
    assert settle_pending.status_code == 409
    assert settle_pending.json()["code"] == "STATE_CONFLICT"

    client.post(
        reverse("admin-payable-confirm", kwargs={"payable_id": pending["id"]}),
        {},
        content_type="application/json",
        HTTP_AUTHORIZATION=f"Bearer {token}",
    )
    first_settle = client.post(
        reverse("admin-payable-settle", kwargs={"payable_id": pending["id"]}),
        {"settlement_reference": "BANK-ONCE"},
        content_type="application/json",
        HTTP_AUTHORIZATION=f"Bearer {token}",
    )
    repeat_settle = client.post(
        reverse("admin-payable-settle", kwargs={"payable_id": pending["id"]}),
        {"settlement_reference": "BANK-TWICE"},
        content_type="application/json",
        HTTP_AUTHORIZATION=f"Bearer {token}",
    )

    assert first_settle.status_code == 200
    assert repeat_settle.status_code == 409
    assert repeat_settle.json()["code"] == "STATE_CONFLICT"
    assert Payable.objects.get(id=pending["id"]).settlement_reference == "BANK-ONCE"


def test_payable_blocks_disabled_master_data_and_requires_finance_permission(client, seeded_finance):
    finance_token = admin_token(client)
    warehouse_token = admin_token(client, email="warehouse@example.com")
    disabled_supplier = Supplier.objects.create(
        code="SUP-DISABLED",
        name="停用供应商",
        status=SupplierStatus.DISABLED,
    )
    disabled_cost_type = CostType.objects.create(
        code="COST-DISABLED",
        name="停用成本",
        status=CostTypeStatus.DISABLED,
    )
    active_supplier = Supplier.objects.create(code="SUP-ACTIVE", name="启用供应商")
    active_cost_type = CostType.objects.create(code="COST-ACTIVE", name="启用成本")

    no_permission = client.get(reverse("admin-payable-list"), HTTP_AUTHORIZATION=f"Bearer {warehouse_token}")
    assert no_permission.status_code == 403

    blocked_supplier = client.post(
        reverse("admin-payable-list"),
        {"supplier_id": disabled_supplier.id, "cost_type_id": active_cost_type.id, "amount": "20.00"},
        content_type="application/json",
        HTTP_AUTHORIZATION=f"Bearer {finance_token}",
    )
    blocked_cost_type = client.post(
        reverse("admin-payable-list"),
        {"supplier_id": active_supplier.id, "cost_type_id": disabled_cost_type.id, "amount": "20.00"},
        content_type="application/json",
        HTTP_AUTHORIZATION=f"Bearer {finance_token}",
    )

    assert blocked_supplier.status_code == 400
    assert blocked_supplier.json()["code"] == "VALIDATION_ERROR"
    assert blocked_cost_type.status_code == 400
    assert blocked_cost_type.json()["code"] == "VALIDATION_ERROR"
