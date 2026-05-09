import pytest
from django.contrib.auth.hashers import make_password
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
    assert "iam.admin.manage" in super_admin_role["permission_codes"]


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


def test_super_admin_can_list_admin_accounts(client, seeded_iam):
    login_response = admin_login(client)
    token = login_response.json()["data"]["access_token"]

    response = client.get(reverse("admin-accounts"), HTTP_AUTHORIZATION=f"Bearer {token}")

    assert response.status_code == 200
    items = response.json()["data"]["items"]
    assert {item["email"] for item in items} >= {
        "admin@example.com",
        "warehouse@example.com",
        "finance@example.com",
        "buyer@example.com",
        "support@example.com",
    }
    super_admin = next(item for item in items if item["email"] == "admin@example.com")
    assert "iam.admin.manage" in super_admin["permission_codes"]


def test_super_admin_can_create_admin_account_with_roles(client, seeded_iam):
    login_response = admin_login(client)
    token = login_response.json()["data"]["access_token"]

    response = client.post(
        reverse("admin-accounts"),
        {
            "email": "ops-admin@example.com",
            "name": "运营管理员",
            "password": "password456",
            "status": "ACTIVE",
            "role_codes": ["warehouse", "support", "warehouse"],
        },
        HTTP_AUTHORIZATION=f"Bearer {token}",
        content_type="application/json",
    )

    assert response.status_code == 201
    data = response.json()["data"]
    assert data["email"] == "ops-admin@example.com"
    assert data["is_super_admin"] is False
    assert data["roles"] == ["warehouse", "support"]
    login_created = admin_login(client, email="ops-admin@example.com", password="password456")
    assert login_created.status_code == 200


def test_super_admin_can_update_admin_account_roles_status_and_password(client, seeded_iam):
    login_response = admin_login(client)
    token = login_response.json()["data"]["access_token"]
    account = AdminUser.objects.get(email="buyer@example.com")

    response = client.patch(
        reverse("admin-account-detail", kwargs={"admin_id": account.id}),
        {
            "name": "采购与财务",
            "status": "DISABLED",
            "password": "password789",
            "role_codes": ["finance"],
        },
        HTTP_AUTHORIZATION=f"Bearer {token}",
        content_type="application/json",
    )

    assert response.status_code == 200
    data = response.json()["data"]
    assert data["name"] == "采购与财务"
    assert data["status"] == "DISABLED"
    assert data["roles"] == ["finance"]
    assert admin_login(client, email="buyer@example.com", password="password789").status_code == 403


def test_admin_account_write_rejects_missing_role_code(client, seeded_iam):
    login_response = admin_login(client)
    token = login_response.json()["data"]["access_token"]

    response = client.post(
        reverse("admin-accounts"),
        {
            "email": "bad-admin@example.com",
            "name": "错误管理员",
            "password": "password456",
            "role_codes": ["missing_role"],
        },
        HTTP_AUTHORIZATION=f"Bearer {token}",
        content_type="application/json",
    )

    assert response.status_code == 400
    assert response.json()["code"] == "VALIDATION_ERROR"


def test_admin_account_write_rejects_super_admin_role_assignment(client, seeded_iam):
    login_response = admin_login(client)
    token = login_response.json()["data"]["access_token"]

    response = client.post(
        reverse("admin-accounts"),
        {
            "email": "privileged-admin@example.com",
            "name": "越权管理员",
            "password": "password456",
            "role_codes": ["super_admin"],
        },
        HTTP_AUTHORIZATION=f"Bearer {token}",
        content_type="application/json",
    )

    assert response.status_code == 400
    assert response.json()["code"] == "VALIDATION_ERROR"


def test_admin_viewer_without_manage_cannot_write_admin_accounts(client, seeded_iam):
    warehouse_role = Role.objects.get(code="warehouse")
    warehouse_role.permissions.add(Permission.objects.get(code="iam.admin.view"))
    login_response = admin_login(client, email="warehouse@example.com")
    token = login_response.json()["data"]["access_token"]

    list_response = client.get(reverse("admin-accounts"), HTTP_AUTHORIZATION=f"Bearer {token}")
    assert list_response.status_code == 200

    response = client.post(
        reverse("admin-accounts"),
        {
            "email": "viewer-admin@example.com",
            "name": "只读管理员",
            "password": "password456",
            "role_codes": ["warehouse"],
        },
        HTTP_AUTHORIZATION=f"Bearer {token}",
        content_type="application/json",
    )

    assert response.status_code == 403
    assert response.json()["code"] == "FORBIDDEN"


def test_super_admin_account_is_protected_from_update(client, seeded_iam):
    login_response = admin_login(client)
    token = login_response.json()["data"]["access_token"]
    account = AdminUser.objects.get(email="admin@example.com")

    response = client.patch(
        reverse("admin-account-detail", kwargs={"admin_id": account.id}),
        {"name": "bad", "role_codes": ["warehouse"]},
        HTTP_AUTHORIZATION=f"Bearer {token}",
        content_type="application/json",
    )

    assert response.status_code == 400
    assert response.json()["code"] == "VALIDATION_ERROR"


def test_admin_manager_cannot_modify_self_lockout_fields(client, seeded_iam):
    manager_role = Role.objects.create(code="iam_manager", name="IAM 管理员")
    manager_role.permissions.set(
        Permission.objects.filter(code__in=["dashboard.view", "iam.admin.view", "iam.admin.manage"])
    )
    manager = AdminUser.objects.create(
        email="iam-manager@example.com",
        name="IAM 管理员",
        password_hash=make_password("password456"),
    )
    manager.roles.set([manager_role])
    login_response = admin_login(client, email="iam-manager@example.com", password="password456")
    token = login_response.json()["data"]["access_token"]

    response = client.patch(
        reverse("admin-account-detail", kwargs={"admin_id": manager.id}),
        {"status": "DISABLED", "role_codes": ["warehouse"]},
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
