import pytest
from django.core.files.uploadedfile import SimpleUploadedFile
from django.test import override_settings
from django.urls import reverse

from apps.files.models import FileUsage
from apps.iam.services import seed_iam_demo_data
from apps.members.models import User
from apps.members.services import register_user, seed_member_demo_data
from apps.parcels.models import InboundRecord, Parcel, ParcelPhoto, ParcelStatus, UnclaimedParcel, UnclaimedParcelStatus
from apps.parcels.services import forecast_parcel
from apps.warehouses.models import Warehouse
from apps.warehouses.services import seed_warehouse_demo_data


@pytest.fixture
def seeded_parcels(db):
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


def admin_token(client, email="admin@example.com"):
    response = client.post(
        reverse("admin-login"),
        {"email": email, "password": "password123"},
        content_type="application/json",
    )
    return response.json()["data"]["access_token"]


def upload_admin_parcel_photo(client, token, name="inbound-photo.jpg"):
    response = client.post(
        reverse("admin-file-list"),
        {
            "usage": FileUsage.PARCEL_PHOTO,
            "file": SimpleUploadedFile(name, b"inbound-photo", content_type="image/jpeg"),
        },
        HTTP_AUTHORIZATION=f"Bearer {token}",
    )
    assert response.status_code == 201
    return response.json()["data"]


def test_member_forecast_creates_pending_inbound_parcel(client, seeded_parcels):
    warehouse = Warehouse.objects.get(code="SZ")
    token = member_token(client)

    response = client.post(
        reverse("parcel-forecast"),
        {
            "warehouse_id": warehouse.id,
            "tracking_no": "SF10001",
            "carrier": "SF",
            "items": [
                {
                    "name": "T-shirt",
                    "quantity": 2,
                    "declared_value": "19.99",
                    "product_url": "",
                    "remark": "blue",
                }
            ],
        },
        content_type="application/json",
        HTTP_AUTHORIZATION=f"Bearer {token}",
    )

    assert response.status_code == 201
    data = response.json()["data"]
    assert data["parcel_no"].startswith("P")
    assert data["status"] == ParcelStatus.PENDING_INBOUND
    assert data["items"][0]["name"] == "T-shirt"


@override_settings(MEDIA_ROOT="/tmp/crossborder-erp-test-media")
def test_admin_inbound_moves_parcel_to_in_stock(client, seeded_parcels):
    warehouse = Warehouse.objects.get(code="SZ")
    user = register_user("inbound-user@example.com", "password123")
    parcel = forecast_parcel(user=user, warehouse=warehouse, tracking_no="SF10002")
    token = admin_token(client)
    uploaded = upload_admin_parcel_photo(client, token)

    response = client.post(
        reverse("admin-parcel-inbound", kwargs={"parcel_id": parcel.id}),
        {
            "weight_kg": "1.250",
            "length_cm": "20.00",
            "width_cm": "10.00",
            "height_cm": "8.00",
            "photo_file_ids": [uploaded["file_id"]],
        },
        content_type="application/json",
        HTTP_AUTHORIZATION=f"Bearer {token}",
    )

    assert response.status_code == 200
    body = response.json()
    assert body["data"]["status"] == ParcelStatus.IN_STOCK
    assert body["data"]["weight_kg"] == "1.250"
    assert body["data"]["photos"][0]["file_id"] == uploaded["file_id"]
    assert body["data"]["photos"][0]["file_name"] == "inbound-photo.jpg"
    assert InboundRecord.objects.filter(parcel=parcel).exists()
    assert ParcelPhoto.objects.filter(parcel=parcel, file_id=uploaded["file_id"]).exists()

    packable = client.get(
        reverse("parcel-packable-list"),
        HTTP_AUTHORIZATION=f"Bearer {member_token(client, email='inbound-user@example.com')}",
    )
    assert packable.status_code == 200
    assert packable.json()["data"]["items"][0]["id"] == parcel.id

    member_download = client.get(
        reverse("file-download", kwargs={"file_id": uploaded["file_id"]}),
        HTTP_AUTHORIZATION=f"Bearer {member_token(client, email='inbound-user@example.com')}",
    )
    assert member_download.status_code == 200


@override_settings(MEDIA_ROOT="/tmp/crossborder-erp-test-media")
def test_admin_inbound_rejects_unknown_photo_file_id(client, seeded_parcels):
    warehouse = Warehouse.objects.get(code="SZ")
    user = register_user("bad-photo-user@example.com", "password123")
    parcel = forecast_parcel(user=user, warehouse=warehouse, tracking_no="SF10002-BAD")
    token = admin_token(client)

    response = client.post(
        reverse("admin-parcel-inbound", kwargs={"parcel_id": parcel.id}),
        {"weight_kg": "1.250", "photo_file_ids": ["missing-file"]},
        content_type="application/json",
        HTTP_AUTHORIZATION=f"Bearer {token}",
    )

    assert response.status_code == 400
    assert response.json()["code"] == "VALIDATION_ERROR"
    assert not ParcelPhoto.objects.filter(parcel=parcel).exists()


