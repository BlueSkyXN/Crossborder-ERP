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
RESET_PASSWORD = "MemberReset123"
JPEG_BYTES = b"\xff\xd8\xff\xe0\x00\x10JFIF\x00\x01\x01\x01\x00\x48\x00\x48\x00\x00\xff\xd9"


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


def _login_member(password: str = PASSWORD) -> tuple[APIClient, dict]:
    client = APIClient()
    data = _api_data(
        client.post(
            "/api/v1/auth/login",
            {"email": MEMBER_EMAIL, "password": password},
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
                    JPEG_BYTES,
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
                    JPEG_BYTES,
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
                    JPEG_BYTES,
                    content_type="image/jpeg",
                ),
            },
            format="multipart",
        ),
        expected_status=201,
    )


def _upload_member_import_file(member_client: APIClient, suffix: str, content: bytes) -> dict:
    return _api_data(
        member_client.post(
            "/api/v1/files",
            {
                "usage": "IMPORT_FILE",
                "file": SimpleUploadedFile(
                    f"e2e-{suffix.lower()}-forecast.csv",
                    content,
                    content_type="text/csv",
                ),
            },
            format="multipart",
        ),
        expected_status=201,
    )


def _run_parcel_import_flow(
    *,
    admin_client: APIClient,
    member_client: APIClient,
    run_id: str,
) -> dict:
    tracking_no = f"E2E-IMPORT-{run_id}"
    csv_content = (
        "warehouse_code,tracking_no,carrier,item_name,quantity,declared_value,product_url,remark\n"
        f"SZ,{tracking_no},E2E Import,T-shirt,1,11.00,https://example.com/import,E2E batch import\n"
    ).encode("utf-8")
    stored_file = _upload_member_import_file(member_client, "IMPORT", csv_content)
    job = _api_data(
        member_client.post(
            "/api/v1/parcels/imports",
            {"file_id": stored_file["file_id"]},
            format="json",
        ),
        expected_status=201,
    )
    assert job["status"] == "COMPLETED"
    assert job["success_count"] == 1

    parcels = _api_data(member_client.get("/api/v1/parcels"))["items"]
    imported = next(item for item in parcels if item["tracking_no"] == tracking_no)
    assert imported["status"] == "PENDING_INBOUND"
    assert imported["items"][0]["name"] == "T-shirt"

    member_export = member_client.get("/api/v1/parcels/export")
    assert member_export.status_code == 200
    assert tracking_no in member_export.content.decode("utf-8-sig")

    admin_export = admin_client.get("/api/v1/admin/parcels/export")
    assert admin_export.status_code == 200
    assert tracking_no in admin_export.content.decode("utf-8-sig")
    return {
        "job_no": job["job_no"],
        "tracking_no": tracking_no,
        "parcel_no": imported["parcel_no"],
    }


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
            {"password": RESET_PASSWORD},
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


def _run_growth_flow(*, admin_client: APIClient, member_client: APIClient, member: dict, run_id: str) -> dict:
    invitee = _api_data(
        APIClient().post(
            "/api/v1/auth/register",
            {
                "email": f"growth-{run_id.lower()}@example.com",
                "password": "GrowthPass123",
                "display_name": "E2E 被邀请会员",
            },
            format="json",
        ),
        expected_status=201,
    )
    referral = _api_data(
        admin_client.post(
            "/api/v1/admin/growth/referrals",
            {
                "inviter_id": member["id"],
                "invitee_id": invitee["id"],
                "remark": "TODO_CONFIRM: E2E 手工邀请归因",
            },
            format="json",
        ),
        expected_status=201,
    )
    rebate = _api_data(
        admin_client.post(
            "/api/v1/admin/growth/rebates",
            {
                "referral_id": referral["id"],
                "amount": "3.50",
                "reward_points": 25,
                "business_type": "E2E_REFERRAL",
                "business_id": 2001,
                "remark": "TODO_CONFIRM: E2E 返利比例和结算规则待确认",
            },
            format="json",
        ),
        expected_status=201,
    )
    point_adjustment = _api_data(
        admin_client.post(
            f"/api/v1/admin/members/{member['id']}/points/adjust",
            {
                "points_delta": 15,
                "remark": "TODO_CONFIRM: E2E 后台手工积分调整",
            },
            format="json",
        ),
        expected_status=201,
    )

    summary = _api_data(member_client.get("/api/v1/growth/summary"))
    assert summary["points_balance"] == 40
    assert summary["confirmed_reward_points"] == 25
    assert summary["confirmed_rebate_amount"] == "3.50"
    assert "TODO_CONFIRM" in summary["rebate_rule_note"]

    detail = _api_data(admin_client.get(f"/api/v1/admin/members/{member['id']}/growth"))
    assert detail["summary"]["points_balance"] == 40
    assert detail["referrals"][0]["invitee_email"] == invitee["email"]
    assert detail["rebates"][0]["reward_points"] == 25

    return {
        "referral_id": referral["id"],
        "rebate_id": rebate["id"],
        "points_balance": point_adjustment["balance_after"],
        "invitee_email": invitee["email"],
    }


