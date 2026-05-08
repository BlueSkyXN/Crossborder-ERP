import pytest
from rest_framework.test import APIClient

from apps.iam.services import seed_iam_demo_data
from apps.members.services import seed_member_demo_data
from apps.products.services import seed_product_demo_data
from apps.warehouses.services import seed_warehouse_demo_data


ADMIN_EMAIL = "admin@example.com"
MEMBER_EMAIL = "user@example.com"
PASSWORD = "password123"


def _api_data(response, *, expected_status=200):
    try:
        body = response.json()
    except ValueError:
        body = {"raw": response.content.decode("utf-8", errors="replace")}
    assert response.status_code == expected_status, body
    assert body["code"] == "OK", body
    return body["data"]


def _authorized_client(token: str) -> APIClient:
    client = APIClient()
    client.credentials(HTTP_AUTHORIZATION=f"Bearer {token}")
    return client


def _seed_demo_data():
    seed_iam_demo_data()
    seed_member_demo_data()
    seed_warehouse_demo_data()
    seed_product_demo_data()


def _login_admin() -> tuple[APIClient, dict]:
    client = APIClient()
    data = _api_data(
        client.post(
            "/api/v1/admin/auth/login",
            {"email": ADMIN_EMAIL, "password": PASSWORD},
            format="json",
        )
    )
    return _authorized_client(data["access_token"]), data["admin_user"]


def _login_member() -> tuple[APIClient, dict]:
    client = APIClient()
    data = _api_data(
        client.post(
            "/api/v1/auth/login",
            {"email": MEMBER_EMAIL, "password": PASSWORD},
            format="json",
        )
    )
    return _authorized_client(data["access_token"]), data["user"]


def _first_by_code(items: list[dict], code: str) -> dict:
    for item in items:
        if item["code"] == code:
            return item
    raise AssertionError(f"missing demo config code: {code}")


def _confirm_demo_configs(admin_client: APIClient, member_client: APIClient, member: dict) -> tuple[dict, dict]:
    warehouses = _api_data(admin_client.get("/api/v1/admin/warehouses"))["items"]
    channels = _api_data(admin_client.get("/api/v1/admin/shipping-channels"))["items"]
    packaging_methods = _api_data(admin_client.get("/api/v1/admin/packaging-methods"))["items"]
    value_added_services = _api_data(admin_client.get("/api/v1/admin/value-added-services"))["items"]

    warehouse = _first_by_code(warehouses, "SZ")
    channel = _first_by_code(channels, "TEST_AIR")
    assert _first_by_code(packaging_methods, "CARTON")["status"] == "ACTIVE"
    assert _first_by_code(value_added_services, "REINFORCE")["status"] == "ACTIVE"

    public_warehouses = _api_data(member_client.get("/api/v1/warehouses"))["items"]
    assert any(item["id"] == warehouse["id"] for item in public_warehouses)
    address = _api_data(member_client.get(f"/api/v1/warehouses/{warehouse['id']}/address"))
    assert address["member_warehouse_code"] == member["profile"]["warehouse_code"]
    assert member["profile"]["warehouse_code"] in address["full_address"]

    return warehouse, channel


