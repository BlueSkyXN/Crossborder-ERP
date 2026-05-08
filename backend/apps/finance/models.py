from decimal import Decimal

from django.db import models


class WalletTransactionType(models.TextChoices):
    ADMIN_RECHARGE = "ADMIN_RECHARGE", "后台充值"
    ADMIN_DEDUCT = "ADMIN_DEDUCT", "后台扣减"
    OFFLINE_REMITTANCE = "OFFLINE_REMITTANCE", "线下汇款"
    WAYBILL_PAYMENT = "WAYBILL_PAYMENT", "运费支付"
    PURCHASE_PAYMENT = "PURCHASE_PAYMENT", "代购支付"
    REFUND = "REFUND", "退款"
    ADJUSTMENT = "ADJUSTMENT", "余额调整"


class WalletTransactionDirection(models.TextChoices):
    INCREASE = "INCREASE", "增加"
    DECREASE = "DECREASE", "减少"


class PaymentOrderStatus(models.TextChoices):
    PENDING = "PENDING", "待支付"
    PROCESSING = "PROCESSING", "支付处理中"
    PAID = "PAID", "已支付"
    FAILED = "FAILED", "支付失败"
    CANCELLED = "CANCELLED", "已取消"
    REFUNDED = "REFUNDED", "已退款"
    PARTIAL_REFUNDED = "PARTIAL_REFUNDED", "部分退款"


class PaymentBusinessType(models.TextChoices):
    WAYBILL = "WAYBILL", "运单"
    PURCHASE_ORDER = "PURCHASE_ORDER", "代购单"


class RechargeRequestStatus(models.TextChoices):
    PENDING = "PENDING", "待审核"
    COMPLETED = "COMPLETED", "已完成"
    CANCELLED = "CANCELLED", "已取消"


class Wallet(models.Model):
    user = models.ForeignKey("members.User", on_delete=models.PROTECT, related_name="wallets")
    currency = models.CharField(max_length=10, default="CNY")
    balance = models.DecimalField(max_digits=12, decimal_places=2, default=Decimal("0.00"))
    frozen_balance = models.DecimalField(max_digits=12, decimal_places=2, default=Decimal("0.00"))
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "wallets"
        ordering = ["id"]
        constraints = [
            models.UniqueConstraint(fields=["user", "currency"], name="uq_wallet_user_currency"),
        ]

    def __str__(self) -> str:
        return f"{self.user_id}:{self.currency}"


class PaymentOrder(models.Model):
    payment_no = models.CharField(max_length=30, unique=True)
    user = models.ForeignKey("members.User", on_delete=models.PROTECT, related_name="payment_orders")
    business_type = models.CharField(max_length=30, choices=PaymentBusinessType.choices)
    business_id = models.PositiveBigIntegerField()
    status = models.CharField(max_length=30, choices=PaymentOrderStatus.choices, default=PaymentOrderStatus.PENDING)
    amount = models.DecimalField(max_digits=12, decimal_places=2)
    currency = models.CharField(max_length=10, default="CNY")
    idempotency_key = models.CharField(max_length=120, unique=True, null=True, blank=True)
    remark = models.CharField(max_length=255, blank=True)
    paid_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "payment_orders"
        ordering = ["-id"]
        constraints = [
            models.UniqueConstraint(fields=["business_type", "business_id"], name="uq_payment_business_once"),
        ]

    def __str__(self) -> str:
        return self.payment_no


class WalletTransaction(models.Model):
    wallet = models.ForeignKey(Wallet, on_delete=models.PROTECT, related_name="transactions")
    user = models.ForeignKey("members.User", on_delete=models.PROTECT, related_name="wallet_transactions")
    payment_order = models.ForeignKey(
        PaymentOrder,
        on_delete=models.PROTECT,
        related_name="wallet_transactions",
        null=True,
        blank=True,
    )
    operator = models.ForeignKey(
        "iam.AdminUser",
        on_delete=models.PROTECT,
        related_name="wallet_transactions",
        null=True,
        blank=True,
    )
    type = models.CharField(max_length=30, choices=WalletTransactionType.choices)
    direction = models.CharField(max_length=20, choices=WalletTransactionDirection.choices)
    amount = models.DecimalField(max_digits=12, decimal_places=2)
    balance_after = models.DecimalField(max_digits=12, decimal_places=2)
    business_type = models.CharField(max_length=30, blank=True)
    business_id = models.PositiveBigIntegerField(null=True, blank=True)
    remark = models.CharField(max_length=255, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "wallet_transactions"
        ordering = ["-id"]


class RechargeRequest(models.Model):
    request_no = models.CharField(max_length=30, unique=True)
    user = models.ForeignKey("members.User", on_delete=models.PROTECT, related_name="recharge_requests")
    wallet = models.ForeignKey(Wallet, on_delete=models.PROTECT, related_name="recharge_requests")
    operator = models.ForeignKey(
        "iam.AdminUser",
        on_delete=models.PROTECT,
        related_name="recharge_requests",
        null=True,
        blank=True,
    )
    amount = models.DecimalField(max_digits=12, decimal_places=2)
    currency = models.CharField(max_length=10, default="CNY")
    proof_file_id = models.CharField(max_length=40, blank=True)
    status = models.CharField(
        max_length=30,
        choices=RechargeRequestStatus.choices,
        default=RechargeRequestStatus.PENDING,
    )
    remark = models.CharField(max_length=255, blank=True)
    review_remark = models.CharField(max_length=255, blank=True)
    reviewed_at = models.DateTimeField(null=True, blank=True)
    completed_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "recharge_requests"
        ordering = ["-id"]

    def __str__(self) -> str:
        return self.request_no
