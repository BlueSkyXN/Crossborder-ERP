from decimal import Decimal

import pytest
from django.urls import reverse

from apps.finance.models import (
    PaymentOrder,
    PaymentOrderStatus,
    Wallet,
    WalletTransaction,
    WalletTransactionType,
)
from apps.iam.models import AdminUser
from apps.iam.services import seed_iam_demo_data
from apps.members.models import User
from apps.members.services import seed_member_demo_data
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


def admin_token(client, email="finance@example.com"):
    response = client.post(
        reverse("admin-login"),
        {"email": email, "password": "password123"},
        content_type="application/json",
    )
    return response.json()["data"]["access_token"]


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
