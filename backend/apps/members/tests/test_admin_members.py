import pytest
from django.contrib.auth.hashers import make_password
from django.urls import reverse

from apps.iam.models import AdminUser
from apps.iam.services import seed_iam_demo_data
from apps.members.models import MemberProfile, User, UserStatus
from apps.members.services import seed_member_demo_data
from apps.tickets.services import create_ticket


@pytest.fixture
def seeded_admin_members(db):
    seed_iam_demo_data()
    seed_member_demo_data()


def admin_login(client, email="admin@example.com", password="password123"):
    return client.post(
        reverse("admin-login"),
        {"email": email, "password": password},
        content_type="application/json",
    )


def member_login(client, email="user@example.com", password="password123"):
    return client.post(
        reverse("member-login"),
        {"email": email, "password": password},
        content_type="application/json",
    )


def admin_token(client, email="admin@example.com"):
    return admin_login(client, email=email).json()["data"]["access_token"]


def test_admin_can_list_filter_and_read_member_detail(client, seeded_admin_members):
    user = User.objects.select_related("profile").get(email="user@example.com")
    create_ticket(user=user, type="GENERAL", title="会员服务咨询", content="需要客服处理")
    token = admin_token(client)

    response = client.get(
        reverse("admin-members"),
        {"keyword": user.profile.member_no, "status": UserStatus.ACTIVE, "level": "basic"},
        HTTP_AUTHORIZATION=f"Bearer {token}",
    )

    assert response.status_code == 200
    body = response.json()
    assert body["code"] == "OK"
    assert len(body["data"]["items"]) == 1
    member = body["data"]["items"][0]
    assert member["email"] == "user@example.com"
    assert member["profile"]["warehouse_code"].startswith("CB")
    assert member["service_summary"]["ticket_count"] == 1
    assert member["service_summary"]["open_ticket_count"] == 1

    detail_response = client.get(
        reverse("admin-member-detail", kwargs={"user_id": user.id}),
        HTTP_AUTHORIZATION=f"Bearer {token}",
    )
    assert detail_response.status_code == 200
    assert detail_response.json()["data"]["id"] == user.id


def test_support_can_update_member_profile_and_assignment(client, seeded_admin_members):
    user = User.objects.get(email="user@example.com")
    support = AdminUser.objects.get(email="support@example.com")
    token = admin_token(client, email="support@example.com")

    response = client.patch(
        reverse("admin-member-detail", kwargs={"user_id": user.id}),
        {
            "display_name": "VIP 测试用户",
            "phone": "13900001111",
            "level": "vip",
            "assigned_admin_id": support.id,
            "service_note": "TODO_CONFIRM: 客服分配规则待确认，当前手动维护。",
        },
        content_type="application/json",
        HTTP_AUTHORIZATION=f"Bearer {token}",
    )

    assert response.status_code == 200
    data = response.json()["data"]
    assert data["phone"] == "13900001111"
    assert data["profile"]["display_name"] == "VIP 测试用户"
    assert data["profile"]["level"] == "vip"
    assert data["profile"]["assigned_admin_id"] == support.id
    assert "TODO_CONFIRM" in data["profile"]["service_note"]


def test_member_me_does_not_expose_admin_service_note(client, seeded_admin_members):
    user = User.objects.get(email="user@example.com")
    support = AdminUser.objects.get(email="support@example.com")
    token = admin_token(client)
    client.patch(
        reverse("admin-member-detail", kwargs={"user_id": user.id}),
        {
            "assigned_admin_id": support.id,
            "service_note": "内部客服备注",
        },
        content_type="application/json",
        HTTP_AUTHORIZATION=f"Bearer {token}",
    )
    member_token = member_login(client).json()["data"]["access_token"]

    response = client.get(reverse("member-me"), HTTP_AUTHORIZATION=f"Bearer {member_token}")

    assert response.status_code == 200
    assert "service_note" not in response.json()["data"]["profile"]
    assert "assigned_admin_id" not in response.json()["data"]["profile"]


def test_member_management_requires_members_permission(client, seeded_admin_members):
    token = admin_token(client, email="finance@example.com")

    response = client.get(reverse("admin-members"), HTTP_AUTHORIZATION=f"Bearer {token}")

    assert response.status_code == 403
    assert response.json()["code"] == "FORBIDDEN"


def test_freeze_blocks_existing_member_token_and_unfreeze_restores_access(client, seeded_admin_members):
    user = User.objects.get(email="user@example.com")
    member_token = member_login(client).json()["data"]["access_token"]
    admin = admin_token(client)

    freeze_response = client.post(
        reverse("admin-member-freeze", kwargs={"user_id": user.id}),
        HTTP_AUTHORIZATION=f"Bearer {admin}",
    )
    assert freeze_response.status_code == 200
    assert freeze_response.json()["data"]["status"] == UserStatus.FROZEN

    blocked_response = client.get(reverse("member-me"), HTTP_AUTHORIZATION=f"Bearer {member_token}")
    assert blocked_response.status_code == 403
    assert blocked_response.json()["code"] == "FORBIDDEN"

    unfreeze_response = client.post(
        reverse("admin-member-unfreeze", kwargs={"user_id": user.id}),
        HTTP_AUTHORIZATION=f"Bearer {admin}",
    )
    assert unfreeze_response.status_code == 200
    assert unfreeze_response.json()["data"]["status"] == UserStatus.ACTIVE

    restored_response = client.get(reverse("member-me"), HTTP_AUTHORIZATION=f"Bearer {member_token}")
    assert restored_response.status_code == 200


def test_reset_member_test_password_allows_login_with_new_password(client, seeded_admin_members):
    user = User.objects.get(email="user@example.com")
    user.password_hash = make_password("old-password123")
    user.save(update_fields=["password_hash", "updated_at"])
    admin = admin_token(client)

    response = client.post(
        reverse("admin-member-reset-password", kwargs={"user_id": user.id}),
        {"password": "new-password123"},
        content_type="application/json",
        HTTP_AUTHORIZATION=f"Bearer {admin}",
    )

    assert response.status_code == 200
    old_login = member_login(client, password="old-password123")
    assert old_login.status_code in {401, 403}
    assert old_login.json()["code"] == "UNAUTHORIZED"
    assert member_login(client, password="new-password123").status_code == 200


def test_service_admin_options_only_include_member_managers(client, seeded_admin_members):
    token = admin_token(client)

    response = client.get(reverse("admin-member-service-admins"), HTTP_AUTHORIZATION=f"Bearer {token}")

    assert response.status_code == 200
    emails = {item["email"] for item in response.json()["data"]["items"]}
    assert {"admin@example.com", "support@example.com"} <= emails
    assert "finance@example.com" not in emails