def _run_forwarding_flow(
    *,
    admin_client: APIClient,
    member_client: APIClient,
    member: dict,
    warehouse: dict,
    channel: dict,
    run_id: str,
    suffix: str,
) -> dict:
    tracking_no = f"E2E-{suffix}-{run_id}"
    parcel = _api_data(
        member_client.post(
            "/api/v1/parcels/forecast",
            {
                "warehouse_id": warehouse["id"],
                "tracking_no": tracking_no,
                "carrier": "E2E Express",
                "remark": f"E2E {suffix} forecast",
                "items": [
                    {
                        "name": f"E2E {suffix} item",
                        "quantity": 1,
                        "declared_value": "18.00",
                        "product_url": "https://example.com/e2e-item",
                        "remark": "automated e2e",
                    }
                ],
            },
            format="json",
        ),
        expected_status=201,
    )
    assert parcel["status"] == "PENDING_INBOUND"

    inbound = _api_data(
        admin_client.post(
            "/api/v1/admin/parcels/scan-inbound",
            {
                "warehouse_id": warehouse["id"],
                "tracking_no": tracking_no,
                "weight_kg": "1.230",
                "length_cm": "30.00",
                "width_cm": "20.00",
                "height_cm": "10.00",
                "photo_file_ids": [f"e2e-{suffix.lower()}-photo"],
                "remark": f"E2E {suffix} inbound",
            },
            format="json",
        )
    )["parcel"]
    assert inbound["id"] == parcel["id"]
    assert inbound["status"] == "IN_STOCK"

    packable = _api_data(member_client.get("/api/v1/parcels/packable"))["items"]
    assert any(item["id"] == parcel["id"] and item["status"] == "IN_STOCK" for item in packable)

    waybill = _api_data(
        member_client.post(
            "/api/v1/waybills",
            {
                "parcel_ids": [parcel["id"]],
                "channel_id": channel["id"],
                "destination_country": "美国",
                "recipient_name": "E2E Receiver",
                "recipient_phone": "15500000000",
                "recipient_address": "100 Demo Street, Los Angeles, CA",
                "postal_code": "90001",
                "remark": f"E2E {suffix} waybill",
            },
            format="json",
        ),
        expected_status=201,
    )
    assert waybill["status"] == "PENDING_REVIEW"

    reviewed = _api_data(
        admin_client.post(
            f"/api/v1/admin/waybills/{waybill['id']}/review",
            {"review_remark": f"E2E {suffix} reviewed"},
            format="json",
        )
    )
    assert reviewed["status"] == "PENDING_PACKING"

    fee_set = _api_data(
        admin_client.post(
            f"/api/v1/admin/waybills/{waybill['id']}/set-fee",
            {
                "fee_total": "48.50",
                "fee_detail_json": {"base": "40.00", "fuel": "8.50"},
                "fee_remark": f"E2E {suffix} fee",
            },
            format="json",
        )
    )
    assert fee_set["status"] == "PENDING_PAYMENT"

    recharge = _api_data(
        admin_client.post(
            f"/api/v1/admin/users/{member['id']}/wallet/recharge",
            {"amount": "100.00", "currency": "CNY", "remark": f"E2E {suffix} recharge"},
            format="json",
        ),
        expected_status=201,
    )
    assert recharge["type"] == "ADMIN_RECHARGE"

    paid = _api_data(
        member_client.post(
            f"/api/v1/waybills/{waybill['id']}/pay",
            {"idempotency_key": f"e2e-{suffix.lower()}-pay-{run_id}"},
            format="json",
        )
    )["waybill"]
    assert paid["status"] == "PENDING_SHIPMENT"

    shipped = _api_data(
        admin_client.post(
            f"/api/v1/admin/waybills/{waybill['id']}/ship",
            {
                "status_text": "已发货",
                "location": "深圳仓",
                "description": f"E2E {suffix} outbound",
            },
            format="json",
        )
    )
    assert shipped["status"] == "SHIPPED"

    event = _api_data(
        admin_client.post(
            f"/api/v1/admin/waybills/{waybill['id']}/tracking-events",
            {
                "status_text": "运输中",
                "location": "香港中转",
                "description": f"E2E {suffix} transit",
            },
            format="json",
        ),
        expected_status=201,
    )
    assert event["status_text"] == "运输中"

    tracking = _api_data(member_client.get(f"/api/v1/waybills/tracking?waybill_no={waybill['waybill_no']}"))
    assert len(tracking["items"]) >= 2

    signed = _api_data(
        member_client.post(
            f"/api/v1/waybills/{waybill['id']}/confirm-receipt",
            {"description": f"E2E {suffix} signed"},
            format="json",
        )
    )
    assert signed["status"] == "SIGNED"
    return {
        "tracking_no": tracking_no,
        "parcel_no": parcel["parcel_no"],
        "waybill_no": waybill["waybill_no"],
        "status": signed["status"],
    }


