import pytest
from django.core.files.uploadedfile import SimpleUploadedFile
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


def _upload_admin_parcel_photo(admin_client: APIClient, suffix: str) -> dict:
    return _api_data(
        admin_client.post(
            "/api/v1/admin/files",
            {
                "usage": "PARCEL_PHOTO",
                "file": SimpleUploadedFile(
                    f"e2e-{suffix.lower()}-photo.jpg",
                    b"e2e-photo",
                    content_type="image/jpeg",
                ),
            },
            format="multipart",
        ),
        expected_status=201,
    )


def _upload_member_remittance_proof(member_client: APIClient, suffix: str) -> dict:
    return _api_data(
        member_client.post(
            "/api/v1/files",
            {
                "usage": "REMITTANCE_PROOF",
                "file": SimpleUploadedFile(
                    f"e2e-{suffix.lower()}-remittance.jpg",
                    b"e2e-remittance-proof",
                    content_type="image/jpeg",
                ),
            },
            format="multipart",
        ),
        expected_status=201,
    )


def _upload_member_message_attachment(member_client: APIClient, suffix: str) -> dict:
    return _api_data(
        member_client.post(
            "/api/v1/files",
            {
                "usage": "MESSAGE_ATTACHMENT",
                "file": SimpleUploadedFile(
                    f"e2e-{suffix.lower()}-message.jpg",
                    b"e2e-message-attachment",
                    content_type="image/jpeg",
                ),
            },
            format="multipart",
        ),
        expected_status=201,
    )


def _run_ticket_flow(*, admin_client: APIClient, member_client: APIClient, suffix: str) -> dict:
    attachment = _upload_member_message_attachment(member_client, suffix)
    ticket = _api_data(
        member_client.post(
            "/api/v1/tickets",
            {
                "type": "PARCEL",
                "title": f"E2E {suffix} 工单",
                "content": f"E2E {suffix} 包裹咨询",
                "file_id": attachment["file_id"],
            },
            format="json",
        ),
        expected_status=201,
    )
    assert ticket["ticket_no"].startswith("TKT")
    assert ticket["status"] == "OPEN"
    assert ticket["messages"][0]["file_id"] == attachment["file_id"]

    replied = _api_data(
        admin_client.post(
            f"/api/v1/admin/tickets/{ticket['id']}/messages",
            {"content": f"E2E {suffix} 客服回复"},
            format="json",
        )
    )
    assert replied["status"] == "PROCESSING"

    detail = _api_data(member_client.get(f"/api/v1/tickets/{ticket['id']}"))
    assert detail["messages"][-1]["sender_type"] == "ADMIN"
    assert detail["messages"][-1]["content"] == f"E2E {suffix} 客服回复"
    return {
        "ticket_no": ticket["ticket_no"],
        "status": detail["status"],
        "message_count": len(detail["messages"]),
    }


def _run_member_admin_flow(*, admin_client: APIClient, member_client: APIClient, member: dict) -> dict:
    members = _api_data(admin_client.get("/api/v1/admin/members", {"keyword": member["email"]}))["items"]
    assert len(members) == 1
    admin_member = members[0]
    assert admin_member["profile"]["member_no"] == member["profile"]["member_no"]

    service_admins = _api_data(admin_client.get("/api/v1/admin/member-service-admins"))["items"]
    assigned_admin = next(item for item in service_admins if item["email"] == "admin@example.com")
    updated = _api_data(
        admin_client.patch(
            f"/api/v1/admin/members/{admin_member['id']}",
            {
                "display_name": "E2E 会员",
                "phone": "13900002222",
                "level": "vip",
                "assigned_admin_id": assigned_admin["id"],
                "service_note": "TODO_CONFIRM: E2E 手动客服分配占位",
            },
            format="json",
        )
    )
    assert updated["profile"]["level"] == "vip"
    assert updated["profile"]["assigned_admin_id"] == assigned_admin["id"]

    frozen = _api_data(admin_client.post(f"/api/v1/admin/members/{admin_member['id']}/freeze"))
    assert frozen["status"] == "FROZEN"
    blocked = member_client.get("/api/v1/me")
    assert blocked.status_code == 403
    assert blocked.json()["code"] == "FORBIDDEN"

    unfrozen = _api_data(admin_client.post(f"/api/v1/admin/members/{admin_member['id']}/unfreeze"))
    assert unfrozen["status"] == "ACTIVE"
    restored = _api_data(member_client.get("/api/v1/me"))
    assert restored["email"] == member["email"]

    reset = _api_data(
        admin_client.post(
            f"/api/v1/admin/members/{admin_member['id']}/reset-password",
            {"password": PASSWORD},
            format="json",
        )
    )
    assert reset["id"] == admin_member["id"]
    return {
        "member_no": updated["profile"]["member_no"],
        "status": unfrozen["status"],
        "level": updated["profile"]["level"],
        "assigned_admin": updated["profile"]["assigned_admin_name"],
    }


