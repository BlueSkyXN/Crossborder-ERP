from decimal import Decimal

import pytest
from django.urls import reverse

from apps.addresses.services import create_address, update_address
from apps.finance.services import admin_recharge, pay_with_wallet
from apps.iam.models import AdminUser
from apps.iam.services import seed_iam_demo_data
from apps.members.models import User
from apps.members.services import register_user, seed_member_demo_data
from apps.parcels.models import Parcel, ParcelStatus
from apps.parcels.services import forecast_parcel, inbound_parcel
from apps.warehouses.models import ShippingChannel, Warehouse
from apps.warehouses.services import seed_warehouse_demo_data
from apps.waybills.models import ShippingBatchStatus, TrackingEvent, Waybill, WaybillStatus
from apps.waybills.services import cancel_waybill, create_waybill, review_waybill, set_waybill_fee


@pytest.fixture
def seeded_waybills(db):
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


def admin_token(client, email="warehouse@example.com"):
    response = client.post(
        reverse("admin-login"),
        {"email": email, "password": "password123"},
        content_type="application/json",
    )
    return response.json()["data"]["access_token"]


def create_in_stock_parcel(tracking_no="WB10001", warehouse_code="SZ"):
    user = User.objects.get(email="user@example.com")
    warehouse = Warehouse.objects.get(code=warehouse_code)
    parcel = forecast_parcel(user=user, warehouse=warehouse, tracking_no=tracking_no)
    return inbound_parcel(parcel=parcel, operator=None, weight_kg=Decimal("1.250"))


def create_paid_waybill(tracking_no="WBPAID10001", warehouse_code="SZ", channel_code="TEST_AIR"):
    user = User.objects.get(email="user@example.com")
    operator = AdminUser.objects.get(email="warehouse@example.com")
    finance_operator = AdminUser.objects.get(email="finance@example.com")
    parcel = create_in_stock_parcel(tracking_no, warehouse_code=warehouse_code)
    waybill = create_waybill(
        user=user,
        parcel_ids=[parcel.id],
        channel=ShippingChannel.objects.get(code=channel_code),
        destination_country="US",
        recipient_snapshot={
            "name": "Tracking Receiver",
            "phone": "15500000000",
            "address": "100 Tracking Street",
            "postal_code": "90001",
        },
    )
    reviewed = review_waybill(waybill=waybill, operator=operator)
    fee_set = set_waybill_fee(waybill=reviewed, operator=operator, fee_total=Decimal("18.00"))
    admin_recharge(user=user, operator=finance_operator, amount=Decimal("50.00"))
    result = pay_with_wallet(waybill=fee_set, user=user, idempotency_key=f"pay-{tracking_no}")
    return result.waybill


def waybill_payload(parcel_id: int):
    return {
        "parcel_ids": [parcel_id],
        "channel_id": ShippingChannel.objects.get(code="TEST_AIR").id,
        "destination_country": "US",
        "recipient_name": "Test Receiver",
        "recipient_phone": "15500000000",
        "recipient_address": "100 Test Street, Los Angeles, CA",
        "postal_code": "90001",
        "remark": "BE-006 test waybill",
    }


def test_member_create_waybill_moves_parcel_to_packing_requested(client, seeded_waybills):
    parcel = create_in_stock_parcel()
    token = member_token(client)

    response = client.post(
        reverse("waybill-list"),
        waybill_payload(parcel.id),
        content_type="application/json",
        HTTP_AUTHORIZATION=f"Bearer {token}",
    )

    assert response.status_code == 201
    body = response.json()
    assert body["code"] == "OK"
    data = body["data"]
    assert data["waybill_no"].startswith("W")
    assert data["status"] == WaybillStatus.PENDING_REVIEW
    assert data["destination_country"] == "US"
    assert data["recipient_snapshot"]["name"] == "Test Receiver"
    assert data["parcels"][0]["parcel_no"] == parcel.parcel_no

    parcel.refresh_from_db()
    assert parcel.status == ParcelStatus.PACKING_REQUESTED

    list_response = client.get(reverse("waybill-list"), HTTP_AUTHORIZATION=f"Bearer {token}")
    assert list_response.status_code == 200
    assert list_response.json()["data"]["items"][0]["id"] == data["id"]

    detail_response = client.get(
        reverse("waybill-detail", kwargs={"waybill_id": data["id"]}),
        HTTP_AUTHORIZATION=f"Bearer {token}",
    )
    assert detail_response.status_code == 200
    assert detail_response.json()["data"]["id"] == data["id"]


