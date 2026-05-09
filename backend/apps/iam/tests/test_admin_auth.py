import pytest
from django.urls import reverse

from apps.iam.models import AdminUser
from apps.iam.services import seed_iam_demo_data


@pytest.fixture
def seeded_iam(db):
    seed_iam_demo_data()


def admin_login(client, email="admin@example.com", password="password123"):
    return client.post(
        reverse("admin-login"),
        {"email": email, "password": password},
        content_type="application/json",
    )


def test_super_admin_can_login(client, seeded_iam):
    response = admin_login(client)

    assert response.status_code == 200
    body = response.json()
    assert body["code"] == "OK"
    assert body["data"]["token_type"] == "Bearer"
    assert body["data"]["access_token"]
    assert body["data"]["admin_user"]["email"] == "admin@example.com"


def test_missing_token_returns_unauthorized(client, seeded_iam):
    response = client.get(reverse("admin-me"))

    assert response.status_code == 401
    assert response.json()["code"] == "UNAUTHORIZED"


def test_admin_me_rejects_non_admin_token_scope(client, seeded_iam):
    response = client.get(reverse("admin-me"), HTTP_AUTHORIZATION="Bearer invalid-token")

    assert response.status_code == 401
    assert response.json()["code"] == "UNAUTHORIZED"


def test_role_list_requires_permission(client, seeded_iam):
    login_response = admin_login(client, email="warehouse@example.com")
    token = login_response.json()["data"]["access_token"]

    response = client.get(reverse("admin-roles"), HTTP_AUTHORIZATION=f"Bearer {token}")

    assert response.status_code == 403
    assert response.json()["code"] == "FORBIDDEN"


def test_super_admin_can_list_roles(client, seeded_iam):
    login_response = admin_login(client)
    token = login_response.json()["data"]["access_token"]

    response = client.get(reverse("admin-roles"), HTTP_AUTHORIZATION=f"Bearer {token}")

    assert response.status_code == 200
    body = response.json()
    assert body["code"] == "OK"
    assert {item["code"] for item in body["data"]["items"]} >= {
        "super_admin",
        "warehouse",
        "finance",
        "buyer",
        "support",
    }


def test_dashboard_requires_admin_token(client, seeded_iam):
    response = client.get(reverse("admin-dashboard"))

    assert response.status_code == 401
    assert response.json()["code"] == "UNAUTHORIZED"


def test_super_admin_dashboard_uses_real_snapshot(client, seeded_iam):
    login_response = admin_login(client)
    token = login_response.json()["data"]["access_token"]

    response = client.get(reverse("admin-dashboard"), HTTP_AUTHORIZATION=f"Bearer {token}")

    assert response.status_code == 200
    body = response.json()
    assert body["code"] == "OK"
    data = body["data"]
    assert data["generated_at"]
    assert {card["key"] for card in data["summary_cards"]} >= {
        "members",
        "warehouse_config",
        "parcel_wms",
        "waybills",
        "finance",
        "purchases",
        "products",
        "tickets",
    }
    assert any(module["key"] == "audit" for module in data["modules"])
    assert all("path" in item and "value" in item for item in data["work_queue"])


def test_dashboard_respects_role_visibility(client, seeded_iam):
    login_response = admin_login(client, email="warehouse@example.com")
    token = login_response.json()["data"]["access_token"]

    response = client.get(reverse("admin-dashboard"), HTTP_AUTHORIZATION=f"Bearer {token}")

    assert response.status_code == 200
    data = response.json()["data"]
    assert {card["key"] for card in data["summary_cards"]} == {"parcel_wms", "waybills"}
    assert {module["key"] for module in data["modules"]} == {"parcel_wms", "waybills"}
    assert all(item["path"] in {"/parcels", "/waybills"} for item in data["work_queue"])


def test_seed_creates_required_demo_admins(seeded_iam):
    assert AdminUser.objects.filter(email="admin@example.com", is_super_admin=True).exists()
    assert AdminUser.objects.filter(email="warehouse@example.com").exists()
    assert AdminUser.objects.filter(email="finance@example.com").exists()
    assert AdminUser.objects.filter(email="buyer@example.com").exists()
    assert AdminUser.objects.filter(email="support@example.com").exists()
