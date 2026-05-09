import pytest
from django.contrib.auth.hashers import make_password
from django.core.files.uploadedfile import SimpleUploadedFile
from django.urls import reverse

from apps.files.models import FileUsage
from apps.iam.models import AdminUser, Permission, Role
from apps.iam.services import seed_iam_demo_data
from apps.members.services import issue_member_access_token, register_user, seed_member_demo_data
from apps.tickets.models import Ticket, TicketStatus


@pytest.fixture
def seeded_tickets(db):
    seed_iam_demo_data()
    seed_member_demo_data()


def member_token(client, email="user@example.com", password="password123"):
    response = client.post(
        reverse("member-login"),
        {"email": email, "password": password},
        content_type="application/json",
    )
    return response.json()["data"]["access_token"]


def admin_token(client, email="support@example.com", password="password123"):
    response = client.post(
        reverse("admin-login"),
        {"email": email, "password": password},
        content_type="application/json",
    )
    return response.json()["data"]["access_token"]


def create_admin_with_permissions(email: str, permission_codes: list[str]) -> AdminUser:
    role = Role.objects.create(code=email.split("@", maxsplit=1)[0].replace(".", "_"), name=email)
    role.permissions.set(Permission.objects.filter(code__in=permission_codes))
    admin = AdminUser.objects.create(
        email=email,
        name=email,
        password_hash=make_password("password123"),
    )
    admin.roles.set([role])
    return admin


def image_upload(name="message.jpg", content=b"message-file", content_type="image/jpeg"):
    return SimpleUploadedFile(name, content, content_type=content_type)


def upload_member_message_attachment(client, token, name="member-message.jpg"):
    response = client.post(
        reverse("file-list"),
        {"usage": FileUsage.MESSAGE_ATTACHMENT, "file": image_upload(name)},
        HTTP_AUTHORIZATION=f"Bearer {token}",
    )
    assert response.status_code == 201
    return response.json()["data"]["file_id"]


def upload_admin_message_attachment(client, token, name="admin-message.jpg"):
    response = client.post(
        reverse("admin-file-list"),
        {"usage": FileUsage.MESSAGE_ATTACHMENT, "file": image_upload(name)},
        HTTP_AUTHORIZATION=f"Bearer {token}",
    )
    assert response.status_code == 201
    return response.json()["data"]["file_id"]


def create_ticket(client, token, **overrides):
    payload = {
        "type": "GENERAL",
        "title": "包裹咨询",
        "content": "请帮我确认包裹入库情况",
        **overrides,
    }
    return client.post(
        reverse("ticket-list"),
        payload,
        content_type="application/json",
        HTTP_AUTHORIZATION=f"Bearer {token}",
    )


def test_member_creates_ticket_with_own_message_attachment(client, seeded_tickets):
    token = member_token(client)
    file_id = upload_member_message_attachment(client, token)

    response = create_ticket(client, token, file_id=file_id)

    assert response.status_code == 201
    data = response.json()["data"]
    assert data["ticket_no"].startswith("TKT")
    assert data["status"] == TicketStatus.OPEN
    assert data["messages"][0]["sender_type"] == "MEMBER"
    assert data["messages"][0]["file_id"] == file_id
    assert data["messages"][0]["file_download_url"] == f"/api/v1/files/{file_id}/download"


def test_member_cannot_create_ticket_with_other_members_attachment(client, seeded_tickets):
    owner = register_user("ticket-owner@example.com", "password123")
    other = register_user("ticket-other@example.com", "password123")
    owner_token = issue_member_access_token(owner)
    other_token = issue_member_access_token(other)
    file_id = upload_member_message_attachment(client, owner_token)

    response = create_ticket(client, other_token, file_id=file_id)

    assert response.status_code == 400
    assert response.json()["code"] == "VALIDATION_ERROR"
    assert Ticket.objects.count() == 0


def test_member_lists_and_reads_only_own_tickets(client, seeded_tickets):
    user_token = member_token(client)
    other = register_user("ticket-list-other@example.com", "password123")
    other_token = issue_member_access_token(other)
    own_ticket_id = create_ticket(client, user_token, title="我的工单").json()["data"]["id"]
    other_ticket_id = create_ticket(client, other_token, title="别人账号").json()["data"]["id"]

    list_response = client.get(reverse("ticket-list"), HTTP_AUTHORIZATION=f"Bearer {user_token}")
    other_detail = client.get(
        reverse("ticket-detail", kwargs={"ticket_id": other_ticket_id}),
        HTTP_AUTHORIZATION=f"Bearer {user_token}",
    )

    assert list_response.status_code == 200
    items = list_response.json()["data"]["items"]
    assert [item["id"] for item in items] == [own_ticket_id]
    assert other_detail.status_code == 404