def test_member_create_waybill_from_address_keeps_recipient_snapshot(client, seeded_waybills):
    user = User.objects.get(email="user@example.com")
    address = create_address(
        user=user,
        recipient_name="Snapshot Receiver",
        phone="15500001111",
        country="US",
        region="CA",
        city="Los Angeles",
        address_line="300 Snapshot Street",
        postal_code="90003",
        company="Snapshot Inc",
        is_default=True,
    )
    parcel = create_in_stock_parcel("WBADDR10001")
    token = member_token(client)

    response = client.post(
        reverse("waybill-list"),
        {
            "parcel_ids": [parcel.id],
            "channel_id": ShippingChannel.objects.get(code="TEST_AIR").id,
            "address_id": address.id,
            "remark": "ADDR-001 address waybill",
        },
        content_type="application/json",
        HTTP_AUTHORIZATION=f"Bearer {token}",
    )

    assert response.status_code == 201
    waybill_data = response.json()["data"]
    assert waybill_data["destination_country"] == "US"
    assert waybill_data["recipient_snapshot"]["address_id"] == address.id
    assert waybill_data["recipient_snapshot"]["name"] == "Snapshot Receiver"
    assert waybill_data["recipient_snapshot"]["address"] == "300 Snapshot Street"
    assert waybill_data["recipient_snapshot"]["region"] == "CA Los Angeles"
    assert waybill_data["recipient_snapshot"]["company"] == "Snapshot Inc"

    update_address(
        address=address,
        recipient_name="Changed Receiver",
        phone="15500002222",
        country="US",
        region="NY",
        city="New York",
        address_line="900 Changed Avenue",
        postal_code="10001",
        company="Changed Inc",
        is_default=True,
    )

    detail_response = client.get(
        reverse("waybill-detail", kwargs={"waybill_id": waybill_data["id"]}),
        HTTP_AUTHORIZATION=f"Bearer {token}",
    )
    snapshot = detail_response.json()["data"]["recipient_snapshot"]
    assert snapshot["name"] == "Snapshot Receiver"
    assert snapshot["address"] == "300 Snapshot Street"
    assert snapshot["company"] == "Snapshot Inc"


def test_non_in_stock_parcel_cannot_create_waybill(client, seeded_waybills):
    user = User.objects.get(email="user@example.com")
    warehouse = Warehouse.objects.get(code="SZ")
    parcel = forecast_parcel(user=user, warehouse=warehouse, tracking_no="WB10002")
    token = member_token(client)

    response = client.post(
        reverse("waybill-list"),
        waybill_payload(parcel.id),
        content_type="application/json",
        HTTP_AUTHORIZATION=f"Bearer {token}",
    )

    assert response.status_code == 409
    assert response.json()["code"] == "STATE_CONFLICT"


def test_admin_review_and_set_fee_moves_waybill_to_pending_payment(client, seeded_waybills):
    parcel = create_in_stock_parcel("WB10003")
    user_token = member_token(client)
    create_response = client.post(
        reverse("waybill-list"),
        waybill_payload(parcel.id),
        content_type="application/json",
        HTTP_AUTHORIZATION=f"Bearer {user_token}",
    )
    waybill_id = create_response.json()["data"]["id"]
    token = admin_token(client)

    review_response = client.post(
        reverse("admin-waybill-review", kwargs={"waybill_id": waybill_id}),
        {"review_remark": "包裹信息通过"},
        content_type="application/json",
        HTTP_AUTHORIZATION=f"Bearer {token}",
    )
    assert review_response.status_code == 200
    assert review_response.json()["data"]["status"] == WaybillStatus.PENDING_PACKING

    fee_response = client.post(
        reverse("admin-waybill-set-fee", kwargs={"waybill_id": waybill_id}),
        {
            "fee_total": "25.80",
            "fee_detail_json": {"freight": "22.80", "packing": "3.00"},
            "fee_remark": "测试计费",
        },
        content_type="application/json",
        HTTP_AUTHORIZATION=f"Bearer {token}",
    )

    assert fee_response.status_code == 200
    data = fee_response.json()["data"]
    assert data["user"] == User.objects.get(email="user@example.com").id
    assert data["status"] == WaybillStatus.PENDING_PAYMENT
    assert data["fee_total"] == "25.80"
    assert data["fee_detail_json"]["freight"] == "22.80"