def _run_content_flow(*, admin_client: APIClient, member_client: APIClient, run_id: str) -> dict:
    category = _api_data(
        admin_client.post(
            "/api/v1/admin/content/categories",
            {
                "type": "HELP",
                "slug": f"e2e-content-{run_id.lower()}",
                "name": f"E2E {run_id} 内容分类",
                "description": "E2E 内容分类",
                "sort_order": 990,
                "status": "ACTIVE",
            },
            format="json",
        ),
        expected_status=201,
    )
    page_slug = f"e2e-help-{run_id.lower()}"
    page = _api_data(
        admin_client.post(
            "/api/v1/admin/content/pages",
            {
                "category_id": category["id"],
                "type": "HELP",
                "slug": page_slug,
                "title": f"E2E {run_id} 帮助内容",
                "summary": "E2E 内容发布前后可见性验证",
                "body": f"E2E {run_id} 正文内容",
                "status": "DRAFT",
                "sort_order": 991,
            },
            format="json",
        ),
        expected_status=201,
    )
    assert page["status"] == "DRAFT"

    draft_detail = member_client.get(f"/api/v1/content/pages/{page_slug}")
    assert draft_detail.status_code == 404

    published = _api_data(admin_client.post(f"/api/v1/admin/content/pages/{page['id']}/publish"))
    assert published["status"] == "PUBLISHED"
    assert published["published_at"]

    public_detail = _api_data(member_client.get(f"/api/v1/content/pages/{page_slug}"))
    assert public_detail["title"] == page["title"]
    assert public_detail["body"] == f"E2E {run_id} 正文内容"
    assert "created_by_name" not in public_detail
    assert "status" not in public_detail

    public_items = _api_data(member_client.get("/api/v1/content/pages", {"type": "HELP"}))["items"]
    assert any(item["slug"] == page_slug for item in public_items)

    hidden = _api_data(admin_client.post(f"/api/v1/admin/content/pages/{page['id']}/hide"))
    assert hidden["status"] == "HIDDEN"
    hidden_detail = member_client.get(f"/api/v1/content/pages/{page_slug}")
    assert hidden_detail.status_code == 404
    return {
        "slug": page_slug,
        "category": category["slug"],
        "status": hidden["status"],
    }