def _run_offline_remittance_flow(
    *,
    admin_client: APIClient,
    member_client: APIClient,
    amount: str,
    suffix: str,
) -> dict:
    proof = _upload_member_remittance_proof(member_client, suffix)
    remittance = _api_data(
        member_client.post(
            "/api/v1/remittances",
            {
                "amount": amount,
                "currency": "CNY",
                "proof_file_id": proof["file_id"],
                "remark": f"E2E {suffix} offline remittance",
            },
            format="json",
        ),
        expected_status=201,
    )
    assert remittance["status"] == "PENDING"
    assert remittance["proof_file_id"] == proof["file_id"]

    approved = _api_data(
        admin_client.post(
            f"/api/v1/admin/remittances/{remittance['id']}/approve",
            {"review_remark": f"E2E {suffix} approved"},
            format="json",
        )
    )
    assert approved["type"] == "OFFLINE_REMITTANCE"
    assert approved["amount"] == amount

    wallet = _api_data(member_client.get("/api/v1/wallet"))
    assert wallet["balance"] == amount
    return {
        "request_no": remittance["request_no"],
        "proof_file_id": proof["file_id"],
        "wallet_balance": wallet["balance"],
    }


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
    photo = _upload_admin_parcel_photo(admin_client, suffix)

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
                "photo_file_ids": [photo["file_id"]],
                "remark": f"E2E {suffix} inbound",
            },
            format="json",
        )
    )["parcel"]
    assert inbound["id"] == parcel["id"]
    assert inbound["status"] == "IN_STOCK"

    packable = _api_data(member_client.get("/api/v1/parcels/packable"))["items"]
    assert any(item["id"] == parcel["id"] and item["status"] == "IN_STOCK" for item in packable)

    address = _api_data(
        member_client.post(
            "/api/v1/addresses",
            {
                "recipient_name": "E2E Receiver",
                "phone": "15500000000",
                "country": "美国",
                "region": "CA",
                "city": "Los Angeles",
                "address_line": "100 Demo Street",
                "postal_code": "90001",
                "company": "E2E Demo",
                "is_default": True,
            },
            format="json",
        ),
        expected_status=201,
    )
    assert address["is_default"] is True

    waybill = _api_data(
        member_client.post(
            "/api/v1/waybills",
            {
                "parcel_ids": [parcel["id"]],
                "channel_id": channel["id"],
                "address_id": address["id"],
                "remark": f"E2E {suffix} waybill",
            },
            format="json",
        ),
        expected_status=201,
    )
    assert waybill["status"] == "PENDING_REVIEW"
    assert waybill["recipient_snapshot"]["address_id"] == address["id"]
    assert waybill["recipient_snapshot"]["name"] == "E2E Receiver"
    assert waybill["recipient_snapshot"]["address"] == "100 Demo Street"

    _api_data(
        member_client.put(
            f"/api/v1/addresses/{address['id']}",
            {
                "recipient_name": "E2E Changed Receiver",
                "phone": "15500009999",
                "country": "美国",
                "region": "NY",
                "city": "New York",
                "address_line": "900 Changed Street",
                "postal_code": "10001",
                "company": "E2E Changed",
                "is_default": True,
            },
            format="json",
        )
    )
    waybill_detail = _api_data(member_client.get(f"/api/v1/waybills/{waybill['id']}"))
    assert waybill_detail["recipient_snapshot"]["name"] == "E2E Receiver"
    assert waybill_detail["recipient_snapshot"]["address"] == "100 Demo Street"

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

    remittance = _run_offline_remittance_flow(
        admin_client=admin_client,
        member_client=member_client,
        amount="100.00",
        suffix=suffix,
    )

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
        "remittance_no": remittance["request_no"],
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
    ticket_result = _run_ticket_flow(
        admin_client=admin_client,
        member_client=member_client,
        suffix="MAIN",
    )
    member_admin_result = _run_member_admin_flow(
        admin_client=admin_client,
        member_client=member_client,
        member=member,
    )

    print("[E2E-001] 主链路完成:", main_result)
    print("[E2E-001] 代购链路完成:", purchase_result)
    print("[MSG-001] 工单链路完成:", ticket_result)
    print("[MEMBER-001] 会员后台链路完成:", member_admin_result)
    assert main_result["status"] == "SIGNED"
    assert purchase_result["waybill_status"] == "PENDING_REVIEW"
    assert ticket_result["status"] == "PROCESSING"
    assert member_admin_result["status"] == "ACTIVE"