def test_illegal_waybill_state_transitions_return_state_conflict(client, seeded_waybills):
    parcel = create_in_stock_parcel("WB10004")
    user_token = member_token(client)
    create_response = client.post(
        reverse("waybill-list"),
        waybill_payload(parcel.id),
        content_type="application/json",
        HTTP_AUTHORIZATION=f"Bearer {user_token}",
    )
    waybill_id = create_response.json()["data"]["id"]
    token = admin_token(client)

    fee_before_review = client.post(
        reverse("admin-waybill-set-fee", kwargs={"waybill_id": waybill_id}),
        {"fee_total": "10.00"},
        content_type="application/json",
        HTTP_AUTHORIZATION=f"Bearer {token}",
    )
    assert fee_before_review.status_code == 409
    assert fee_before_review.json()["code"] == "STATE_CONFLICT"

    first_review = client.post(
        reverse("admin-waybill-review", kwargs={"waybill_id": waybill_id}),
        {},
        content_type="application/json",
        HTTP_AUTHORIZATION=f"Bearer {token}",
    )
    assert first_review.status_code == 200

    second_review = client.post(
        reverse("admin-waybill-review", kwargs={"waybill_id": waybill_id}),
        {},
        content_type="application/json",
        HTTP_AUTHORIZATION=f"Bearer {token}",
    )
    assert second_review.status_code == 409
    assert second_review.json()["code"] == "STATE_CONFLICT"


def test_admin_waybill_list_requires_permission(client, seeded_waybills):
    response = client.get(
        reverse("admin-waybill-list"),
        HTTP_AUTHORIZATION=f"Bearer {admin_token(client, email='finance@example.com')}",
    )

    assert response.status_code == 403
    assert response.json()["code"] == "FORBIDDEN"


def test_waybill_viewer_without_manage_cannot_review(client, seeded_waybills):
    parcel = create_in_stock_parcel("WB-VIEW-ONLY-001")
    waybill = create_waybill(
        user=User.objects.get(email="user@example.com"),
        parcel_ids=[parcel.id],
        channel=ShippingChannel.objects.get(code="TEST_AIR"),
        destination_country="US",
        recipient_snapshot={"name": "Viewer Receiver"},
    )
    token = admin_token(client, email="support@example.com")

    list_response = client.get(reverse("admin-waybill-list"), HTTP_AUTHORIZATION=f"Bearer {token}")
    review_response = client.post(
        reverse("admin-waybill-review", kwargs={"waybill_id": waybill.id}),
        {"review_remark": "view only"},
        content_type="application/json",
        HTTP_AUTHORIZATION=f"Bearer {token}",
    )

    assert list_response.status_code == 200
    assert review_response.status_code == 403
    waybill.refresh_from_db()
    assert waybill.status == WaybillStatus.PENDING_REVIEW


def test_cancel_waybill_restores_requested_parcels(seeded_waybills):
    parcel = create_in_stock_parcel("WB10005")
    user = User.objects.get(email="user@example.com")
    client_waybill = Waybill.objects.create(
        waybill_no="WTESTCANCEL",
        user=user,
        warehouse=parcel.warehouse,
        status=WaybillStatus.PENDING_REVIEW,
        destination_country="US",
        recipient_snapshot={"name": "Cancel Target"},
    )
    client_waybill.parcel_links.create(parcel=parcel)
    Parcel.objects.filter(id=parcel.id).update(status=ParcelStatus.PACKING_REQUESTED)

    cancelled = cancel_waybill(waybill=client_waybill, reason="用户取消")

    assert cancelled.status == WaybillStatus.CANCELLED
    parcel.refresh_from_db()
    assert parcel.status == ParcelStatus.IN_STOCK


