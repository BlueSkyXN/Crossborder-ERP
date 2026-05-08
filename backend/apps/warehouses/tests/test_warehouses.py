import pytest
from django.urls import reverse

from apps.iam.services import seed_iam_demo_data
from apps.members.services import seed_member_demo_data
from apps.warehouses.models import ConfigStatus, ShippingChannel, Warehouse
from apps.warehouses.services import get_active_shipping_channels, seed_warehouse_demo_data


@pytest.fixture
def seeded_config(db):
    seed_iam_demo_data()
    seed_member_demo_data()
    seed_warehouse_demo_data()


def admin_token(client, email="admin@example.com"):
    response = client.post(
        reverse("admin-login"),
        {"email": email, "password": "password123"},
        content_type="application/json",
    )
    return response.json()["data"]["access_token"]


def member_token(client):
    response = client.post(
        reverse("member-login"),
        {"email": "user@example.com", "password": "password123"},
        content_type="application/json",
    )
    return response.json()["data"]["access_token"]


def test_user_can_list_active_warehouses(client, seeded_config):
    response = client.get(reverse("warehouse-list"))

    assert response.status_code == 200
    codes = {item["code"] for item in response.json()["data"]["items"]}
    assert {"SZ", "BJ"} <= codes


def test_member_warehouse_address_includes_member_code(client, seeded_config):
    warehouse = Warehouse.objects.get(code="SZ")
    token = member_token(client)

    response = client.get(
        reverse("warehouse-address", kwargs={"warehouse_id": warehouse.id}),
        HTTP_AUTHORIZATION=f"Bearer {token}",
    )

    assert response.status_code == 200
    data = response.json()["data"]
    assert data["member_warehouse_code"].startswith("CB")
    assert data["member_warehouse_code"] in data["receiver_name"]
    assert data["member_warehouse_code"] in data["full_address"]


def test_admin_can_create_warehouse_with_address(client, seeded_config):
    token = admin_token(client)
    response = client.post(
        reverse("admin-warehouses-list"),
        {
            "code": "GZ",
            "name": "广州仓",
            "country": "中国",
            "city": "广州",
            "status": "ACTIVE",
            "address": {
                "address_line": "广州市测试仓库",
                "receiver_name": "集运仓",
                "phone": "13800000003",
                "postal_code": "510000",
            },
        },
        content_type="application/json",
        HTTP_AUTHORIZATION=f"Bearer {token}",
    )

    assert response.status_code == 201
    assert response.json()["data"]["address"]["address_line"] == "广州市测试仓库"


def test_non_permitted_admin_cannot_manage_config(client, seeded_config):
    token = admin_token(client, email="buyer@example.com")

    response = client.get(reverse("admin-warehouses-list"), HTTP_AUTHORIZATION=f"Bearer {token}")

    assert response.status_code == 403
    assert response.json()["code"] == "FORBIDDEN"


def test_inactive_shipping_channel_not_returned_by_active_selector(client, seeded_config):
    ShippingChannel.objects.create(
        code="DISABLED_CHANNEL",
        name="停用渠道",
        status=ConfigStatus.DISABLED,
        billing_method="weight",
    )

    codes = set(get_active_shipping_channels().values_list("code", flat=True))

    assert "TEST_AIR" in codes
    assert "DISABLED_CHANNEL" not in codes
