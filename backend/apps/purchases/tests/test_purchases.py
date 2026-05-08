from decimal import Decimal

import pytest
from django.urls import reverse

from apps.finance.models import PaymentOrder, PaymentOrderStatus, Wallet, WalletTransaction, WalletTransactionType
from apps.finance.services import admin_recharge
from apps.iam.models import AdminUser
from apps.iam.services import seed_iam_demo_data
from apps.members.models import User
from apps.members.services import seed_member_demo_data
from apps.parcels.models import InboundRecord, Parcel, ParcelStatus
from apps.products.models import CartItem, CatalogStatus, ProductSku
from apps.products.services import seed_product_demo_data
from apps.purchases.models import ProcurementTask, ProcurementTaskStatus, PurchaseOrder, PurchaseOrderStatus
from apps.purchases.services import (
    create_manual_purchase_order,
    mark_purchase_order_arrived,
    procure_purchase_order,
    review_purchase_order,
)
from apps.warehouses.models import ShippingChannel, Warehouse
from apps.warehouses.services import seed_warehouse_demo_data
from apps.waybills.models import WaybillStatus
from apps.waybills.services import create_waybill


@pytest.fixture
def seeded_purchases(db):
    seed_iam_demo_data()
    seed_member_demo_data()
    seed_warehouse_demo_data()
    seed_product_demo_data()


def member_token(client, email="user@example.com", password="password123"):
    response = client.post(
        reverse("member-login"),
        {"email": email, "password": password},
        content_type="application/json",
    )
    return response.json()["data"]["access_token"]


def admin_token(client, email="buyer@example.com"):
    response = client.post(
        reverse("admin-login"),
        {"email": email, "password": "password123"},
        content_type="application/json",
    )
    return response.json()["data"]["access_token"]


def manual_payload():
    return {
        "items": [
            {
                "name": "手工代购测试商品",
                "quantity": 2,
                "unit_price": "12.50",
                "product_url": "https://example.com/item/1001",
                "remark": "蓝色",
            }
        ],
        "service_fee": "3.00",
    }


def manual_service_payload():
    return {
        "items": [
            {
                "name": "手工代购测试商品",
                "quantity": 2,
                "unit_price": Decimal("12.50"),
                "product_url": "https://example.com/item/1001",
                "remark": "蓝色",
            }
        ],
        "service_fee": Decimal("3.00"),
    }


def create_paid_purchase_order():
    user = User.objects.get(email="user@example.com")
    finance_operator = AdminUser.objects.get(email="finance@example.com")
    order = create_manual_purchase_order(user=user, **manual_service_payload())
    admin_recharge(user=user, operator=finance_operator, amount=Decimal("100.00"))
    return order


def test_manual_purchase_order_create_and_list_detail(client, seeded_purchases):
    token = member_token(client)

    response = client.post(
        reverse("purchase-order-manual"),
        manual_payload(),
        content_type="application/json",
        HTTP_AUTHORIZATION=f"Bearer {token}",
    )

    assert response.status_code == 201
    data = response.json()["data"]
    assert data["order_no"].startswith("PO")
    assert data["status"] == PurchaseOrderStatus.PENDING_PAYMENT
    assert data["source_type"] == "MANUAL"
    assert data["total_amount"] == "28.00"
    assert data["items"][0]["name"] == "手工代购测试商品"

    list_response = client.get(reverse("purchase-order-list"), HTTP_AUTHORIZATION=f"Bearer {token}")
    assert list_response.status_code == 200
    assert list_response.json()["data"]["items"][0]["id"] == data["id"]

    detail_response = client.get(
        reverse("purchase-order-detail", kwargs={"purchase_order_id": data["id"]}),
        HTTP_AUTHORIZATION=f"Bearer {token}",
    )
    assert detail_response.status_code == 200
    assert detail_response.json()["data"]["id"] == data["id"]


def test_product_purchase_order_from_cart_clears_selected_cart_items(client, seeded_purchases):
    user = User.objects.get(email="user@example.com")
    sku = ProductSku.objects.select_related("product").filter(status=CatalogStatus.ACTIVE).first()
    cart_item = CartItem.objects.create(user=user, product=sku.product, sku=sku, quantity=2)
    token = member_token(client)

    response = client.post(
        reverse("purchase-order-list"),
        {"cart_item_ids": [cart_item.id], "service_fee": "1.00"},
        content_type="application/json",
        HTTP_AUTHORIZATION=f"Bearer {token}",
    )

    assert response.status_code == 201
    data = response.json()["data"]
    assert data["source_type"] == "PRODUCT"
    assert data["status"] == PurchaseOrderStatus.PENDING_PAYMENT
    assert data["items"][0]["sku"] == sku.id
    assert CartItem.objects.filter(id=cart_item.id).exists() is False