def test_admin_ship_waybill_creates_tracking_and_marks_parcels_outbound(client, seeded_waybills):
    waybill = create_paid_waybill("WBTRACK10001")
    token = admin_token(client)

    response = client.post(
        reverse("admin-waybill-ship", kwargs={"waybill_id": waybill.id}),
        {
            "status_text": "已从仓库发出",
            "location": "深圳仓",
            "description": "人工发货验收",
        },
        content_type="application/json",
        HTTP_AUTHORIZATION=f"Bearer {token}",
    )

    assert response.status_code == 200
    data = response.json()["data"]
    assert data["status"] == WaybillStatus.SHIPPED
    assert data["tracking_events"][0]["status_text"] == "已从仓库发出"
    assert data["tracking_events"][0]["location"] == "深圳仓"
    assert TrackingEvent.objects.filter(waybill_id=waybill.id).count() == 1
    parcel = waybill.parcel_links.first().parcel
    parcel.refresh_from_db()
    assert parcel.status == ParcelStatus.OUTBOUND


def test_member_can_query_tracking_and_confirm_receipt(client, seeded_waybills):
    waybill = create_paid_waybill("WBTRACK10002")
    token = admin_token(client)
    client.post(
        reverse("admin-waybill-ship", kwargs={"waybill_id": waybill.id}),
        {"status_text": "已揽收", "location": "深圳"},
        content_type="application/json",
        HTTP_AUTHORIZATION=f"Bearer {token}",
    )
    member = member_token(client)

    list_response = client.get(
        reverse("waybill-tracking-event-list", kwargs={"waybill_id": waybill.id}),
        HTTP_AUTHORIZATION=f"Bearer {member}",
    )
    assert list_response.status_code == 200
    assert list_response.json()["data"]["items"][0]["status_text"] == "已揽收"

    query_response = client.get(
        f"{reverse('waybill-tracking-query')}?waybill_no={waybill.waybill_no}",
        HTTP_AUTHORIZATION=f"Bearer {member}",
    )
    assert query_response.status_code == 200
    assert query_response.json()["data"]["waybill"]["waybill_no"] == waybill.waybill_no

    receipt_response = client.post(
        reverse("waybill-confirm-receipt", kwargs={"waybill_id": waybill.id}),
        {"description": "用户确认收货"},
        content_type="application/json",
        HTTP_AUTHORIZATION=f"Bearer {member}",
    )
    assert receipt_response.status_code == 200
    assert receipt_response.json()["data"]["status"] == WaybillStatus.SIGNED
    assert [event.status_text for event in TrackingEvent.objects.filter(waybill=waybill)] == ["已揽收", "已签收"]


def test_tracking_query_does_not_expose_other_users_waybill(client, seeded_waybills):
    other_user = register_user("tracking-other@example.com", "password123")
    warehouse = Warehouse.objects.get(code="SZ")
    other_parcel = forecast_parcel(user=other_user, warehouse=warehouse, tracking_no="WBTRACKOTHER")
    inbound_parcel(parcel=other_parcel, operator=None, weight_kg=Decimal("1.000"))
    other_waybill = create_waybill(
        user=other_user,
        parcel_ids=[other_parcel.id],
        destination_country="US",
        recipient_snapshot={"name": "Other Receiver"},
    )

    response = client.get(
        f"{reverse('waybill-tracking-query')}?waybill_no={other_waybill.waybill_no}",
        HTTP_AUTHORIZATION=f"Bearer {member_token(client)}",
    )

    assert response.status_code == 404
    assert response.json()["code"] == "NOT_FOUND"


def test_ship_requires_pending_shipment(client, seeded_waybills):
    parcel = create_in_stock_parcel("WBTRACK10003")
    user_token = member_token(client)
    create_response = client.post(
        reverse("waybill-list"),
        waybill_payload(parcel.id),
        content_type="application/json",
        HTTP_AUTHORIZATION=f"Bearer {user_token}",
    )
    waybill_id = create_response.json()["data"]["id"]

    response = client.post(
        reverse("admin-waybill-ship", kwargs={"waybill_id": waybill_id}),
        {"status_text": "提前发货"},
        content_type="application/json",
        HTTP_AUTHORIZATION=f"Bearer {admin_token(client)}",
    )

    assert response.status_code == 409
    assert response.json()["code"] == "STATE_CONFLICT"


