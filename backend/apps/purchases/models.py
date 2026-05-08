from decimal import Decimal

from django.db import models


class PurchaseOrderStatus(models.TextChoices):
    PENDING_PAYMENT = "PENDING_PAYMENT", "待付款"
    PENDING_REVIEW = "PENDING_REVIEW", "待审核"
    PENDING_PROCUREMENT = "PENDING_PROCUREMENT", "待采购"
    PROCURED = "PROCURED", "已采购"
    ARRIVED = "ARRIVED", "已到货"
    COMPLETED = "COMPLETED", "已完成"
    CANCELLED = "CANCELLED", "已取消"
    EXCEPTION = "EXCEPTION", "异常单"


class PurchaseOrderSourceType(models.TextChoices):
    PRODUCT = "PRODUCT", "自营商品"
    MANUAL = "MANUAL", "手工代购"


class ProcurementTaskStatus(models.TextChoices):
    PENDING = "PENDING", "待处理"
    PROCURED = "PROCURED", "已采购"
    ARRIVED = "ARRIVED", "已到货"
    CANCELLED = "CANCELLED", "已取消"


class PurchaseOrder(models.Model):
    order_no = models.CharField(max_length=30, unique=True)
    user = models.ForeignKey("members.User", on_delete=models.PROTECT, related_name="purchase_orders")
    status = models.CharField(
        max_length=30,
        choices=PurchaseOrderStatus.choices,
        default=PurchaseOrderStatus.PENDING_PAYMENT,
    )
    source_type = models.CharField(max_length=30, choices=PurchaseOrderSourceType.choices)
    total_amount = models.DecimalField(max_digits=12, decimal_places=2, default=Decimal("0.00"))
    service_fee = models.DecimalField(max_digits=12, decimal_places=2, default=Decimal("0.00"))
    paid_at = models.DateTimeField(null=True, blank=True)
    reviewed_by = models.ForeignKey(
        "iam.AdminUser",
        on_delete=models.PROTECT,
        related_name="reviewed_purchase_orders",
        null=True,
        blank=True,
    )
    reviewed_at = models.DateTimeField(null=True, blank=True)
    review_remark = models.CharField(max_length=255, blank=True)
    converted_parcel = models.ForeignKey(
        "parcels.Parcel",
        on_delete=models.PROTECT,
        related_name="source_purchase_orders",
        null=True,
        blank=True,
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "purchase_orders"
        ordering = ["-id"]

    def __str__(self) -> str:
        return self.order_no


class PurchaseOrderItem(models.Model):
    purchase_order = models.ForeignKey(PurchaseOrder, on_delete=models.CASCADE, related_name="items")
    product = models.ForeignKey(
        "products.Product",
        on_delete=models.PROTECT,
        related_name="purchase_order_items",
        null=True,
        blank=True,
    )
    sku = models.ForeignKey(
        "products.ProductSku",
        on_delete=models.PROTECT,
        related_name="purchase_order_items",
        null=True,
        blank=True,
    )
    name = models.CharField(max_length=160)
    quantity = models.PositiveIntegerField(default=1)
    unit_price = models.DecimalField(max_digits=12, decimal_places=2, default=Decimal("0.00"))
    actual_price = models.DecimalField(max_digits=12, decimal_places=2, default=Decimal("0.00"))
    product_url = models.URLField(blank=True)
    remark = models.CharField(max_length=255, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "purchase_order_items"
        ordering = ["id"]


class ProcurementTask(models.Model):
    purchase_order = models.OneToOneField(PurchaseOrder, on_delete=models.CASCADE, related_name="procurement_task")
    assignee = models.ForeignKey(
        "iam.AdminUser",
        on_delete=models.PROTECT,
        related_name="procurement_tasks",
        null=True,
        blank=True,
    )
    status = models.CharField(max_length=30, choices=ProcurementTaskStatus.choices, default=ProcurementTaskStatus.PENDING)
    purchase_amount = models.DecimalField(max_digits=12, decimal_places=2, default=Decimal("0.00"))
    external_order_no = models.CharField(max_length=120, blank=True)
    tracking_no = models.CharField(max_length=120, blank=True)
    remark = models.CharField(max_length=255, blank=True)
    procured_at = models.DateTimeField(null=True, blank=True)
    arrived_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "procurement_tasks"
        ordering = ["-id"]

    def __str__(self) -> str:
        return self.purchase_order.order_no
