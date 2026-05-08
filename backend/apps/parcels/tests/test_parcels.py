import pytest
from django.urls import reverse

from apps.iam.services import seed_iam_demo_data
from apps.members.services import register_user, seed_member_demo_data
from apps.parcels.models import InboundRecord, Parcel, ParcelStatus, UnclaimedParcel
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


def test_admin_inbound_moves_parcel_to_in_stock(client, seeded_parcels):
    warehouse = Warehouse.objects.get(code="SZ")
    user = register_user("inbound-user@example.com", "password123")
    parcel = forecast_parcel(user=user, warehouse=warehouse, tracking_no="SF10002")
    token = admin_token(client)

    response = client.post(
        reverse("admin-parcel-inbound", kwargs={"parcel_id": parcel.id}),
        {"weight_kg": "1.250", "length_cm": "20.00", "width_cm": "10.00", "height_cm": "8.00"},
        content_type="application/json",
        HTTP_AUTHORIZATION=f"Bearer {token}",
    )

    assert response.status_code == 200
    body = response.json()
    assert body["data"]["status"] == ParcelStatus.IN_STOCK
    assert body["data"]["weight_kg"] == "1.250"
    assert InboundRecord.objects.filter(parcel=parcel).exists()

    packable = client.get(
        reverse("parcel-packable-list"),
        HTTP_AUTHORIZATION=f"Bearer {member_token(client, email='inbound-user@example.com')}",
    )
    assert packable.status_code == 200
    assert packable.json()["data"]["items"][0]["id"] == parcel.id


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
