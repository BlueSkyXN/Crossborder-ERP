from decimal import Decimal

from django.db import models


class ConfigStatus(models.TextChoices):
    ACTIVE = "ACTIVE", "启用"
    DISABLED = "DISABLED", "停用"


class Warehouse(models.Model):
    code = models.CharField(max_length=50, unique=True)
    name = models.CharField(max_length=100)
    country = models.CharField(max_length=80)
    city = models.CharField(max_length=80)
    status = models.CharField(max_length=20, choices=ConfigStatus.choices, default=ConfigStatus.ACTIVE)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "warehouses"
        ordering = ["id"]

    def __str__(self) -> str:
        return self.code


class WarehouseAddress(models.Model):
    warehouse = models.OneToOneField(Warehouse, on_delete=models.CASCADE, related_name="address")
    address_line = models.CharField(max_length=255)
    receiver_name = models.CharField(max_length=100)
    phone = models.CharField(max_length=30)
    postal_code = models.CharField(max_length=30, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "warehouse_addresses"


class ShippingChannel(models.Model):
    code = models.CharField(max_length=50, unique=True)
    name = models.CharField(max_length=100)
    status = models.CharField(max_length=20, choices=ConfigStatus.choices, default=ConfigStatus.ACTIVE)
    billing_method = models.CharField(max_length=50, default="weight")
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "shipping_channels"
        ordering = ["id"]


class RatePlan(models.Model):
    channel = models.ForeignKey(ShippingChannel, on_delete=models.CASCADE, related_name="rate_plans")
    name = models.CharField(max_length=100)
    rule_json = models.JSONField(default=dict, blank=True)
    status = models.CharField(max_length=20, choices=ConfigStatus.choices, default=ConfigStatus.ACTIVE)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "rate_plans"
        ordering = ["id"]


class ValueAddedService(models.Model):
    code = models.CharField(max_length=50, unique=True)
    name = models.CharField(max_length=100)
    price = models.DecimalField(max_digits=10, decimal_places=2, default=Decimal("0.00"))
    status = models.CharField(max_length=20, choices=ConfigStatus.choices, default=ConfigStatus.ACTIVE)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "value_added_services"
        ordering = ["id"]


class PackagingMethod(models.Model):
    code = models.CharField(max_length=50, unique=True)
    name = models.CharField(max_length=100)
    price = models.DecimalField(max_digits=10, decimal_places=2, default=Decimal("0.00"))
    is_default = models.BooleanField(default=False)
    status = models.CharField(max_length=20, choices=ConfigStatus.choices, default=ConfigStatus.ACTIVE)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "packaging_methods"
        ordering = ["id"]
