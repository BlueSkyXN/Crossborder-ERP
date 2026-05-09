import pytest
from django.urls import reverse

from apps.iam.models import AdminUser, Permission, Role
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
    super_admin_role = next(item for item in body["data"]["items"] if item["code"] == "super_admin")
    assert "iam.role.manage" in super_admin_role["permission_codes"]


def test_super_admin_can_list_permissions(client, seeded_iam):
    login_response = admin_login(client)
    token = login_response.json()["data"]["access_token"]

    response = client.get(reverse("admin-permissions"), HTTP_AUTHORIZATION=f"Bearer {token}")

    assert response.status_code == 200
    codes = {item["code"] for item in response.json()["data"]["items"]}
    assert {"dashboard.view", "iam.role.view", "iam.role.manage"} <= codes


def test_super_admin_can_create_role_with_permissions(client, seeded_iam):
    login_response = admin_login(client)
    token = login_response.json()["data"]["access_token"]

    response = client.post(
        reverse("admin-roles"),
        {
            "code": "ops_custom",
            "name": "运营自定义",
            "description": "仅看控制台和包裹",
            "permission_codes": ["dashboard.view", "parcels.view", "dashboard.view"],
        },
        HTTP_AUTHORIZATION=f"Bearer {token}",
        content_type="application/json",
    )

    assert response.status_code == 201
    data = response.json()["data"]
    assert data["code"] == "ops_custom"
    assert data["permission_codes"] == ["dashboard.view", "parcels.view"]
    assert Role.objects.get(code="ops_custom").permissions.count() == 2


def test_super_admin_can_update_role_permissions(client, seeded_iam):
    login_response = admin_login(client)
    token = login_response.json()["data"]["access_token"]
    role = Role.objects.get(code="warehouse")

    response = client.patch(
        reverse("admin-role-detail", kwargs={"role_id": role.id}),
        {
            "name": "仓库与客服",
            "description": "仓库处理并可查看工单",
            "permission_codes": ["dashboard.view", "parcels.view", "tickets.view"],
        },
        HTTP_AUTHORIZATION=f"Bearer {token}",
        content_type="application/json",
    )

    assert response.status_code == 200
    data = response.json()["data"]
    assert data["name"] == "仓库与客服"
    assert data["permission_codes"] == ["dashboard.view", "parcels.view", "tickets.view"]


def test_role_write_rejects_missing_permission_code(client, seeded_iam):
    login_response = admin_login(client)
    token = login_response.json()["data"]["access_token"]

    response = client.post(
        reverse("admin-roles"),
        {
            "code": "bad_role",
            "name": "错误角色",
            "permission_codes": ["dashboard.view", "missing.permission"],
        },
        HTTP_AUTHORIZATION=f"Bearer {token}",
        content_type="application/json",
    )

    assert response.status_code == 400
    assert response.json()["code"] == "VALIDATION_ERROR"


def test_non_manager_cannot_write_roles(client, seeded_iam):
    login_response = admin_login(client, email="support@example.com")
    token = login_response.json()["data"]["access_token"]

    response = client.post(
        reverse("admin-roles"),
        {
            "code": "support_custom",
            "name": "客服自定义",
            "permission_codes": ["dashboard.view"],
        },
        HTTP_AUTHORIZATION=f"Bearer {token}",
        content_type="application/json",
    )

    assert response.status_code == 403
    assert response.json()["code"] == "FORBIDDEN"


def test_role_viewer_without_manage_cannot_write_roles(client, seeded_iam):
    warehouse_role = Role.objects.get(code="warehouse")
    warehouse_role.permissions.add(Permission.objects.get(code="iam.role.view"))
    login_response = admin_login(client, email="warehouse@example.com")
    token = login_response.json()["data"]["access_token"]

    response = client.post(
        reverse("admin-roles"),
        {
            "code": "viewer_custom",
            "name": "只读角色自定义",
            "permission_codes": ["dashboard.view"],
        },
        HTTP_AUTHORIZATION=f"Bearer {token}",
        content_type="application/json",
    )

    assert response.status_code == 403
    assert response.json()["code"] == "FORBIDDEN"


def test_super_admin_role_is_protected_from_update(client, seeded_iam):
    login_response = admin_login(client)
    token = login_response.json()["data"]["access_token"]
    role = Role.objects.get(code="super_admin")

    response = client.patch(
        reverse("admin-role-detail", kwargs={"role_id": role.id}),
        {"name": "bad", "permission_codes": ["dashboard.view"]},
        HTTP_AUTHORIZATION=f"Bearer {token}",
        content_type="application/json",
    )

    assert response.status_code == 400
    assert response.json()["code"] == "VALIDATION_ERROR"


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
