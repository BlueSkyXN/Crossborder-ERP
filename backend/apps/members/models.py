from django.db import models


class UserStatus(models.TextChoices):
    ACTIVE = "ACTIVE", "启用"
    FROZEN = "FROZEN", "冻结"


class PointTransactionType(models.TextChoices):
    REGISTRATION = "REGISTRATION", "注册赠送"
    MANUAL_ADJUSTMENT = "MANUAL_ADJUSTMENT", "后台调整"
    ORDER_REWARD = "ORDER_REWARD", "订单奖励"
    REBATE_REWARD = "REBATE_REWARD", "返利奖励"
    EXCHANGE_HOLD = "EXCHANGE_HOLD", "兑换占位"


class PointTransactionDirection(models.TextChoices):
    EARN = "EARN", "获得"
    SPEND = "SPEND", "扣减"


class ReferralStatus(models.TextChoices):
    PENDING = "PENDING", "待确认"
    ACTIVE = "ACTIVE", "有效"
    INVALID = "INVALID", "无效"


class RebateStatus(models.TextChoices):
    PENDING = "PENDING", "待确认"
    CONFIRMED = "CONFIRMED", "已确认"
    CANCELLED = "CANCELLED", "已取消"


class User(models.Model):
    email = models.EmailField(unique=True)
    phone = models.CharField(max_length=30, blank=True)
    password_hash = models.CharField(max_length=255)
    status = models.CharField(max_length=20, choices=UserStatus.choices, default=UserStatus.ACTIVE)
    last_login_at = models.DateTimeField(null=True, blank=True)
    password_changed_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "users"
        ordering = ["id"]

    def __str__(self) -> str:
        return self.email

    @property
    def is_active(self) -> bool:
        return self.status == UserStatus.ACTIVE

    @property
    def is_authenticated(self) -> bool:
        return True


class PasswordResetToken(models.Model):
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name="password_reset_tokens")
    token_hash = models.CharField(max_length=64, unique=True)
    expires_at = models.DateTimeField()
    consumed_at = models.DateTimeField(null=True, blank=True)
    requested_ip = models.GenericIPAddressField(null=True, blank=True)
    user_agent = models.CharField(max_length=255, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "password_reset_tokens"
        ordering = ["-id"]
        indexes = [
            models.Index(fields=["user", "expires_at"], name="idx_pwd_reset_user_expires"),
            models.Index(fields=["token_hash"], name="idx_pwd_reset_hash"),
        ]

    def __str__(self) -> str:
        return f"{self.user_id}:{self.expires_at.isoformat()}"


class MemberProfile(models.Model):
    user = models.OneToOneField(User, on_delete=models.CASCADE, related_name="profile")
    member_no = models.CharField(max_length=30, unique=True)
    display_name = models.CharField(max_length=100, blank=True)
    level = models.CharField(max_length=30, default="basic")
    warehouse_code = models.CharField(max_length=30, unique=True)
    assigned_service_admin = models.ForeignKey(
        "iam.AdminUser",
        on_delete=models.SET_NULL,
        related_name="assigned_member_profiles",
        null=True,
        blank=True,
    )
    service_note = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "member_profiles"
        ordering = ["id"]

    def __str__(self) -> str:
        return self.member_no


class PointLedger(models.Model):
    user = models.ForeignKey(User, on_delete=models.PROTECT, related_name="point_ledgers")
    operator = models.ForeignKey(
        "iam.AdminUser",
        on_delete=models.PROTECT,
        related_name="point_ledgers",
        null=True,
        blank=True,
    )
    type = models.CharField(max_length=30, choices=PointTransactionType.choices)
    direction = models.CharField(max_length=20, choices=PointTransactionDirection.choices)
    points = models.PositiveIntegerField()
    balance_after = models.PositiveIntegerField(default=0)
    business_type = models.CharField(max_length=50, blank=True)
    business_id = models.PositiveBigIntegerField(null=True, blank=True)
    remark = models.CharField(max_length=255, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "point_ledgers"
        ordering = ["-id"]
        indexes = [
            models.Index(fields=["user", "-id"], name="idx_point_ledgers_user_id"),
            models.Index(fields=["business_type", "business_id"], name="idx_point_ledgers_business"),
        ]

    def __str__(self) -> str:
        return f"{self.user_id}:{self.direction}:{self.points}"


class ReferralRelation(models.Model):
    inviter = models.ForeignKey(User, on_delete=models.PROTECT, related_name="referral_invites")
    invitee = models.ForeignKey(User, on_delete=models.PROTECT, related_name="invited_by_relations")
    invitation_code = models.CharField(max_length=40)
    status = models.CharField(max_length=20, choices=ReferralStatus.choices, default=ReferralStatus.ACTIVE)
    created_by_admin = models.ForeignKey(
        "iam.AdminUser",
        on_delete=models.PROTECT,
        related_name="created_referral_relations",
        null=True,
        blank=True,
    )
    remark = models.CharField(max_length=255, blank=True)
    activated_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "referral_relations"
        ordering = ["-id"]
        constraints = [
            models.UniqueConstraint(fields=["invitee"], name="uq_referral_invitee_once"),
            models.UniqueConstraint(fields=["inviter", "invitee"], name="uq_referral_inviter_invitee_once"),
            models.CheckConstraint(
                condition=~models.Q(inviter_id=models.F("invitee_id")),
                name="ck_referral_inviter_not_invitee",
            ),
        ]
        indexes = [
            models.Index(fields=["inviter", "status"], name="idx_referral_inviter_status"),
            models.Index(fields=["invitation_code"], name="idx_referral_invite_code"),
        ]

    def __str__(self) -> str:
        return f"{self.inviter_id}->{self.invitee_id}"


class RebateRecord(models.Model):
    user = models.ForeignKey(User, on_delete=models.PROTECT, related_name="rebate_records")
    referral_relation = models.ForeignKey(
        ReferralRelation,
        on_delete=models.PROTECT,
        related_name="rebate_records",
        null=True,
        blank=True,
    )
    amount = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    reward_points = models.PositiveIntegerField(default=0)
    currency = models.CharField(max_length=10, default="CNY")
    status = models.CharField(max_length=20, choices=RebateStatus.choices, default=RebateStatus.PENDING)
    business_type = models.CharField(max_length=50, blank=True)
    business_id = models.PositiveBigIntegerField(null=True, blank=True)
    remark = models.CharField(max_length=255, blank=True)
    created_by_admin = models.ForeignKey(
        "iam.AdminUser",
        on_delete=models.PROTECT,
        related_name="created_rebate_records",
        null=True,
        blank=True,
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "rebate_records"
        ordering = ["-id"]
        indexes = [
            models.Index(fields=["user", "status"], name="idx_rebate_user_status"),
            models.Index(fields=["business_type", "business_id"], name="idx_rebate_business"),
        ]

    def __str__(self) -> str:
        return f"{self.user_id}:{self.status}:{self.amount}"
