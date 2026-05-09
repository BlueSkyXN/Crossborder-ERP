from decimal import Decimal

import pytest
from django.urls import reverse

from apps.finance.models import WalletTransaction
from apps.iam.services import seed_iam_demo_data
from apps.members.models import PointLedger, RebateRecord, ReferralRelation, User
from apps.members.services import register_user, seed_member_demo_data


@pytest.fixture
def seeded_growth(db):
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


def member_token(client, email="user@example.com"):
    return member_login(client, email=email).json()["data"]["access_token"]


def auth(token: str) -> dict[str, str]:
    return {"HTTP_AUTHORIZATION": f"Bearer {token}"}


def test_admin_can_adjust_points_and_member_can_read_summary(client, seeded_growth):
    user = User.objects.get(email="user@example.com")
    token = admin_token(client)

    increase = client.post(
        reverse("admin-member-point-adjust", kwargs={"user_id": user.id}),
        {"points_delta": 120, "remark": "TODO_CONFIRM: E2E 后台测试加分"},
        content_type="application/json",
        **auth(token),
    )
    assert increase.status_code == 201
    assert increase.json()["data"]["balance_after"] == 120

    decrease = client.post(
        reverse("admin-member-point-adjust", kwargs={"user_id": user.id}),
        {"points_delta": -20, "remark": "TODO_CONFIRM: E2E 后台测试扣分"},
        content_type="application/json",
        **auth(token),
    )
    assert decrease.status_code == 201
    assert decrease.json()["data"]["balance_after"] == 100

    member = member_token(client)
    summary = client.get(reverse("growth-summary"), **auth(member))
    assert summary.status_code == 200
    data = summary.json()["data"]
    assert data["points_balance"] == 100
    assert data["referral_code"] == user.profile.member_no
    assert "TODO_CONFIRM" in data["points_rule_note"]


def test_point_decrease_cannot_make_balance_negative(client, seeded_growth):
    user = User.objects.get(email="user@example.com")
    token = admin_token(client)

    response = client.post(
        reverse("admin-member-point-adjust", kwargs={"user_id": user.id}),
        {"points_delta": -1},
        content_type="application/json",
        **auth(token),
    )

    assert response.status_code == 400
    assert PointLedger.objects.count() == 0


def test_referral_rebate_reward_updates_points_without_wallet_transaction(client, seeded_growth):
    inviter = User.objects.get(email="user@example.com")
    invitee = register_user("invitee@example.com", "password123", display_name="被邀请会员")
    token = admin_token(client)

    referral_response = client.post(
        reverse("admin-growth-referral-list"),
        {
            "inviter_id": inviter.id,
            "invitee_id": invitee.id,
            "remark": "TODO_CONFIRM: E2E 手工邀请归因",
        },
        content_type="application/json",
        **auth(token),
    )
    assert referral_response.status_code == 201
    referral = referral_response.json()["data"]

    rebate_response = client.post(
        reverse("admin-growth-rebate-list"),
        {
            "referral_id": referral["id"],
            "amount": "12.50",
            "reward_points": 30,
            "business_type": "E2E_REFERRAL",
            "business_id": 1001,
            "remark": "TODO_CONFIRM: E2E 返利比例待确认",
        },
        content_type="application/json",
        **auth(token),
    )
    assert rebate_response.status_code == 201
    rebate = rebate_response.json()["data"]
    assert rebate["amount"] == "12.50"
    assert rebate["reward_points"] == 30
    assert rebate["status"] == "CONFIRMED"

    assert ReferralRelation.objects.count() == 1
    assert RebateRecord.objects.count() == 1
    assert PointLedger.objects.get(user=inviter).balance_after == 30
    assert WalletTransaction.objects.count() == 0

    detail = client.get(reverse("admin-member-growth-detail", kwargs={"user_id": inviter.id}), **auth(token))
    assert detail.status_code == 200
    summary = detail.json()["data"]["summary"]
    assert summary["points_balance"] == 30
    assert summary["confirmed_reward_points"] == 30
    assert Decimal(summary["confirmed_rebate_amount"]) == Decimal("12.50")


def test_referral_rejects_self_and_duplicate_rebate_source(client, seeded_growth):
    inviter = User.objects.get(email="user@example.com")
    invitee = register_user("invitee-dup@example.com", "password123")
    token = admin_token(client)

    self_response = client.post(
        reverse("admin-growth-referral-list"),
        {"inviter_id": inviter.id, "invitee_id": inviter.id},
        content_type="application/json",
        **auth(token),
    )
    assert self_response.status_code == 400

    referral = client.post(
        reverse("admin-growth-referral-list"),
        {"inviter_id": inviter.id, "invitee_id": invitee.id},
        content_type="application/json",
        **auth(token),
    ).json()["data"]
    payload = {
        "referral_id": referral["id"],
        "amount": "1.00",
        "business_type": "ORDER",
        "business_id": 1,
    }
    first = client.post(
        reverse("admin-growth-rebate-list"),
        payload,
        content_type="application/json",
        **auth(token),
    )
    duplicate = client.post(
        reverse("admin-growth-rebate-list"),
        payload,
        content_type="application/json",
        **auth(token),
    )

    assert first.status_code == 201
    assert duplicate.status_code == 400


def test_growth_admin_endpoints_require_member_permission(client, seeded_growth):
    finance_token = admin_token(client, email="finance@example.com")
    user = User.objects.get(email="user@example.com")

    response = client.get(reverse("admin-member-growth-detail", kwargs={"user_id": user.id}), **auth(finance_token))

    assert response.status_code == 403


def test_member_growth_lists_are_scoped_to_current_member(client, seeded_growth):
    user = User.objects.get(email="user@example.com")
    other = register_user("other-growth@example.com", "password123")
    admin = admin_token(client)
    client.post(
        reverse("admin-member-point-adjust", kwargs={"user_id": other.id}),
        {"points_delta": 55},
        content_type="application/json",
        **auth(admin),
    )

    response = client.get(reverse("growth-point-ledger-list"), **auth(member_token(client, email=user.email)))

    assert response.status_code == 200
    assert response.json()["data"]["items"] == []