def test_purchase_wallet_payment_deducts_once_and_advances_to_review(client, seeded_purchases):
    order = create_paid_purchase_order()
    token = member_token(client)

    first = client.post(
        reverse("purchase-order-pay", kwargs={"purchase_order_id": order.id}),
        {"idempotency_key": "pay-purchase-10001"},
        content_type="application/json",
        HTTP_AUTHORIZATION=f"Bearer {token}",
    )
    assert first.status_code == 200
    first_data = first.json()["data"]
    assert first_data["payment_order"]["status"] == PaymentOrderStatus.PAID
    assert first_data["wallet"]["balance"] == "72.00"
    assert first_data["purchase_order"]["status"] == PurchaseOrderStatus.PENDING_REVIEW
    assert first_data["already_paid"] is False

    second = client.post(
        reverse("purchase-order-pay", kwargs={"purchase_order_id": order.id}),
        {"idempotency_key": "pay-purchase-10001"},
        content_type="application/json",
        HTTP_AUTHORIZATION=f"Bearer {token}",
    )
    assert second.status_code == 200
    assert second.json()["data"]["already_paid"] is True
    assert second.json()["data"]["wallet"]["balance"] == "72.00"
    assert WalletTransaction.objects.filter(type=WalletTransactionType.PURCHASE_PAYMENT).count() == 1


def test_purchase_wallet_payment_requires_sufficient_balance(client, seeded_purchases):
    user = User.objects.get(email="user@example.com")
    order = create_manual_purchase_order(user=user, **manual_service_payload())
    token = member_token(client)

    response = client.post(
        reverse("purchase-order-pay", kwargs={"purchase_order_id": order.id}),
        {"idempotency_key": "pay-purchase-insufficient"},
        content_type="application/json",
        HTTP_AUTHORIZATION=f"Bearer {token}",
    )

    assert response.status_code == 409
    assert response.json()["code"] == "INSUFFICIENT_BALANCE"
    assert PaymentOrder.objects.count() == 0
    assert Wallet.objects.filter(user=user).exists() is False
    order.refresh_from_db()
    assert order.status == PurchaseOrderStatus.PENDING_PAYMENT


def test_admin_review_procure_arrive_convert_to_parcel_and_waybill(client, seeded_purchases):
    order = create_paid_purchase_order()
    pay_response = client.post(
        reverse("purchase-order-pay", kwargs={"purchase_order_id": order.id}),
        {"idempotency_key": "pay-purchase-flow"},
        content_type="application/json",
        HTTP_AUTHORIZATION=f"Bearer {member_token(client)}",
    )
    order_id = pay_response.json()["data"]["purchase_order"]["id"]
    token = admin_token(client)

    review_response = client.post(
        reverse("admin-purchase-order-review", kwargs={"purchase_order_id": order_id}),
        {"review_remark": "信息通过"},
        content_type="application/json",
        HTTP_AUTHORIZATION=f"Bearer {token}",
    )
    assert review_response.status_code == 200
    assert review_response.json()["data"]["status"] == PurchaseOrderStatus.PENDING_PROCUREMENT

    procure_response = client.post(
        reverse("admin-purchase-order-procure", kwargs={"purchase_order_id": order_id}),
        {
            "purchase_amount": "25.00",
            "external_order_no": "TB10001",
            "tracking_no": "PURCHASETRACK10001",
            "remark": "已下单",
        },
        content_type="application/json",
        HTTP_AUTHORIZATION=f"Bearer {token}",
    )
    assert procure_response.status_code == 200
    assert procure_response.json()["data"]["status"] == PurchaseOrderStatus.PROCURED
    task = ProcurementTask.objects.get(purchase_order_id=order_id)
    assert task.status == ProcurementTaskStatus.PROCURED

    arrived_response = client.post(
        reverse("admin-purchase-order-mark-arrived", kwargs={"purchase_order_id": order_id}),
        {"remark": "已到仓"},
        content_type="application/json",
        HTTP_AUTHORIZATION=f"Bearer {token}",
    )
    assert arrived_response.status_code == 200
    assert arrived_response.json()["data"]["status"] == PurchaseOrderStatus.ARRIVED

    warehouse = Warehouse.objects.get(code="SZ")
    convert_response = client.post(
        reverse("admin-purchase-order-convert-to-parcel", kwargs={"purchase_order_id": order_id}),
        {"warehouse_id": warehouse.id, "weight_kg": "1.200", "remark": "转包裹"},
        content_type="application/json",
        HTTP_AUTHORIZATION=f"Bearer {token}",
    )
    assert convert_response.status_code == 200
    converted = convert_response.json()["data"]
    assert converted["status"] == PurchaseOrderStatus.COMPLETED
    assert converted["converted_parcel"]["status"] == ParcelStatus.IN_STOCK

    parcel = Parcel.objects.get(id=converted["converted_parcel"]["id"])
    assert parcel.status == ParcelStatus.IN_STOCK
    assert parcel.user.email == "user@example.com"
    assert parcel.items.first().name == "手工代购测试商品"
    assert InboundRecord.objects.filter(parcel=parcel).exists()

    waybill = create_waybill(
        user=parcel.user,
        parcel_ids=[parcel.id],
        channel=ShippingChannel.objects.get(code="TEST_AIR"),
        destination_country="US",
        recipient_snapshot={
            "name": "Purchase Receiver",
            "phone": "15500000000",
            "address": "100 Purchase Street",
            "postal_code": "90001",
        },
    )
    assert waybill.status == WaybillStatus.PENDING_REVIEW
    parcel.refresh_from_db()
    assert parcel.status == ParcelStatus.PACKING_REQUESTED


