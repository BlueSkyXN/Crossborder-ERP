from datetime import timedelta

import pytest
from django.test import override_settings
from django.urls import reverse
from django.utils import timezone

from apps.iam.services import seed_iam_demo_data
from apps.members.models import MemberProfile, PasswordResetToken, User
from apps.members.services import seed_member_demo_data


@pytest.fixture
def seeded_member(db):
    seed_member_demo_data()


def member_login(client, email="user@example.com", password="password123"):
    return client.post(
        reverse("member-login"),
        {"email": email, "password": password},
        content_type="application/json",
    )


def test_register_creates_user_and_member_profile(client, db):
    response = client.post(
        reverse("member-register"),
        {
            "email": "new-user@example.com",
            "password": "TestPass123",
            "display_name": "新用户",
            "phone": "13800000000",
        },
        content_type="application/json",
    )

    assert response.status_code == 201
    body = response.json()
    assert body["code"] == "OK"
    assert body["data"]["email"] == "new-user@example.com"
    assert body["data"]["profile"]["member_no"].startswith("M")
    assert body["data"]["profile"]["warehouse_code"].startswith("CB")


def test_test_user_can_login(client, seeded_member):
    response = member_login(client)

    assert response.status_code == 200
    body = response.json()
    assert body["code"] == "OK"
    assert body["data"]["access_token"]
    assert body["data"]["user"]["email"] == "user@example.com"


def test_me_returns_profile_and_warehouse_code(client, seeded_member):
    token = member_login(client).json()["data"]["access_token"]

    response = client.get(reverse("member-me"), HTTP_AUTHORIZATION=f"Bearer {token}")

    assert response.status_code == 200
    body = response.json()
    assert body["data"]["profile"]["member_no"]
    assert body["data"]["profile"]["warehouse_code"]


def test_update_profile_only_updates_current_user(client, seeded_member):
    other = User.objects.create(email="other@example.com", password_hash="x")
    MemberProfile.objects.create(
        user=other,
        member_no="M999999",
        display_name="Other",
        warehouse_code="CB999999",
    )
    token = member_login(client).json()["data"]["access_token"]

    response = client.put(
        reverse("member-profile"),
        {"display_name": "Updated", "phone": "13900000000"},
        content_type="application/json",
        HTTP_AUTHORIZATION=f"Bearer {token}",
    )

    assert response.status_code == 200
    assert response.json()["data"]["profile"]["display_name"] == "Updated"
    clear_response = client.put(
        reverse("member-profile"),
        {"display_name": "", "phone": ""},
        content_type="application/json",
        HTTP_AUTHORIZATION=f"Bearer {token}",
    )
    assert clear_response.status_code == 200
    assert clear_response.json()["data"]["profile"]["display_name"] == ""
    assert clear_response.json()["data"]["phone"] == ""
    other.refresh_from_db()
    assert other.profile.display_name == "Other"


def test_member_can_change_password_and_login_with_new_password(client, seeded_member):
    token = member_login(client).json()["data"]["access_token"]

    response = client.post(
        reverse("member-password"),
        {"current_password": "password123", "new_password": "NewPass123"},
        content_type="application/json",
        HTTP_AUTHORIZATION=f"Bearer {token}",
    )

    assert response.status_code == 200
    assert response.json()["data"]["changed"] is True
    assert member_login(client).status_code == 403
    assert member_login(client, password="NewPass123").status_code == 200


@override_settings(MEMBER_PASSWORD_RESET_EXPOSE_TOKEN=True)
def test_member_can_reset_password_with_one_time_token(client, seeded_member):
    request_response = client.post(
        reverse("member-password-reset-request"),
        {"email": "user@example.com"},
        content_type="application/json",
        HTTP_USER_AGENT="pytest-agent",
    )

    assert request_response.status_code == 200
    request_body = request_response.json()["data"]
    reset_token = request_body["dev_reset_token"]
    stored_token = PasswordResetToken.objects.get(user__email="user@example.com")
    assert stored_token.token_hash != reset_token
    assert stored_token.user_agent == "pytest-agent"

    confirm_response = client.post(
        reverse("member-password-reset-confirm"),
        {"email": "user@example.com", "token": reset_token, "new_password": "ResetPass123"},
        content_type="application/json",
    )

    assert confirm_response.status_code == 200
    assert confirm_response.json()["data"]["reset"] is True
    stored_token.refresh_from_db()
    assert stored_token.consumed_at is not None
    assert member_login(client).status_code == 403
    assert member_login(client, password="ResetPass123").status_code == 200

    reuse_response = client.post(
        reverse("member-password-reset-confirm"),
        {"email": "user@example.com", "token": reset_token, "new_password": "AnotherPass123"},
        content_type="application/json",
    )
    assert reuse_response.status_code == 400
    assert "token" in reuse_response.json()["data"]["field_errors"]


