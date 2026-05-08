import pytest
from django.urls import reverse

from apps.addresses.models import Address
from apps.members.services import issue_member_access_token, register_user, seed_member_demo_data


@pytest.fixture
def seeded_addresses(db):
    seed_member_demo_data()


def member_token(client, email="user@example.com", password="password123"):
    response = client.post(
        reverse("member-login"),
        {"email": email, "password": password},
        content_type="application/json",
    )
    return response.json()["data"]["access_token"]


def address_payload(**overrides):
    payload = {
        "recipient_name": "Alice Receiver",
        "phone": "15500000000",
        "country": "US",
        "region": "CA",
        "city": "Los Angeles",
        "address_line": "100 Test Street",
        "postal_code": "90001",
        "company": "",
        "is_default": False,
    }
    payload.update(overrides)
    return payload


def test_member_address_crud_default_and_soft_delete(client, seeded_addresses):
    token = member_token(client)

    first_response = client.post(
        reverse("address-list"),
        address_payload(),
        content_type="application/json",
        HTTP_AUTHORIZATION=f"Bearer {token}",
    )
    assert first_response.status_code == 201
    first = first_response.json()["data"]
    assert first["recipient_name"] == "Alice Receiver"
    assert first["region"] == "CA Los Angeles"
    assert first["is_default"] is True

    second_response = client.post(
        reverse("address-list"),
        address_payload(recipient_name="Bob Receiver", address_line="200 Default Ave", is_default=True),
        content_type="application/json",
        HTTP_AUTHORIZATION=f"Bearer {token}",
    )
    assert second_response.status_code == 201
    second = second_response.json()["data"]
    assert second["is_default"] is True

    first_detail = client.get(
        reverse("address-detail", kwargs={"address_id": first["id"]}),
        HTTP_AUTHORIZATION=f"Bearer {token}",
    )
    assert first_detail.status_code == 200
    assert first_detail.json()["data"]["is_default"] is False

    update_response = client.put(
        reverse("address-detail", kwargs={"address_id": first["id"]}),
        address_payload(recipient_name="Alice Updated", address_line="101 Updated Street", is_default=True),
        content_type="application/json",
        HTTP_AUTHORIZATION=f"Bearer {token}",
    )
    assert update_response.status_code == 200
    assert update_response.json()["data"]["is_default"] is True

    set_default_response = client.post(
        reverse("address-set-default", kwargs={"address_id": second["id"]}),
        {},
        content_type="application/json",
        HTTP_AUTHORIZATION=f"Bearer {token}",
    )
    assert set_default_response.status_code == 200
    assert set_default_response.json()["data"]["is_default"] is True

    list_response = client.get(reverse("address-list"), HTTP_AUTHORIZATION=f"Bearer {token}")
    assert list_response.status_code == 200
    items = list_response.json()["data"]["items"]
    assert [item["id"] for item in items] == [second["id"], first["id"]]

    delete_response = client.delete(
        reverse("address-detail", kwargs={"address_id": second["id"]}),
        HTTP_AUTHORIZATION=f"Bearer {token}",
    )
    assert delete_response.status_code == 200
    deleted = Address.objects.get(id=second["id"])
    assert deleted.is_active is False
    assert deleted.is_default is False
    assert Address.objects.get(id=first["id"]).is_default is True


def test_member_cannot_access_other_users_address(client, seeded_addresses):
    owner_token = member_token(client)
    owner_response = client.post(
        reverse("address-list"),
        address_payload(),
        content_type="application/json",
        HTTP_AUTHORIZATION=f"Bearer {owner_token}",
    )
    address_id = owner_response.json()["data"]["id"]

    other_user = register_user("addr-other@example.com", "password123")
    other_token = issue_member_access_token(other_user)

    detail_response = client.get(
        reverse("address-detail", kwargs={"address_id": address_id}),
        HTTP_AUTHORIZATION=f"Bearer {other_token}",
    )
    assert detail_response.status_code == 404

    set_default_response = client.post(
        reverse("address-set-default", kwargs={"address_id": address_id}),
        {},
        content_type="application/json",
        HTTP_AUTHORIZATION=f"Bearer {other_token}",
    )
    assert set_default_response.status_code == 404
