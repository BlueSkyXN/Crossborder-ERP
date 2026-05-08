from django.db import models


class TicketType(models.TextChoices):
    GENERAL = "GENERAL", "普通咨询"
    PARCEL = "PARCEL", "包裹问题"
    WAYBILL = "WAYBILL", "运单问题"
    PURCHASE = "PURCHASE", "代购问题"
    FINANCE = "FINANCE", "财务问题"
    ACCOUNT = "ACCOUNT", "账号问题"


class TicketStatus(models.TextChoices):
    OPEN = "OPEN", "待处理"
    PROCESSING = "PROCESSING", "处理中"
    CLOSED = "CLOSED", "已关闭"


class TicketMessageSenderType(models.TextChoices):
    MEMBER = "MEMBER", "会员"
    ADMIN = "ADMIN", "后台"


class Ticket(models.Model):
    ticket_no = models.CharField(max_length=30, unique=True)
    user = models.ForeignKey("members.User", on_delete=models.PROTECT, related_name="tickets")
    type = models.CharField(max_length=30, choices=TicketType.choices, default=TicketType.GENERAL)
    status = models.CharField(max_length=30, choices=TicketStatus.choices, default=TicketStatus.OPEN)
    title = models.CharField(max_length=160)
    handled_by = models.ForeignKey(
        "iam.AdminUser",
        on_delete=models.PROTECT,
        related_name="handled_tickets",
        null=True,
        blank=True,
    )
    closed_at = models.DateTimeField(null=True, blank=True)
    last_message_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "tickets"
        ordering = ["-id"]
        indexes = [
            models.Index(fields=["user", "status"], name="idx_tickets_user_status"),
            models.Index(fields=["status", "updated_at"], name="idx_tickets_status_updated"),
        ]

    def __str__(self) -> str:
        return self.ticket_no


class TicketMessage(models.Model):
    ticket = models.ForeignKey(Ticket, on_delete=models.CASCADE, related_name="messages")
    sender_type = models.CharField(max_length=20, choices=TicketMessageSenderType.choices)
    member = models.ForeignKey(
        "members.User",
        on_delete=models.PROTECT,
        related_name="ticket_messages",
        null=True,
        blank=True,
    )
    admin_user = models.ForeignKey(
        "iam.AdminUser",
        on_delete=models.PROTECT,
        related_name="ticket_messages",
        null=True,
        blank=True,
    )
    content = models.TextField()
    file_id = models.CharField(max_length=40, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "ticket_messages"
        ordering = ["id"]
        indexes = [
            models.Index(fields=["ticket", "created_at"], name="idx_ticket_messages_time"),
            models.Index(fields=["file_id"], name="idx_ticket_messages_file"),
        ]

    def __str__(self) -> str:
        return f"{self.ticket_id}:{self.sender_type}"