def test_admin_support_replies_closes_and_member_reads_reply_attachment(client, seeded_tickets):
    user_token = member_token(client)
    support_token = admin_token(client)
    ticket_id = create_ticket(client, user_token).json()["data"]["id"]
    admin_file_id = upload_admin_message_attachment(client, support_token)

    processing = client.post(
        reverse("admin-ticket-mark-processing", kwargs={"ticket_id": ticket_id}),
        HTTP_AUTHORIZATION=f"Bearer {support_token}",
    )
    reply = client.post(
        reverse("admin-ticket-reply", kwargs={"ticket_id": ticket_id}),
        {"content": "已经帮你登记处理", "file_id": admin_file_id},
        content_type="application/json",
        HTTP_AUTHORIZATION=f"Bearer {support_token}",
    )
    close = client.post(
        reverse("admin-ticket-close", kwargs={"ticket_id": ticket_id}),
        {"content": "问题已处理完成"},
        content_type="application/json",
        HTTP_AUTHORIZATION=f"Bearer {support_token}",
    )
    member_detail = client.get(
        reverse("ticket-detail", kwargs={"ticket_id": ticket_id}),
        HTTP_AUTHORIZATION=f"Bearer {user_token}",
    )
    member_download = client.get(
        reverse("file-download", kwargs={"file_id": admin_file_id}),
        HTTP_AUTHORIZATION=f"Bearer {user_token}",
    )

    assert processing.status_code == 200
    assert processing.json()["data"]["status"] == TicketStatus.PROCESSING
    assert reply.status_code == 200
    assert reply.json()["data"]["messages"][-1]["file_id"] == admin_file_id
    assert close.status_code == 200
    assert close.json()["data"]["status"] == TicketStatus.CLOSED
    assert member_detail.status_code == 200
    assert member_detail.json()["data"]["messages"][-2]["file_download_url"] == f"/api/v1/files/{admin_file_id}/download"
    assert member_download.status_code == 200


def test_member_cannot_reply_closed_ticket(client, seeded_tickets):
    user_token = member_token(client)
    support_token = admin_token(client)
    ticket_id = create_ticket(client, user_token).json()["data"]["id"]
    client.post(
        reverse("admin-ticket-close", kwargs={"ticket_id": ticket_id}),
        {"content": "已关闭"},
        content_type="application/json",
        HTTP_AUTHORIZATION=f"Bearer {support_token}",
    )

    response = client.post(
        reverse("ticket-message-create", kwargs={"ticket_id": ticket_id}),
        {"content": "我还想补充"},
        content_type="application/json",
        HTTP_AUTHORIZATION=f"Bearer {user_token}",
    )

    assert response.status_code == 409
    assert response.json()["code"] == "STATE_CONFLICT"


def test_admin_ticket_api_requires_ticket_permission(client, seeded_tickets):
    token = admin_token(client, email="finance@example.com")

    response = client.get(reverse("admin-ticket-list"), HTTP_AUTHORIZATION=f"Bearer {token}")

    assert response.status_code == 403
    assert response.json()["code"] == "FORBIDDEN"


def test_ticket_viewer_without_manage_cannot_process_or_reply(client, seeded_tickets):
    member = member_token(client)
    ticket = create_ticket(client, member).json()["data"]
    create_admin_with_permissions("ticket-viewer@example.com", ["dashboard.view", "tickets.view"])
    token = admin_token(client, email="ticket-viewer@example.com")

    list_response = client.get(reverse("admin-ticket-list"), HTTP_AUTHORIZATION=f"Bearer {token}")
    process_response = client.post(
        reverse("admin-ticket-mark-processing", kwargs={"ticket_id": ticket["id"]}),
        HTTP_AUTHORIZATION=f"Bearer {token}",
    )
    reply_response = client.post(
        reverse("admin-ticket-reply", kwargs={"ticket_id": ticket["id"]}),
        {"content": "只读不能回复"},
        content_type="application/json",
        HTTP_AUTHORIZATION=f"Bearer {token}",
    )

    assert list_response.status_code == 200
    assert process_response.status_code == 403
    assert reply_response.status_code == 403
    assert Ticket.objects.get(id=ticket["id"]).status == TicketStatus.OPEN
