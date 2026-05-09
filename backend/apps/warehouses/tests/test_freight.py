import pytest
from django.urls import reverse
from rest_framework.test import APIClient

from apps.warehouses.models import ShippingChannel
from apps.warehouses.services import seed_warehouse_demo_data


pytestmark = pytest.mark.django_db


@pytest.fixture
def api_client():
    return APIClient()


@pytest.fixture
def seeded_warehouses():
    seed_warehouse_demo_data()


def test_estimate_freight_with_valid_weight_and_dimensions(api_client, seeded_warehouses):
    channel = ShippingChannel.objects.get(code="TEST_AIR")

    response = api_client.post(
        reverse("freight-estimate"),
        {"channel_id": channel.id, "weight_kg": 1, "length_cm": 10, "width_cm": 10, "height_cm": 10},
        format="json",
    )

    assert response.status_code == 200
    data = response.json()["data"]
    assert data["channel_code"] == "TEST_AIR"
    assert data["actual_weight_kg"] == "1.0"
    assert data["volumetric_weight_kg"] == "0.20"
    assert data["billable_weight_kg"] == "1.0"
    assert data["fee"] == "45.00"
    assert data["error"] is None


def test_estimate_freight_uses_volumetric_weight_when_larger(api_client, seeded_warehouses):
    channel = ShippingChannel.objects.get(code="TEST_AIR")

    response = api_client.post(
        reverse("freight-estimate"),
        {"channel_id": channel.id, "weight_kg": 1, "length_cm": 50, "width_cm": 50, "height_cm": 50},
        format="json",
    )

    assert response.status_code == 200
    data = response.json()["data"]
    assert data["actual_weight_kg"] == "1.0"
    assert data["volumetric_weight_kg"] == "25.00"
    assert data["billable_weight_kg"] == "25.00"
    assert data["fee"] == "405.00"


def test_estimate_freight_missing_required_fields_returns_error(api_client, seeded_warehouses):
    response = api_client.post(reverse("freight-estimate"), {"weight_kg": 1}, format="json")

    assert response.status_code == 400
    assert response.json()["data"]["error"] == "channel_id 和 weight_kg 为必填"


def test_estimate_freight_invalid_channel_returns_error(api_client, seeded_warehouses):
    response = api_client.post(
        reverse("freight-estimate"),
        {"channel_id": 999999, "weight_kg": 1},
        format="json",
    )

    assert response.status_code == 400
    data = response.json()["data"]
    assert data["error"] == "渠道不存在或已停用"
    assert data["fee"] is None