def _run_unclaimed_claim_flow(
    *,
    admin_client: APIClient,
    member_client: APIClient,
    warehouse: dict,
    run_id: str,
) -> dict:
    tracking_no = f"E2E-UNCLAIMED-{run_id}"
    scanned = _api_data(
        admin_client.post(
            "/api/v1/admin/parcels/scan-inbound",
            {
                "warehouse_id": warehouse["id"],
                "tracking_no": tracking_no,
                "weight_kg": "0.660",
                "remark": "E2E unclaimed inbound",
            },
            format="json",
        ),
        expected_status=201,
    )
    unclaimed = scanned["unclaimed_parcel"]
    assert unclaimed["tracking_no"] == tracking_no

    public_items = _api_data(member_client.get("/api/v1/unclaimed-parcels", {"keyword": "UNCLAIMED"}))["items"]
    public_unclaimed = next(item for item in public_items if item["id"] == unclaimed["id"])
    assert "tracking_no" not in public_unclaimed
    assert public_unclaimed["tracking_no_masked"].startswith("E2E")

    claimed = _api_data(
        member_client.post(
            f"/api/v1/unclaimed-parcels/{unclaimed['id']}/claim",
            {
                "claim_note": "TODO_CONFIRM: E2E claim proof",
                "claim_contact": "13900004444",
            },
            format="json",
        )
    )
    assert claimed["status"] == "CLAIM_PENDING"
    assert claimed["is_mine"] is True

    approved = _api_data(
        admin_client.post(
            f"/api/v1/admin/unclaimed-parcels/{unclaimed['id']}/approve",
            {"review_note": "E2E claim approved"},
            format="json",
        )
    )
    parcel = approved["parcel"]
    assert approved["unclaimed_parcel"]["status"] == "CLAIMED"
    assert parcel["status"] == "IN_STOCK"
    packable = _api_data(member_client.get("/api/v1/parcels/packable"))["items"]
    assert any(item["id"] == parcel["id"] for item in packable)
    return {
        "tracking_no_masked": claimed["tracking_no_masked"],
        "parcel_no": parcel["parcel_no"],
        "status": approved["unclaimed_parcel"]["status"],
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


def _run_payable_flow(*, admin_client: APIClient, run_id: str) -> dict:
    supplier = _api_data(
        admin_client.post(
            "/api/v1/admin/suppliers",
            {
                "code": f"E2E-SUP-{run_id}",
                "name": f"E2E {run_id} 供应商",
                "contact_name": "E2E Contact",
                "phone": "13800001111",
                "email": f"payable-{run_id.lower()}@example.com",
                "bank_account": "TODO_CONFIRM: E2E payable demo account",
            },
            format="json",
        ),
        expected_status=201,
    )
    assert supplier["status"] == "ACTIVE"

    cost_type = _api_data(
        admin_client.post(
            "/api/v1/admin/cost-types",
            {
                "code": f"E2E-COST-{run_id}",
                "name": f"E2E {run_id} 国际运费",
                "category": "LOGISTICS",
            },
            format="json",
        ),
        expected_status=201,
    )
    assert cost_type["status"] == "ACTIVE"

    payable = _api_data(
        admin_client.post(
            "/api/v1/admin/payables",
            {
                "supplier_id": supplier["id"],
                "cost_type_id": cost_type["id"],
                "amount": "123.45",
                "currency": "CNY",
                "source_type": "E2E",
                "source_id": supplier["id"],
                "description": "E2E 应付链路验证",
                "due_date": "2026-05-31",
            },
            format="json",
        ),
        expected_status=201,
    )
    assert payable["payable_no"].startswith("AP")
    assert payable["status"] == "PENDING_REVIEW"
    assert payable["amount"] == "123.45"

    confirmed = _api_data(admin_client.post(f"/api/v1/admin/payables/{payable['id']}/confirm", {}, format="json"))
    assert confirmed["status"] == "CONFIRMED"
    assert confirmed["confirmed_by_name"]

    settled = _api_data(
        admin_client.post(
            f"/api/v1/admin/payables/{payable['id']}/settle",
            {
                "settlement_reference": f"E2E-SETTLE-{run_id}",
                "settlement_note": "E2E manual settlement marker",
            },
            format="json",
        )
    )
    assert settled["status"] == "SETTLED"
    assert settled["settlement_reference"] == f"E2E-SETTLE-{run_id}"

    repeat_settle = admin_client.post(
        f"/api/v1/admin/payables/{payable['id']}/settle",
        {"settlement_reference": f"E2E-SETTLE-REPEAT-{run_id}"},
        format="json",
    )
    assert repeat_settle.status_code == 409
    assert repeat_settle.json()["code"] == "STATE_CONFLICT"

    return {
        "payable_no": payable["payable_no"],
        "supplier_code": supplier["code"],
        "cost_type_code": cost_type["code"],
        "status": settled["status"],
    }


def _run_audit_log_flow(*, admin_client: APIClient) -> dict:
    logs = _api_data(admin_client.get("/api/v1/admin/audit-logs?page_size=100"))["items"]
    actions = {log["action"] for log in logs}
    for expected_action in [
        "admin-login",
        "admin-remittance-approve",
        "admin-member-point-adjust",
        "admin-payable-settle",
    ]:
        matched_logs = _api_data(
            admin_client.get(f"/api/v1/admin/audit-logs?page_size=100&action={expected_action}")
        )["items"]
        assert any(log["action"] == expected_action for log in matched_logs)
    assert any(log["target_id"] for log in logs)
    assert "password123" not in str(logs)
    assert "access_token" not in str(logs)
    return {"count": len(logs), "actions": sorted(actions)[:8]}


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

    batch = _api_data(
        admin_client.post(
            "/api/v1/admin/shipping-batches",
            {
                "name": f"E2E {suffix} 发货批次",
                "carrier_batch_no": f"E2E-CARRIER-{suffix}-{run_id}",
                "transfer_no": f"E2E-TRANSFER-{suffix}-{run_id}",
                "ship_note": f"E2E {suffix} batch shipment",
                "waybill_ids": [waybill["id"]],
            },
            format="json",
        ),
        expected_status=201,
    )
    assert batch["status"] == "DRAFT"
    assert batch["waybill_count"] == 1
    assert batch["waybills"][0]["waybill_no"] == waybill["waybill_no"]

    locked_batch = _api_data(admin_client.post(f"/api/v1/admin/shipping-batches/{batch['id']}/lock"))
    assert locked_batch["status"] == "LOCKED"

    for template in ["label", "picking", "handover"]:
        preview = _api_data(admin_client.get(f"/api/v1/admin/shipping-batches/{batch['id']}/print-data?template={template}"))
        assert preview["template"] == template
        assert preview["batch"]["batch_no"] == batch["batch_no"]
        assert preview["batch"]["carrier_batch_no"] == f"E2E-CARRIER-{suffix}-{run_id}"
        assert preview["items"][0]["waybill_no"] == waybill["waybill_no"]

    shipped = _api_data(
        admin_client.post(
            f"/api/v1/admin/shipping-batches/{batch['id']}/ship",
            {
                "status_text": "批次已发货",
                "location": "深圳仓",
                "description": f"E2E {suffix} outbound",
            },
            format="json",
        )
    )
    assert shipped["status"] == "SHIPPED"
    assert shipped["waybills"][0]["status"] == "SHIPPED"

    repeat_shipped = _api_data(
        admin_client.post(
            f"/api/v1/admin/shipping-batches/{batch['id']}/ship",
            {
                "status_text": "批次已发货",
                "location": "深圳仓",
                "description": f"E2E {suffix} outbound repeated",
            },
            format="json",
        )
    )
    assert repeat_shipped["status"] == "SHIPPED"

    event = _api_data(
        admin_client.post(
            f"/api/v1/admin/shipping-batches/{batch['id']}/tracking-events",
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
        "batch_no": batch["batch_no"],
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
    parsed_link = _api_data(
        member_client.post(
            "/api/v1/purchase-links/parse",
            {"source_url": f"https://item.taobao.com/item.htm?id={run_id}&title=E2E%E4%BB%A3%E8%B4%AD%E5%95%86%E5%93%81"},
            format="json",
        )
    )
    assert parsed_link["provider"] == "TAOBAO"
    assert parsed_link["external_item_id"] == run_id

    order = _api_data(
        member_client.post(
            "/api/v1/purchase-orders/manual",
            {
                "service_fee": "1.10",
                "items": [
                    {
                        "name": parsed_link["name"],
                        "quantity": 2,
                        "unit_price": "9.90",
                        "actual_price": "9.90",
                        "product_url": parsed_link["product_url"],
                        "remark": parsed_link["remark"],
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
    import_result = _run_parcel_import_flow(
        admin_client=admin_client,
        member_client=member_client,
        run_id=run_id,
    )
    unclaimed_result = _run_unclaimed_claim_flow(
        admin_client=admin_client,
        member_client=member_client,
        warehouse=warehouse,
        run_id=run_id,
    )

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
    member_client, member = _login_member(password=RESET_PASSWORD)
    growth_result = _run_growth_flow(
        admin_client=admin_client,
        member_client=member_client,
        member=member,
        run_id=run_id,
    )
    content_result = _run_content_flow(
        admin_client=admin_client,
        member_client=member_client,
        run_id=run_id,
    )
    payable_result = _run_payable_flow(admin_client=admin_client, run_id=run_id)
    audit_result = _run_audit_log_flow(admin_client=admin_client)

    print("[E2E-001] 主链路完成:", main_result)
    print("[SHIP-BATCH-001] 发货批次链路完成:", {"batch_no": main_result["batch_no"]})
    print("[IMPORT-001] 批量导入导出链路完成:", import_result)
    print("[PARCEL-CLAIM-001] 无主包裹认领链路完成:", unclaimed_result)
    print("[E2E-001] 代购链路完成:", purchase_result)
    print("[MSG-001] 工单链路完成:", ticket_result)
    print("[MEMBER-001] 会员后台链路完成:", member_admin_result)
    print("[GROWTH-001] 积分推广返利链路完成:", growth_result)
    print("[CONTENT-001] 内容 CMS 链路完成:", content_result)
    print("[PAYABLE-001] 应付链路完成:", payable_result)
    print("[AUDITLOG-001] 后台操作审计链路完成:", audit_result)
    assert main_result["status"] == "SIGNED"
    assert import_result["job_no"].startswith("IMP")
    assert unclaimed_result["status"] == "CLAIMED"
    assert purchase_result["waybill_status"] == "PENDING_REVIEW"
    assert ticket_result["status"] == "PROCESSING"
    assert growth_result["points_balance"] == 40
    assert member_admin_result["status"] == "ACTIVE"
    assert content_result["status"] == "HIDDEN"
    assert payable_result["status"] == "SETTLED"
    assert audit_result["count"] >= 4