def test_duplicate_inbound_returns_state_conflict(client, seeded_parcels):
    warehouse = Warehouse.objects.get(code="SZ")
    user = register_user("duplicate-user@example.com", "password123")
    parcel = forecast_parcel(user=user, warehouse=warehouse, tracking_no="SF10003")
    token = admin_token(client)
    payload = {"weight_kg": "1.000"}

    first = client.post(
        reverse("admin-parcel-inbound", kwargs={"parcel_id": parcel.id}),
        payload,
        content_type="application/json",
        HTTP_AUTHORIZATION=f"Bearer {token}",
    )
    second = client.post(
        reverse("admin-parcel-inbound", kwargs={"parcel_id": parcel.id}),
        payload,
        content_type="application/json",
        HTTP_AUTHORIZATION=f"Bearer {token}",
    )

    assert first.status_code == 200
    assert second.status_code == 409
    assert second.json()["code"] == "STATE_CONFLICT"


def test_member_cannot_access_other_users_parcel(client, seeded_parcels):
    warehouse = Warehouse.objects.get(code="SZ")
    owner = register_user("owner@example.com", "password123")
    parcel = forecast_parcel(user=owner, warehouse=warehouse, tracking_no="SF10004")
    token = member_token(client)

    response = client.get(
        reverse("parcel-detail", kwargs={"parcel_id": parcel.id}),
        HTTP_AUTHORIZATION=f"Bearer {token}",
    )

    assert response.status_code == 404
    assert response.json()["code"] == "NOT_FOUND"


def test_scan_unknown_tracking_creates_unclaimed_parcel(client, seeded_parcels):
    warehouse = Warehouse.objects.get(code="SZ")
    token = admin_token(client, email="warehouse@example.com")

    response = client.post(
        reverse("admin-parcel-scan-inbound"),
        {"warehouse_id": warehouse.id, "tracking_no": "UNKNOWN10001", "weight_kg": "0.800"},
        content_type="application/json",
        HTTP_AUTHORIZATION=f"Bearer {token}",
    )

    assert response.status_code == 201
    data = response.json()["data"]
    assert data["parcel"] is None
    assert data["created_unclaimed"] is True
    assert data["unclaimed_parcel"]["tracking_no"] == "UNKNOWN10001"
    assert UnclaimedParcel.objects.filter(tracking_no="UNKNOWN10001").exists()


def test_member_lists_unclaimed_parcels_with_masked_tracking(client, seeded_parcels):
    warehouse = Warehouse.objects.get(code="SZ")
    UnclaimedParcel.objects.create(
        warehouse=warehouse,
        tracking_no="MASKED-TRACKING-001",
        description="后台内部备注不应展示给用户",
        weight_kg="0.800",
    )
    token = member_token(client)

    response = client.get(
        reverse("unclaimed-parcel-list"),
        {"keyword": "TRACKING"},
        HTTP_AUTHORIZATION=f"Bearer {token}",
    )

    assert response.status_code == 200
    item = response.json()["data"]["items"][0]
    assert item["tracking_no_masked"] == "MAS***001"
    assert "tracking_no" not in item
    assert "description" not in item
    assert item["is_mine"] is False


def test_member_claims_unclaimed_parcel_and_blocks_second_claimant(client, seeded_parcels):
    warehouse = Warehouse.objects.get(code="SZ")
    unclaimed = UnclaimedParcel.objects.create(
        warehouse=warehouse,
        tracking_no="CLAIM-TRACKING-001",
        weight_kg="0.900",
    )
    first_token = member_token(client)
    second_user = register_user("second-claimant@example.com", "password123")
    second_token = member_token(client, email=second_user.email)

    first = client.post(
        reverse("unclaimed-parcel-claim", kwargs={"unclaimed_id": unclaimed.id}),
        {"claim_note": "TODO_CONFIRM: 包裹截图凭证", "claim_contact": "13900003333"},
        content_type="application/json",
        HTTP_AUTHORIZATION=f"Bearer {first_token}",
    )
    second = client.post(
        reverse("unclaimed-parcel-claim", kwargs={"unclaimed_id": unclaimed.id}),
        {"claim_note": "second claim"},
        content_type="application/json",
        HTTP_AUTHORIZATION=f"Bearer {second_token}",
    )

    assert first.status_code == 200
    assert first.json()["data"]["status"] == UnclaimedParcelStatus.CLAIM_PENDING
    assert first.json()["data"]["is_mine"] is True
    assert second.status_code == 409
    assert second.json()["code"] == "STATE_CONFLICT"
    unclaimed.refresh_from_db()
    assert unclaimed.claimed_by_user.email == "user@example.com"
    assert unclaimed.claim_contact == "13900003333"


