from django.db import transaction

from .models import (
    ConfigStatus,
    PackagingMethod,
    RatePlan,
    ShippingChannel,
    ValueAddedService,
    Warehouse,
    WarehouseAddress,
)


def get_active_shipping_channels():
    return ShippingChannel.objects.filter(status=ConfigStatus.ACTIVE)


def build_member_warehouse_address(warehouse: Warehouse, member_warehouse_code: str) -> dict[str, str]:
    address = warehouse.address
    receiver_name = f"{address.receiver_name} {member_warehouse_code}"
    return {
        "warehouse_code": warehouse.code,
        "warehouse_name": warehouse.name,
        "member_warehouse_code": member_warehouse_code,
        "receiver_name": receiver_name,
        "phone": address.phone,
        "postal_code": address.postal_code,
        "address_line": address.address_line,
        "full_address": f"{receiver_name}，{address.phone}，{address.address_line}",
    }


@transaction.atomic
def seed_warehouse_demo_data() -> None:
    sz, _ = Warehouse.objects.update_or_create(
        code="SZ",
        defaults={"name": "深圳仓", "country": "中国", "city": "深圳", "status": ConfigStatus.ACTIVE},
    )
    bj, _ = Warehouse.objects.update_or_create(
        code="BJ",
        defaults={"name": "北京仓", "country": "中国", "city": "北京", "status": ConfigStatus.ACTIVE},
    )
    WarehouseAddress.objects.update_or_create(
        warehouse=sz,
        defaults={
            "address_line": "广东省深圳市南山区测试仓库 1 号",
            "receiver_name": "集运仓",
            "phone": "13800000001",
            "postal_code": "518000",
        },
    )
    WarehouseAddress.objects.update_or_create(
        warehouse=bj,
        defaults={
            "address_line": "北京市朝阳区测试仓库 2 号",
            "receiver_name": "集运仓",
            "phone": "13800000002",
            "postal_code": "100000",
        },
    )

    air, _ = ShippingChannel.objects.update_or_create(
        code="TEST_AIR",
        defaults={"name": "测试空运", "status": ConfigStatus.ACTIVE, "billing_method": "weight"},
    )
    sea, _ = ShippingChannel.objects.update_or_create(
        code="TEST_SEA",
        defaults={"name": "测试海运", "status": ConfigStatus.ACTIVE, "billing_method": "weight"},
    )
    RatePlan.objects.update_or_create(
        channel=air,
        name="测试空运基础计费",
        defaults={
            "rule_json": {
                "first_weight_kg": 0.5,
                "first_weight_fee": "30.00",
                "additional_per_kg": "15.00",
                "volumetric_divisor": 5000,
            },
            "status": ConfigStatus.ACTIVE,
        },
    )
    RatePlan.objects.update_or_create(
        channel=sea,
        name="测试海运基础计费",
        defaults={
            "rule_json": {
                "first_weight_kg": 1.0,
                "first_weight_fee": "20.00",
                "additional_per_kg": "8.00",
                "volumetric_divisor": 6000,
            },
            "status": ConfigStatus.ACTIVE,
        },
    )

    PackagingMethod.objects.update_or_create(
        code="CARTON",
        defaults={"name": "纸箱", "price": "0.00", "is_default": True, "status": ConfigStatus.ACTIVE},
    )
    PackagingMethod.objects.update_or_create(
        code="WOVEN_BAG",
        defaults={"name": "编织袋", "price": "0.00", "is_default": False, "status": ConfigStatus.ACTIVE},
    )

    for code, name in [
        ("PHOTO", "拍照"),
        ("REINFORCE", "加固"),
        ("WATERPROOF", "防水"),
    ]:
        ValueAddedService.objects.update_or_create(
            code=code,
            defaults={"name": name, "price": "0.00", "status": ConfigStatus.ACTIVE},
        )


# ─── Freight Estimation ─────────────────────────────────────

from decimal import Decimal, ROUND_HALF_UP  # noqa: E402
import math  # noqa: E402


def _compute_volumetric_weight(length_cm: float, width_cm: float, height_cm: float, divisor: int) -> Decimal:
    vol = Decimal(str(length_cm)) * Decimal(str(width_cm)) * Decimal(str(height_cm))
    return (vol / Decimal(str(divisor))).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)


def estimate_freight(
    *,
    channel_id: int,
    weight_kg: float,
    length_cm: float = 0,
    width_cm: float = 0,
    height_cm: float = 0,
) -> dict:
    """Estimate shipping cost using active RatePlan of the given channel."""
    try:
        channel = ShippingChannel.objects.get(pk=channel_id, status=ConfigStatus.ACTIVE)
    except ShippingChannel.DoesNotExist:
        return {"error": "渠道不存在或已停用", "fee": None}

    rate_plan = RatePlan.objects.filter(channel=channel, status=ConfigStatus.ACTIVE).first()
    if not rate_plan:
        return {"error": "该渠道暂无可用计费方案", "fee": None}

    rule = rate_plan.rule_json
    first_weight_kg = Decimal(str(rule.get("first_weight_kg", 0.5)))
    first_weight_fee = Decimal(str(rule.get("first_weight_fee", "0")))
    additional_per_kg = Decimal(str(rule.get("additional_per_kg", "0")))
    volumetric_divisor = int(rule.get("volumetric_divisor", 5000))

    actual_weight = Decimal(str(weight_kg))
    vol_weight = Decimal("0")
    if length_cm > 0 and width_cm > 0 and height_cm > 0:
        vol_weight = _compute_volumetric_weight(length_cm, width_cm, height_cm, volumetric_divisor)

    billable_weight = max(actual_weight, vol_weight)

    if billable_weight <= first_weight_kg:
        fee = first_weight_fee
    else:
        extra_kg = billable_weight - first_weight_kg
        extra_units = Decimal(str(math.ceil(float(extra_kg))))
        fee = first_weight_fee + extra_units * additional_per_kg

    return {
        "channel_code": channel.code,
        "channel_name": channel.name,
        "actual_weight_kg": str(actual_weight),
        "volumetric_weight_kg": str(vol_weight),
        "billable_weight_kg": str(billable_weight),
        "fee": str(fee.quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)),
        "currency": "CNY",
        "rate_plan": rate_plan.name,
        "error": None,
    }
