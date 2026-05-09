import pytest
from django.urls import reverse

from apps.iam.services import seed_iam_demo_data
from apps.members.models import MemberProfile, User
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
            "password": "password123",
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
        {"current_password": "password123", "new_password": "new-password123"},
        content_type="application/json",
        HTTP_AUTHORIZATION=f"Bearer {token}",
    )

    assert response.status_code == 200
    assert response.json()["data"]["changed"] is True
    assert member_login(client).status_code == 403
    assert member_login(client, password="new-password123").status_code == 200


def test_member_change_password_rejects_wrong_current_password(client, seeded_member):
    token = member_login(client).json()["data"]["access_token"]

    response = client.post(
        reverse("member-password"),
        {"current_password": "wrong-password", "new_password": "new-password123"},
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