def test_admin_create_lock_and_ship_shipping_batch(client, seeded_waybills):
    first = create_paid_waybill("WBBATCH10001")
    second = create_paid_waybill("WBBATCH10002")
    token = admin_token(client)

    create_response = client.post(
        reverse("admin-shipping-batch-list"),
        {
            "name": "美国空运批次",
            "carrier_batch_no": "CA-BATCH-001",
            "transfer_no": "TR-BATCH-001",
            "ship_note": "SHIP-BATCH-001",
            "waybill_ids": [first.id, second.id],
        },
        content_type="application/json",
        HTTP_AUTHORIZATION=f"Bearer {token}",
    )

    assert create_response.status_code == 201
    batch_data = create_response.json()["data"]
    assert batch_data["batch_no"].startswith("SB")
    assert batch_data["status"] == ShippingBatchStatus.DRAFT
    assert batch_data["warehouse_name"] == "深圳仓"
    assert batch_data["channel_name"] == "测试空运"
    assert batch_data["waybill_count"] == 2
    assert {item["waybill_no"] for item in batch_data["waybills"]} == {first.waybill_no, second.waybill_no}

    first.refresh_from_db()
    assert first.shipping_batch_id == batch_data["id"]
    assert first.transfer_no == "TR-BATCH-001"

    lock_response = client.post(
        reverse("admin-shipping-batch-lock", kwargs={"batch_id": batch_data["id"]}),
        {},
        content_type="application/json",
        HTTP_AUTHORIZATION=f"Bearer {token}",
    )
    assert lock_response.status_code == 200
    assert lock_response.json()["data"]["status"] == ShippingBatchStatus.LOCKED

    ship_response = client.post(
        reverse("admin-shipping-batch-ship", kwargs={"batch_id": batch_data["id"]}),
        {"status_text": "批次已从深圳仓发出", "location": "深圳仓", "description": "批量发货"},
        content_type="application/json",
        HTTP_AUTHORIZATION=f"Bearer {token}",
    )
    assert ship_response.status_code == 200
    shipped_data = ship_response.json()["data"]
    assert shipped_data["status"] == ShippingBatchStatus.SHIPPED
    assert {item["status"] for item in shipped_data["waybills"]} == {WaybillStatus.SHIPPED}
    assert TrackingEvent.objects.filter(waybill_id__in=[first.id, second.id], status_text="批次已从深圳仓发出").count() == 2

    repeat_response = client.post(
        reverse("admin-shipping-batch-ship", kwargs={"batch_id": batch_data["id"]}),
        {"status_text": "批次已从深圳仓发出", "location": "深圳仓"},
        content_type="application/json",
        HTTP_AUTHORIZATION=f"Bearer {token}",
    )
    assert repeat_response.status_code == 200
    assert TrackingEvent.objects.filter(waybill_id__in=[first.id, second.id], status_text="批次已从深圳仓发出").count() == 2

    parcel_statuses = {
        link.parcel.status
        for waybill in Waybill.objects.filter(id__in=[first.id, second.id]).prefetch_related("parcel_links__parcel")
        for link in waybill.parcel_links.all()
    }
    assert parcel_statuses == {ParcelStatus.OUTBOUND}


def test_shipping_batch_rejects_non_pending_shipment_waybill(client, seeded_waybills):
    parcel = create_in_stock_parcel("WBBATCHBLOCKED")
    waybill = create_waybill(
        user=User.objects.get(email="user@example.com"),
        parcel_ids=[parcel.id],
        channel=ShippingChannel.objects.get(code="TEST_AIR"),
        destination_country="US",
        recipient_snapshot={"name": "Blocked Receiver"},
    )

    response = client.post(
        reverse("admin-shipping-batch-list"),
        {"name": "非法批次", "waybill_ids": [waybill.id]},
        content_type="application/json",
        HTTP_AUTHORIZATION=f"Bearer {admin_token(client)}",
    )

    assert response.status_code == 409
    assert response.json()["code"] == "STATE_CONFLICT"


def test_shipping_batch_rejects_mixed_warehouse_or_channel(client, seeded_waybills):
    first = create_paid_waybill("WBBATCHSCOPE1")
    other_warehouse = create_paid_waybill("WBBATCHSCOPE2", warehouse_code="BJ")
    other_channel = create_paid_waybill("WBBATCHSCOPE3", channel_code="TEST_SEA")
    token = admin_token(client)

    warehouse_response = client.post(
        reverse("admin-shipping-batch-list"),
        {"name": "混仓批次", "waybill_ids": [first.id, other_warehouse.id]},
        content_type="application/json",
        HTTP_AUTHORIZATION=f"Bearer {token}",
    )
    assert warehouse_response.status_code == 400
    assert warehouse_response.json()["code"] == "VALIDATION_ERROR"

    channel_response = client.post(
        reverse("admin-shipping-batch-list"),
        {"name": "混渠道批次", "waybill_ids": [first.id, other_channel.id]},
        content_type="application/json",
        HTTP_AUTHORIZATION=f"Bearer {token}",
    )
    assert channel_response.status_code == 400
    assert channel_response.json()["code"] == "VALIDATION_ERROR"


