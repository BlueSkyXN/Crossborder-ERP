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
            "rule_json": {"TODO_CONFIRM": "首重续重、体积重、偏远费、保险费后续确认"},
            "status": ConfigStatus.ACTIVE,
        },
    )
    RatePlan.objects.update_or_create(
        channel=sea,
        name="测试海运基础计费",
        defaults={
            "rule_json": {"TODO_CONFIRM": "首重续重、体积重、偏远费、保险费后续确认"},
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