def test_admin_approves_unclaimed_claim_to_member_parcel(client, seeded_parcels):
    warehouse = Warehouse.objects.get(code="SZ")
    unclaimed = UnclaimedParcel.objects.create(
        warehouse=warehouse,
        tracking_no="APPROVE-TRACKING-001",
        description="入库无主包裹",
        weight_kg="1.100",
        dimensions_json={"length_cm": "10.00", "width_cm": "9.00", "height_cm": "8.00"},
    )
    member = member_token(client)
    admin = admin_token(client, email="warehouse@example.com")
    client.post(
        reverse("unclaimed-parcel-claim", kwargs={"unclaimed_id": unclaimed.id}),
        {"claim_note": "matching proof"},
        content_type="application/json",
        HTTP_AUTHORIZATION=f"Bearer {member}",
    )

    response = client.post(
        reverse("admin-unclaimed-parcel-approve", kwargs={"unclaimed_id": unclaimed.id}),
        {"review_note": "凭证匹配"},
        content_type="application/json",
        HTTP_AUTHORIZATION=f"Bearer {admin}",
    )

    assert response.status_code == 200
    data = response.json()["data"]
    assert data["unclaimed_parcel"]["status"] == UnclaimedParcelStatus.CLAIMED
    assert data["parcel"]["tracking_no"] == "APPROVE-TRACKING-001"
    assert data["parcel"]["status"] == ParcelStatus.IN_STOCK
    assert data["parcel"]["length_cm"] == "10.00"
    assert data["parcel"]["width_cm"] == "9.00"
    assert data["parcel"]["height_cm"] == "8.00"
    assert Parcel.objects.filter(tracking_no="APPROVE-TRACKING-001", user__email="user@example.com").exists()
    assert InboundRecord.objects.filter(parcel__tracking_no="APPROVE-TRACKING-001").exists()


def test_admin_rejects_unclaimed_claim_and_reopens_listing(client, seeded_parcels):
    warehouse = Warehouse.objects.get(code="SZ")
    unclaimed = UnclaimedParcel.objects.create(
        warehouse=warehouse,
        tracking_no="REJECT-TRACKING-001",
    )
    member = member_token(client)
    admin = admin_token(client, email="warehouse@example.com")
    client.post(
        reverse("unclaimed-parcel-claim", kwargs={"unclaimed_id": unclaimed.id}),
        {"claim_note": "bad proof"},
        content_type="application/json",
        HTTP_AUTHORIZATION=f"Bearer {member}",
    )

    response = client.post(
        reverse("admin-unclaimed-parcel-reject", kwargs={"unclaimed_id": unclaimed.id}),
        {"review_note": "凭证不匹配"},
        content_type="application/json",
        HTTP_AUTHORIZATION=f"Bearer {admin}",
    )

    assert response.status_code == 200
    data = response.json()["data"]
    assert data["status"] == UnclaimedParcelStatus.UNCLAIMED
    assert data["claimed_by_email"] is None
    unclaimed.refresh_from_db()
    assert unclaimed.claimed_by_user is None
    assert unclaimed.claim_note == ""


def test_unclaimed_review_requires_parcel_permission(client, seeded_parcels):
    warehouse = Warehouse.objects.get(code="SZ")
    unclaimed = UnclaimedParcel.objects.create(
        warehouse=warehouse,
        tracking_no="RBAC-TRACKING-001",
        status=UnclaimedParcelStatus.CLAIM_PENDING,
        claimed_by_user=User.objects.get(email="user@example.com"),
    )
    token = admin_token(client, email="finance@example.com")

    response = client.post(
        reverse("admin-unclaimed-parcel-approve", kwargs={"unclaimed_id": unclaimed.id}),
        HTTP_AUTHORIZATION=f"Bearer {token}",
    )

    assert response.status_code == 403
    assert response.json()["code"] == "FORBIDDEN"


def test_scan_matching_tracking_inbounds_forecasted_parcel(client, seeded_parcels):
    warehouse = Warehouse.objects.get(code="SZ")
    user = register_user("scan-user@example.com", "password123")
    parcel = forecast_parcel(user=user, warehouse=warehouse, tracking_no="SF10005")
    token = admin_token(client, email="warehouse@example.com")

    response = client.post(
        reverse("admin-parcel-scan-inbound"),
        {"warehouse_id": warehouse.id, "tracking_no": "SF10005", "weight_kg": "2.300"},
        content_type="application/json",
        HTTP_AUTHORIZATION=f"Bearer {token}",
    )

    assert response.status_code == 200
    data = response.json()["data"]
    assert data["parcel"]["id"] == parcel.id
    assert data["parcel"]["status"] == ParcelStatus.IN_STOCK
    assert data["unclaimed_parcel"] is None


def test_non_permitted_admin_cannot_list_parcels(client, seeded_parcels):
    token = admin_token(client, email="finance@example.com")

    response = client.get(reverse("admin-parcel-list"), HTTP_AUTHORIZATION=f"Bearer {token}")

    assert response.status_code == 403
    assert response.json()["code"] == "FORBIDDEN"