def test_admin_shipping_batch_waybill_adjustment_and_print_preview(client, seeded_waybills):
    first = create_paid_waybill("WBBATCHPRINT1")
    second = create_paid_waybill("WBBATCHPRINT2")
    token = admin_token(client)
    create_response = client.post(
        reverse("admin-shipping-batch-list"),
        {"name": "打印预览批次", "carrier_batch_no": "PRINT-001", "waybill_ids": [first.id]},
        content_type="application/json",
        HTTP_AUTHORIZATION=f"Bearer {token}",
    )
    batch_id = create_response.json()["data"]["id"]

    add_response = client.post(
        reverse("admin-shipping-batch-waybill-list", kwargs={"batch_id": batch_id}),
        {"waybill_ids": [second.id]},
        content_type="application/json",
        HTTP_AUTHORIZATION=f"Bearer {token}",
    )
    assert add_response.status_code == 200
    assert add_response.json()["data"]["waybill_count"] == 2

    remove_response = client.delete(
        reverse("admin-shipping-batch-waybill-detail", kwargs={"batch_id": batch_id, "waybill_id": second.id}),
        HTTP_AUTHORIZATION=f"Bearer {token}",
    )
    assert remove_response.status_code == 200
    assert remove_response.json()["data"]["waybill_count"] == 1

    preview_response = client.get(
        f"{reverse('admin-shipping-batch-print-preview', kwargs={'batch_id': batch_id})}?template=handover",
        HTTP_AUTHORIZATION=f"Bearer {token}",
    )
    assert preview_response.status_code == 200
    preview = preview_response.json()["data"]
    assert preview["template"] == "handover"
    assert preview["batch"]["batch_no"].startswith("SB")
    assert preview["batch"]["carrier_batch_no"] == "PRINT-001"
    assert preview["batch"]["channel_name"] == "测试空运"
    assert preview["batch"]["generated_at"]
    assert preview["batch"]["waybill_count"] == 1
    assert preview["items"][0]["waybill_no"] == first.waybill_no
    assert preview["items"][0]["recipient"]["name"] == "Tracking Receiver"


def test_admin_shipping_batch_bulk_tracking_requires_locked_or_shipped(client, seeded_waybills):
    waybill = create_paid_waybill("WBBATCHTRACK1")
    token = admin_token(client)
    create_response = client.post(
        reverse("admin-shipping-batch-list"),
        {"name": "批量轨迹批次", "waybill_ids": [waybill.id]},
        content_type="application/json",
        HTTP_AUTHORIZATION=f"Bearer {token}",
    )
    batch_id = create_response.json()["data"]["id"]

    draft_response = client.post(
        reverse("admin-shipping-batch-tracking-event-create", kwargs={"batch_id": batch_id}),
        {"status_text": "批量轨迹", "location": "深圳"},
        content_type="application/json",
        HTTP_AUTHORIZATION=f"Bearer {token}",
    )
    assert draft_response.status_code == 409

    client.post(
        reverse("admin-shipping-batch-lock", kwargs={"batch_id": batch_id}),
        {},
        content_type="application/json",
        HTTP_AUTHORIZATION=f"Bearer {token}",
    )
    tracking_response = client.post(
        reverse("admin-shipping-batch-tracking-event-create", kwargs={"batch_id": batch_id}),
        {"status_text": "已交接承运商", "location": "深圳"},
        content_type="application/json",
        HTTP_AUTHORIZATION=f"Bearer {token}",
    )
    assert tracking_response.status_code == 201
    assert tracking_response.json()["data"]["items"][0]["status_text"] == "已交接承运商"


def test_admin_shipping_batch_requires_waybill_permission(client, seeded_waybills):
    response = client.get(
        reverse("admin-shipping-batch-list"),
        HTTP_AUTHORIZATION=f"Bearer {admin_token(client, email='finance@example.com')}",
    )

    assert response.status_code == 403
    assert response.json()["code"] == "FORBIDDEN"