def test_purchase_illegal_state_transitions_return_state_conflict(client, seeded_purchases):
    order = create_paid_purchase_order()
    token = admin_token(client)

    procure_before_payment = client.post(
        reverse("admin-purchase-order-procure", kwargs={"purchase_order_id": order.id}),
        {"purchase_amount": "25.00"},
        content_type="application/json",
        HTTP_AUTHORIZATION=f"Bearer {token}",
    )
    assert procure_before_payment.status_code == 409
    assert procure_before_payment.json()["code"] == "STATE_CONFLICT"

    client.post(
        reverse("purchase-order-pay", kwargs={"purchase_order_id": order.id}),
        {"idempotency_key": "pay-purchase-conflict"},
        content_type="application/json",
        HTTP_AUTHORIZATION=f"Bearer {member_token(client)}",
    )
    first_review = client.post(
        reverse("admin-purchase-order-review", kwargs={"purchase_order_id": order.id}),
        {},
        content_type="application/json",
        HTTP_AUTHORIZATION=f"Bearer {token}",
    )
    second_review = client.post(
        reverse("admin-purchase-order-review", kwargs={"purchase_order_id": order.id}),
        {},
        content_type="application/json",
        HTTP_AUTHORIZATION=f"Bearer {token}",
    )
    assert first_review.status_code == 200
    assert second_review.status_code == 409
    assert second_review.json()["code"] == "STATE_CONFLICT"


def test_admin_purchase_list_requires_permission(client, seeded_purchases):
    response = client.get(
        reverse("admin-purchase-order-list"),
        HTTP_AUTHORIZATION=f"Bearer {admin_token(client, email='finance@example.com')}",
    )

    assert response.status_code == 403
    assert response.json()["code"] == "FORBIDDEN"


def test_purchase_warehouse_options_require_purchase_permission(client, seeded_purchases):
    allowed = client.get(
        reverse("admin-purchase-warehouse-options"),
        HTTP_AUTHORIZATION=f"Bearer {admin_token(client)}",
    )
    assert allowed.status_code == 200
    assert allowed.json()["data"]["items"][0]["code"] == "SZ"

    denied = client.get(
        reverse("admin-purchase-warehouse-options"),
        HTTP_AUTHORIZATION=f"Bearer {admin_token(client, email='finance@example.com')}",
    )
    assert denied.status_code == 403


def test_admin_can_mark_exception_and_cancel_purchase_order(client, seeded_purchases):
    order = create_paid_purchase_order()
    client.post(
        reverse("purchase-order-pay", kwargs={"purchase_order_id": order.id}),
        {"idempotency_key": "pay-purchase-exception"},
        content_type="application/json",
        HTTP_AUTHORIZATION=f"Bearer {member_token(client)}",
    )
    token = admin_token(client)

    exception_response = client.post(
        reverse("admin-purchase-order-mark-exception", kwargs={"purchase_order_id": order.id}),
        {"remark": "链接失效"},
        content_type="application/json",
        HTTP_AUTHORIZATION=f"Bearer {token}",
    )
    assert exception_response.status_code == 200
    assert exception_response.json()["data"]["status"] == PurchaseOrderStatus.EXCEPTION

    cancel_response = client.post(
        reverse("admin-purchase-order-cancel", kwargs={"purchase_order_id": order.id}),
        {"reason": "用户取消"},
        content_type="application/json",
        HTTP_AUTHORIZATION=f"Bearer {token}",
    )
    assert cancel_response.status_code == 200
    assert cancel_response.json()["data"]["status"] == PurchaseOrderStatus.CANCELLED
