from decimal import Decimal

from django.db import models


class WaybillStatus(models.TextChoices):
    PENDING_REVIEW = "PENDING_REVIEW", "待审核"
    PENDING_PACKING = "PENDING_PACKING", "待打包"
    PENDING_PAYMENT = "PENDING_PAYMENT", "待付款"
    PENDING_SHIPMENT = "PENDING_SHIPMENT", "待发货"
    SHIPPED = "SHIPPED", "已发货"
    SIGNED = "SIGNED", "已签收"
    CANCELLED = "CANCELLED", "已取消"
    PROBLEM = "PROBLEM", "问题单"


class ShippingBatchStatus(models.TextChoices):
    DRAFT = "DRAFT", "草稿"
    LOCKED = "LOCKED", "已锁定"
    SHIPPED = "SHIPPED", "已发货"
    CANCELLED = "CANCELLED", "已取消"


class TrackingEventSource(models.TextChoices):
    MANUAL = "MANUAL", "人工"
    MEMBER = "MEMBER", "会员"
    SYSTEM = "SYSTEM", "系统"


class ShippingBatch(models.Model):
    batch_no = models.CharField(max_length=30, unique=True)
    name = models.CharField(max_length=120, blank=True)
    status = models.CharField(
        max_length=30,
        choices=ShippingBatchStatus.choices,
        default=ShippingBatchStatus.DRAFT,
    )
    warehouse = models.ForeignKey(
        "warehouses.Warehouse",
        on_delete=models.PROTECT,
        related_name="shipping_batches",
        null=True,
        blank=True,
    )
    channel = models.ForeignKey(
        "warehouses.ShippingChannel",
        on_delete=models.PROTECT,
        related_name="shipping_batches",
        null=True,
        blank=True,
    )
    carrier_batch_no = models.CharField(max_length=80, blank=True)
    transfer_no = models.CharField(max_length=80, blank=True)
    ship_note = models.CharField(max_length=255, blank=True)
    created_by = models.ForeignKey(
        "iam.AdminUser",
        on_delete=models.PROTECT,
        related_name="created_shipping_batches",
        null=True,
        blank=True,
    )
    locked_by = models.ForeignKey(
        "iam.AdminUser",
        on_delete=models.PROTECT,
        related_name="locked_shipping_batches",
        null=True,
        blank=True,
    )
    shipped_by = models.ForeignKey(
        "iam.AdminUser",
        on_delete=models.PROTECT,
        related_name="shipped_shipping_batches",
        null=True,
        blank=True,
    )
    locked_at = models.DateTimeField(null=True, blank=True)
    shipped_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "shipping_batches"
        ordering = ["-id"]

    def __str__(self) -> str:
        return self.batch_no


class Waybill(models.Model):
    waybill_no = models.CharField(max_length=30, unique=True)
    user = models.ForeignKey("members.User", on_delete=models.PROTECT, related_name="waybills")
    warehouse = models.ForeignKey("warehouses.Warehouse", on_delete=models.PROTECT, related_name="waybills")
    channel = models.ForeignKey(
        "warehouses.ShippingChannel",
        on_delete=models.PROTECT,
        related_name="waybills",
        null=True,
        blank=True,
    )
    status = models.CharField(
        max_length=30,
        choices=WaybillStatus.choices,
        default=WaybillStatus.PENDING_REVIEW,
    )
    destination_country = models.CharField(max_length=80)
    recipient_snapshot = models.JSONField(default=dict)
    fee_total = models.DecimalField(max_digits=10, decimal_places=2, default=Decimal("0.00"))
    fee_detail_json = models.JSONField(default=dict, blank=True)
    remark = models.TextField(blank=True)
    review_remark = models.CharField(max_length=255, blank=True)
    fee_remark = models.CharField(max_length=255, blank=True)
    cancel_reason = models.CharField(max_length=255, blank=True)
    shipping_batch = models.ForeignKey(
        ShippingBatch,
        on_delete=models.SET_NULL,
        related_name="waybills",
        null=True,
        blank=True,
    )
    transfer_no = models.CharField(max_length=80, blank=True)
    reviewed_by = models.ForeignKey(
        "iam.AdminUser",
        on_delete=models.PROTECT,
        related_name="reviewed_waybills",
        null=True,
        blank=True,
    )
    fee_set_by = models.ForeignKey(
        "iam.AdminUser",
        on_delete=models.PROTECT,
        related_name="fee_set_waybills",
        null=True,
        blank=True,
    )
    reviewed_at = models.DateTimeField(null=True, blank=True)
    fee_set_at = models.DateTimeField(null=True, blank=True)
    paid_at = models.DateTimeField(null=True, blank=True)
    shipped_at = models.DateTimeField(null=True, blank=True)
    signed_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "waybills"
        ordering = ["-id"]

    def __str__(self) -> str:
        return self.waybill_no


class WaybillParcel(models.Model):
    waybill = models.ForeignKey(Waybill, on_delete=models.CASCADE, related_name="parcel_links")
    parcel = models.ForeignKey("parcels.Parcel", on_delete=models.PROTECT, related_name="waybill_links")
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "waybill_parcels"
        ordering = ["id"]
        constraints = [
            models.UniqueConstraint(fields=["waybill", "parcel"], name="uq_waybill_parcel_once"),
        ]


class TrackingEvent(models.Model):
    waybill = models.ForeignKey(Waybill, on_delete=models.CASCADE, related_name="tracking_events")
    event_time = models.DateTimeField()
    location = models.CharField(max_length=120, blank=True)
    status_text = models.CharField(max_length=120)
    description = models.TextField(blank=True)
    source = models.CharField(max_length=30, choices=TrackingEventSource.choices, default=TrackingEventSource.MANUAL)
    operator = models.ForeignKey(
        "iam.AdminUser",
        on_delete=models.PROTECT,
        related_name="tracking_events",
        null=True,
        blank=True,
    )
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "tracking_events"
        ordering = ["event_time", "id"]
