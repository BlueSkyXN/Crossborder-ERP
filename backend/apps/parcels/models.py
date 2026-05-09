from decimal import Decimal

from django.db import models


class ParcelStatus(models.TextChoices):
    PENDING_INBOUND = "PENDING_INBOUND", "待入库"
    IN_STOCK = "IN_STOCK", "在库"
    PACKING_REQUESTED = "PACKING_REQUESTED", "已申请打包"
    PACKED = "PACKED", "已打包"
    OUTBOUND = "OUTBOUND", "已出库"
    CANCELLED = "CANCELLED", "已取消"
    PROBLEM = "PROBLEM", "问题包裹"


class UnclaimedParcelStatus(models.TextChoices):
    UNCLAIMED = "UNCLAIMED", "待认领"
    CLAIM_PENDING = "CLAIM_PENDING", "认领待审"
    CLAIMED = "CLAIMED", "已认领"


class PhotoType(models.TextChoices):
    INBOUND = "INBOUND", "入库"
    DAMAGE = "DAMAGE", "破损"
    OTHER = "OTHER", "其他"


class Parcel(models.Model):
    parcel_no = models.CharField(max_length=30, unique=True)
    user = models.ForeignKey("members.User", on_delete=models.PROTECT, related_name="parcels")
    warehouse = models.ForeignKey("warehouses.Warehouse", on_delete=models.PROTECT, related_name="parcels")
    tracking_no = models.CharField(max_length=80, unique=True)
    carrier = models.CharField(max_length=80, blank=True)
    status = models.CharField(
        max_length=30,
        choices=ParcelStatus.choices,
        default=ParcelStatus.PENDING_INBOUND,
    )
    weight_kg = models.DecimalField(max_digits=10, decimal_places=3, null=True, blank=True)
    length_cm = models.DecimalField(max_digits=10, decimal_places=2, null=True, blank=True)
    width_cm = models.DecimalField(max_digits=10, decimal_places=2, null=True, blank=True)
    height_cm = models.DecimalField(max_digits=10, decimal_places=2, null=True, blank=True)
    remark = models.TextField(blank=True)
    inbound_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "parcels"
        ordering = ["-id"]

    def __str__(self) -> str:
        return self.parcel_no


class ParcelItem(models.Model):
    parcel = models.ForeignKey(Parcel, on_delete=models.CASCADE, related_name="items")
    name = models.CharField(max_length=120)
    quantity = models.PositiveIntegerField(default=1)
    declared_value = models.DecimalField(max_digits=10, decimal_places=2, default=Decimal("0.00"))
    product_url = models.URLField(blank=True)
    remark = models.CharField(max_length=255, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "parcel_items"
        ordering = ["id"]


class ParcelPhoto(models.Model):
    parcel = models.ForeignKey(Parcel, on_delete=models.CASCADE, related_name="photos")
    file_id = models.CharField(max_length=120)
    photo_type = models.CharField(max_length=30, choices=PhotoType.choices, default=PhotoType.INBOUND)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "parcel_photos"
        ordering = ["id"]


class InboundRecord(models.Model):
    parcel = models.ForeignKey(Parcel, on_delete=models.CASCADE, related_name="inbound_records")
    operator = models.ForeignKey(
        "iam.AdminUser",
        on_delete=models.PROTECT,
        related_name="inbound_records",
        null=True,
        blank=True,
    )
    weight_kg = models.DecimalField(max_digits=10, decimal_places=3)
    dimensions_json = models.JSONField(default=dict, blank=True)
    remark = models.CharField(max_length=255, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "inbound_records"
        ordering = ["-id"]


class UnclaimedParcel(models.Model):
    warehouse = models.ForeignKey(
        "warehouses.Warehouse",
        on_delete=models.PROTECT,
        related_name="unclaimed_parcels",
    )
    tracking_no = models.CharField(max_length=80, unique=True)
    status = models.CharField(
        max_length=30,
        choices=UnclaimedParcelStatus.choices,
        default=UnclaimedParcelStatus.UNCLAIMED,
    )
    description = models.TextField(blank=True)
    claimed_by_user = models.ForeignKey(
        "members.User",
        on_delete=models.PROTECT,
        related_name="claimed_unclaimed_parcels",
        null=True,
        blank=True,
    )
    claim_note = models.TextField(blank=True)
    claim_contact = models.CharField(max_length=120, blank=True)
    claimed_at = models.DateTimeField(null=True, blank=True)
    reviewed_by_admin = models.ForeignKey(
        "iam.AdminUser",
        on_delete=models.PROTECT,
        related_name="reviewed_unclaimed_parcels",
        null=True,
        blank=True,
    )
    review_note = models.TextField(blank=True)
    reviewed_at = models.DateTimeField(null=True, blank=True)
    weight_kg = models.DecimalField(max_digits=10, decimal_places=3, null=True, blank=True)
    dimensions_json = models.JSONField(default=dict, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "unclaimed_parcels"
        ordering = ["-id"]

    def __str__(self) -> str:
        return self.tracking_no