def _run_purchase_flow(
    *,
    admin_client: APIClient,
    member_client: APIClient,
    member: dict,
    warehouse: dict,
    channel: dict,
    run_id: str,
) -> dict:
    order = _api_data(
        member_client.post(
            "/api/v1/purchase-orders/manual",
            {
                "service_fee": "1.10",
                "items": [
                    {
                        "name": "E2E 手工代购商品",
                        "quantity": 2,
                        "unit_price": "9.90",
                        "actual_price": "9.90",
                        "product_url": "https://example.com/e2e-purchase",
                        "remark": "E2E manual purchase",
                    }
                ],
            },
            format="json",
        ),
        expected_status=201,
    )
    assert order["status"] == "PENDING_PAYMENT"

    paid_order = _api_data(
        member_client.post(
            f"/api/v1/purchase-orders/{order['id']}/pay",
            {"idempotency_key": f"e2e-purchase-pay-{run_id}"},
            format="json",
        )
    )["purchase_order"]
    assert paid_order["status"] == "PENDING_REVIEW"

    reviewed = _api_data(
        admin_client.post(
            f"/api/v1/admin/purchase-orders/{order['id']}/review",
            {"review_remark": "E2E purchase reviewed"},
            format="json",
        )
    )
    assert reviewed["status"] == "PENDING_PROCUREMENT"

    procured = _api_data(
        admin_client.post(
            f"/api/v1/admin/purchase-orders/{order['id']}/procure",
            {
                "purchase_amount": "19.80",
                "external_order_no": f"TB-E2E-{run_id}",
                "tracking_no": f"E2E-PURCHASE-CN-{run_id}",
                "remark": "E2E purchase procured",
            },
            format="json",
        )
    )
    assert procured["status"] == "PROCURED"

    arrived = _api_data(
        admin_client.post(
            f"/api/v1/admin/purchase-orders/{order['id']}/mark-arrived",
            {
                "tracking_no": f"E2E-PURCHASE-CN-{run_id}",
                "remark": "E2E purchase arrived",
            },
            format="json",
        )
    )
    assert arrived["status"] == "ARRIVED"

    converted = _api_data(
        admin_client.post(
            f"/api/v1/admin/purchase-orders/{order['id']}/convert-to-parcel",
            {
                "warehouse_id": warehouse["id"],
                "tracking_no": f"E2E-PURCHASE-PARCEL-{run_id}",
                "carrier": "E2E Purchase Express",
                "weight_kg": "0.880",
                "length_cm": "18.00",
                "width_cm": "12.00",
                "height_cm": "8.00",
                "remark": "E2E purchase converted to parcel",
            },
            format="json",
        )
    )
    assert converted["status"] == "COMPLETED"
    converted_parcel = converted["converted_parcel"]
    assert converted_parcel["status"] == "IN_STOCK"

    waybill = _api_data(
        member_client.post(
            "/api/v1/waybills",
            {
                "parcel_ids": [converted_parcel["id"]],
                "channel_id": channel["id"],
                "destination_country": "美国",
                "recipient_name": "E2E Purchase Receiver",
                "recipient_phone": "15500000001",
                "recipient_address": "200 Demo Street, Los Angeles, CA",
                "postal_code": "90002",
                "remark": "E2E purchase parcel waybill",
            },
            format="json",
        ),
        expected_status=201,
    )
    assert waybill["status"] == "PENDING_REVIEW"

    return {
        "order_no": order["order_no"],
        "parcel_no": converted_parcel["parcel_no"],
        "waybill_no": waybill["waybill_no"],
        "waybill_status": waybill["status"],
    }


@pytest.mark.django_db(transaction=True)
def test_p0_forwarding_and_purchase_e2e():
    run_id = "PYTEST"
    print(
        "\n[E2E-001]\n"
        f"测试账号: Admin {ADMIN_EMAIL}/{PASSWORD}; Member {MEMBER_EMAIL}/{PASSWORD}\n"
        "启动命令: (cd backend && uv run python manage.py migrate); "
        "(cd backend && uv run python manage.py seed_demo); "
        "(cd backend && uv run python manage.py runserver)\n"
        "三端命令: pnpm --filter admin-web dev; pnpm --filter user-web dev; pnpm --filter mobile-h5 dev\n"
        "E2E 命令: npm run e2e\n"
        "失败阻塞项: 若本命令失败，先查看 pytest 断言输出和最近一个 API 响应 body。\n"
    )

    _seed_demo_data()
    admin_client, _admin = _login_admin()
    member_client, member = _login_member()
    warehouse, channel = _confirm_demo_configs(admin_client, member_client, member)

    main_result = _run_forwarding_flow(
        admin_client=admin_client,
        member_client=member_client,
        member=member,
        warehouse=warehouse,
        channel=channel,
        run_id=run_id,
        suffix="MAIN",
    )
    purchase_result = _run_purchase_flow(
        admin_client=admin_client,
        member_client=member_client,
        member=member,
        warehouse=warehouse,
        channel=channel,
        run_id=run_id,
    )

    print("[E2E-001] 主链路完成:", main_result)
    print("[E2E-001] 代购链路完成:", purchase_result)
    assert main_result["status"] == "SIGNED"
    assert purchase_result["waybill_status"] == "PENDING_REVIEW"