@override_settings(MEMBER_PASSWORD_RESET_EXPOSE_TOKEN=True)
def test_member_password_reset_request_does_not_leak_unknown_email(client, seeded_member):
    response = client.post(
        reverse("member-password-reset-request"),
        {"email": "missing@example.com"},
        content_type="application/json",
    )

    assert response.status_code == 200
    body = response.json()["data"]
    assert body["requested"] is True
    assert "dev_reset_token" not in body
    assert PasswordResetToken.objects.count() == 0


@override_settings(MEMBER_PASSWORD_RESET_EXPOSE_TOKEN=True)
def test_member_password_reset_rejects_expired_token(client, seeded_member):
    request_response = client.post(
        reverse("member-password-reset-request"),
        {"email": "user@example.com"},
        content_type="application/json",
    )
    reset_token = request_response.json()["data"]["dev_reset_token"]
    PasswordResetToken.objects.update(expires_at=timezone.now() - timedelta(minutes=1))

    response = client.post(
        reverse("member-password-reset-confirm"),
        {"email": "user@example.com", "token": reset_token, "new_password": "ResetPass123"},
        content_type="application/json",
    )

    assert response.status_code == 400
    assert "token" in response.json()["data"]["field_errors"]
    assert member_login(client).status_code == 200


def test_member_change_password_rejects_wrong_current_password(client, seeded_member):
    token = member_login(client).json()["data"]["access_token"]

    response = client.post(
        reverse("member-password"),
        {"current_password": "wrong-password", "new_password": "NewPass123"},
        content_type="application/json",
        HTTP_AUTHORIZATION=f"Bearer {token}",
    )

    assert response.status_code == 400
    assert "current_password" in response.json()["data"]["field_errors"]
    assert member_login(client).status_code == 200


def test_member_token_cannot_access_admin_api(client, seeded_member):
    token = member_login(client).json()["data"]["access_token"]

    response = client.get(reverse("admin-me"), HTTP_AUTHORIZATION=f"Bearer {token}")

    assert response.status_code == 401
    assert response.json()["code"] == "UNAUTHORIZED"


def test_admin_token_cannot_access_member_api(client, db):
    seed_iam_demo_data()
    admin_login = client.post(
        reverse("admin-login"),
        {"email": "admin@example.com", "password": "password123"},
        content_type="application/json",
    )
    token = admin_login.json()["data"]["access_token"]

    response = client.get(reverse("member-me"), HTTP_AUTHORIZATION=f"Bearer {token}")

    assert response.status_code == 401
    assert response.json()["code"] == "UNAUTHORIZED"


def test_seed_creates_required_demo_user(db):
    seed_member_demo_data()

    user = User.objects.get(email="user@example.com")
    assert user.profile.member_no
    assert user.profile.warehouse_code


def test_member_old_token_rejected_after_password_change_and_new_login_works(client, seeded_member):
    old_token = member_login(client).json()["data"]["access_token"]

    response = client.post(
        reverse("member-password"),
        {"current_password": "password123", "new_password": "TokenPass123"},
        content_type="application/json",
        HTTP_AUTHORIZATION=f"Bearer {old_token}",
    )
    assert response.status_code == 200

    old_token_response = client.get(reverse("member-me"), HTTP_AUTHORIZATION=f"Bearer {old_token}")
    assert old_token_response.status_code == 401
    assert old_token_response.json()["code"] == "UNAUTHORIZED"

    new_login = member_login(client, password="TokenPass123")
    assert new_login.status_code == 200
    new_token = new_login.json()["data"]["access_token"]
    assert client.get(reverse("member-me"), HTTP_AUTHORIZATION=f"Bearer {new_token}").status_code == 200


def test_frozen_member_login_uses_same_error_as_wrong_password(client, seeded_member):
    user = User.objects.get(email="user@example.com")
    user.status = "FROZEN"
    user.save(update_fields=["status", "updated_at"])

    frozen_response = member_login(client)
    wrong_password_response = member_login(client, password="WrongPass123")

    assert frozen_response.status_code == wrong_password_response.status_code
    assert frozen_response.json()["code"] == wrong_password_response.json()["code"] == "UNAUTHORIZED"
    assert frozen_response.json()["message"] == wrong_password_response.json()["message"]
