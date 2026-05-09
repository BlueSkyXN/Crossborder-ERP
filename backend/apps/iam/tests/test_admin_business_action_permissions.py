import pytest
from django.contrib.auth.hashers import make_password
from django.urls import reverse

from apps.iam.models import AdminUser, Permission, Role
from apps.iam.services import issue_admin_access_token, seed_iam_demo_data


@pytest.fixture
def seeded_actions(db):
    seed_iam_demo_data()


def auth(admin_user: AdminUser) -> dict[str, str]:
    return {"HTTP_AUTHORIZATION": f"Bearer {issue_admin_access_token(admin_user)}"}


def make_admin_with_permissions(email: str, permission_codes: list[str]) -> AdminUser:
    role = Role.objects.create(code=email.split("@")[0].replace(".", "_"), name=email)
    role.permissions.set(Permission.objects.filter(code__in=permission_codes))
    admin_user = AdminUser.objects.create(
        email=email,
        name=email,
        password_hash=make_password("password123"),
    )
    admin_user.roles.set([role])
    return admin_user


def test_seeded_roles_include_business_action_permissions(seeded_actions):
    super_admin = Role.objects.get(code="super_admin")
    assert {
        "members.manage",
        "warehouses.manage",
        "parcels.manage",
        "parcels.export",
        "waybills.manage",
        "finance.manage",
        "files.manage",
        "purchases.manage",
        "products.manage",
        "tickets.manage",
        "content.manage",
        "audit.logs.export",
        "growth.view",
        "growth.manage",
    }.issubset(set(super_admin.permissions.values_list("code", flat=True)))

    warehouse = Role.objects.get(code="warehouse")
    assert {"parcels.manage", "parcels.export", "waybills.manage", "files.manage"}.issubset(
        set(warehouse.permissions.values_list("code", flat=True))
    )

    finance = Role.objects.get(code="finance")
    assert {"finance.manage", "files.manage"}.issubset(set(finance.permissions.values_list("code", flat=True)))

    buyer = Role.objects.get(code="buyer")
    assert {"purchases.manage", "products.manage"}.issubset(set(buyer.permissions.values_list("code", flat=True)))

    support = Role.objects.get(code="support")
    assert {"tickets.manage", "files.manage"}.issubset(set(support.permissions.values_list("code", flat=True)))


def test_view_permission_can_read_but_cannot_write_business_endpoint(client, seeded_actions):
    admin_user = make_admin_with_permissions("parcel-viewer@example.com", ["parcels.view"])

    list_response = client.get(reverse("admin-parcel-list"), **auth(admin_user))
    write_response = client.post(
        reverse("admin-parcel-scan-inbound"),
        {},
        content_type="application/json",
        **auth(admin_user),
    )

    assert list_response.status_code == 200
    assert write_response.status_code == 403
    assert write_response.json()["code"] == "FORBIDDEN"


def test_manage_permission_can_reach_business_write_validation(client, seeded_actions):
    admin_user = make_admin_with_permissions(
        "parcel-manager@example.com",
        ["parcels.view", "parcels.manage"],
    )

    response = client.post(
        reverse("admin-parcel-scan-inbound"),
        {},
        content_type="application/json",
        **auth(admin_user),
    )

    assert response.status_code == 400
    assert response.json()["code"] == "VALIDATION_ERROR"


def test_finance_viewer_cannot_create_supplier_but_manager_can(client, seeded_actions):
    viewer = make_admin_with_permissions("finance-viewer@example.com", ["finance.view"])
    manager = make_admin_with_permissions("finance-manager@example.com", ["finance.view", "finance.manage"])
    payload = {"code": "RBAC-SUP", "name": "RBAC 供应商", "status": "ACTIVE"}

    viewer_response = client.post(reverse("admin-supplier-list"), payload, content_type="application/json", **auth(viewer))
    manager_response = client.post(
        reverse("admin-supplier-list"),
        payload,
        content_type="application/json",
        **auth(manager),
    )

    assert viewer_response.status_code == 403
    assert manager_response.status_code == 201
    assert manager_response.json()["data"]["code"] == "RBAC-SUP"


def test_export_requires_export_permission(client, seeded_actions):
    viewer = make_admin_with_permissions("audit-viewer@example.com", ["audit.logs.view"])
    exporter = make_admin_with_permissions(
        "audit-exporter@example.com",
        ["audit.logs.view", "audit.logs.export"],
    )

    list_response = client.get(reverse("admin-audit-log-list"), **auth(viewer))
    viewer_export_response = client.get(reverse("admin-audit-log-export"), **auth(viewer))
    exporter_response = client.get(reverse("admin-audit-log-export"), **auth(exporter))

    assert list_response.status_code == 200
    assert viewer_export_response.status_code == 403
    assert exporter_response.status_code == 200
    assert exporter_response["Content-Type"].startswith("text/csv")
