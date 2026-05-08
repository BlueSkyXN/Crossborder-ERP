from __future__ import annotations

import uuid

from django.db import transaction
from django.utils import timezone
from rest_framework import exceptions

from apps.files.models import FileOwnerType, FileStatus, FileUsage, StoredFile
from apps.iam.models import AdminUser
from apps.members.models import User

from .models import Ticket, TicketMessage, TicketMessageSenderType, TicketStatus


class TicketStateConflictError(Exception):
    pass


def _build_ticket_no(ticket_id: int) -> str:
    return f"TKT{ticket_id:08d}"


def _assert_message_content(content: str) -> str:
    normalized = (content or "").strip()
    if not normalized:
        raise exceptions.ValidationError({"content": ["消息内容不能为空"]})
    return normalized


def _normalize_file_id(file_id: str | None) -> str:
    return (file_id or "").strip()


def _assert_member_message_attachment(*, user: User, file_id: str | None) -> str:
    normalized = _normalize_file_id(file_id)
    if not normalized:
        return ""
    try:
        stored_file = StoredFile.objects.get(file_id=normalized, status=FileStatus.ACTIVE)
    except StoredFile.DoesNotExist as exc:
        raise exceptions.NotFound("附件不存在") from exc

    if (
        stored_file.owner_type != FileOwnerType.MEMBER
        or stored_file.uploaded_by_member_id != user.id
        or stored_file.usage != FileUsage.MESSAGE_ATTACHMENT
    ):
        raise exceptions.ValidationError({"file_id": ["附件无效"]})
    return stored_file.file_id


def _assert_admin_message_attachment(*, admin_user: AdminUser, file_id: str | None) -> str:
    normalized = _normalize_file_id(file_id)
    if not normalized:
        return ""
    try:
        stored_file = StoredFile.objects.get(file_id=normalized, status=FileStatus.ACTIVE)
    except StoredFile.DoesNotExist as exc:
        raise exceptions.NotFound("附件不存在") from exc

    if (
        stored_file.owner_type != FileOwnerType.ADMIN
        or stored_file.uploaded_by_admin_id != admin_user.id
        or stored_file.usage != FileUsage.MESSAGE_ATTACHMENT
    ):
        raise exceptions.ValidationError({"file_id": ["附件无效"]})
    return stored_file.file_id


def ticket_queryset():
    return (
        Ticket.objects.select_related("user", "handled_by")
        .prefetch_related("messages", "messages__member", "messages__admin_user")
    )


def get_member_ticket(*, user: User, ticket_id: int) -> Ticket:
    try:
        return ticket_queryset().get(id=ticket_id, user=user)
    except Ticket.DoesNotExist as exc:
        raise exceptions.NotFound("工单不存在") from exc


def get_admin_ticket(*, ticket_id: int) -> Ticket:
    try:
        return ticket_queryset().get(id=ticket_id)
    except Ticket.DoesNotExist as exc:
        raise exceptions.NotFound("工单不存在") from exc


@transaction.atomic
def create_ticket(*, user: User, type: str, title: str, content: str, file_id: str = "") -> Ticket:
    normalized_title = (title or "").strip()
    if not normalized_title:
        raise exceptions.ValidationError({"title": ["工单标题不能为空"]})
    normalized_content = _assert_message_content(content)
    attachment_file_id = _assert_member_message_attachment(user=user, file_id=file_id)
    now = timezone.now()

    ticket = Ticket.objects.create(
        ticket_no=f"TMP{uuid.uuid4().hex[:20]}",
        user=user,
        type=type,
        title=normalized_title,
        status=TicketStatus.OPEN,
        last_message_at=now,
    )
    ticket.ticket_no = _build_ticket_no(ticket.id)
    ticket.save(update_fields=["ticket_no", "updated_at"])
    TicketMessage.objects.create(
        ticket=ticket,
        sender_type=TicketMessageSenderType.MEMBER,
        member=user,
        content=normalized_content,
        file_id=attachment_file_id,
    )
    return get_member_ticket(user=user, ticket_id=ticket.id)


@transaction.atomic
def add_member_message(*, ticket: Ticket, user: User, content: str, file_id: str = "") -> Ticket:
    locked = Ticket.objects.select_for_update().get(id=ticket.id)
    if locked.user_id != user.id:
        raise exceptions.NotFound("工单不存在")
    if locked.status == TicketStatus.CLOSED:
        raise TicketStateConflictError("工单已关闭，不能继续回复")
    normalized_content = _assert_message_content(content)
    attachment_file_id = _assert_member_message_attachment(user=user, file_id=file_id)
    TicketMessage.objects.create(
        ticket=locked,
        sender_type=TicketMessageSenderType.MEMBER,
        member=user,
        content=normalized_content,
        file_id=attachment_file_id,
    )
    locked.last_message_at = timezone.now()
    locked.save(update_fields=["last_message_at", "updated_at"])
    return get_member_ticket(user=user, ticket_id=locked.id)


@transaction.atomic
def mark_ticket_processing(*, ticket: Ticket, operator: AdminUser) -> Ticket:
    locked = Ticket.objects.select_for_update().get(id=ticket.id)
    if locked.status == TicketStatus.CLOSED:
        raise TicketStateConflictError("工单已关闭，不能标记处理中")
    locked.status = TicketStatus.PROCESSING
    locked.handled_by = operator
    locked.save(update_fields=["status", "handled_by", "updated_at"])
    return get_admin_ticket(ticket_id=locked.id)


@transaction.atomic
def add_admin_reply(*, ticket: Ticket, operator: AdminUser, content: str, file_id: str = "") -> Ticket:
    locked = Ticket.objects.select_for_update().get(id=ticket.id)
    if locked.status == TicketStatus.CLOSED:
        raise TicketStateConflictError("工单已关闭，不能继续回复")
    normalized_content = _assert_message_content(content)
    attachment_file_id = _assert_admin_message_attachment(admin_user=operator, file_id=file_id)
    TicketMessage.objects.create(
        ticket=locked,
        sender_type=TicketMessageSenderType.ADMIN,
        admin_user=operator,
        content=normalized_content,
        file_id=attachment_file_id,
    )
    locked.status = TicketStatus.PROCESSING
    locked.handled_by = operator
    locked.last_message_at = timezone.now()
    locked.save(update_fields=["status", "handled_by", "last_message_at", "updated_at"])
    return get_admin_ticket(ticket_id=locked.id)


@transaction.atomic
def close_ticket(*, ticket: Ticket, operator: AdminUser, content: str = "") -> Ticket:
    locked = Ticket.objects.select_for_update().get(id=ticket.id)
    if locked.status == TicketStatus.CLOSED:
        raise TicketStateConflictError("工单已关闭，不能重复关闭")
    now = timezone.now()
    normalized_content = (content or "").strip()
    if normalized_content:
        TicketMessage.objects.create(
            ticket=locked,
            sender_type=TicketMessageSenderType.ADMIN,
            admin_user=operator,
            content=normalized_content,
        )
        locked.last_message_at = now
    locked.status = TicketStatus.CLOSED
    locked.handled_by = operator
    locked.closed_at = now
    locked.save(update_fields=["status", "handled_by", "closed_at", "last_message_at", "updated_at"])
    return get_admin_ticket(ticket_id=locked.id)
