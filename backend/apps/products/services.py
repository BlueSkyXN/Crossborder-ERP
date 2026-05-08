from django.db import transaction
from django.db.models import Prefetch
from rest_framework import exceptions

from apps.members.models import User

from .models import CartItem, CatalogStatus, Product, ProductCategory, ProductSku


def get_active_products():
    return (
        Product.objects.filter(status=CatalogStatus.ACTIVE)
        .select_related("category")
        .prefetch_related(Prefetch("skus", queryset=ProductSku.objects.filter(status=CatalogStatus.ACTIVE)))
        .order_by("-id")
    )


def get_active_product_detail(product_id: int) -> Product:
    return (
        Product.objects.filter(id=product_id, status=CatalogStatus.ACTIVE)
        .select_related("category")
        .prefetch_related(Prefetch("skus", queryset=ProductSku.objects.filter(status=CatalogStatus.ACTIVE)))
        .get()
    )


def get_user_cart_items(user: User):
    return CartItem.objects.filter(user=user).select_related("product", "sku")


@transaction.atomic
def add_cart_item(*, user: User, sku: ProductSku, quantity: int) -> CartItem:
    if sku.status != CatalogStatus.ACTIVE or sku.product.status != CatalogStatus.ACTIVE:
        raise exceptions.ValidationError({"sku_id": ["SKU 不可购买"]})
    if sku.stock < quantity:
        raise exceptions.ValidationError({"quantity": ["SKU 库存不足"]})

    cart_item, created = CartItem.objects.select_for_update().get_or_create(
        user=user,
        sku=sku,
        defaults={"product": sku.product, "quantity": quantity},
    )
    if not created:
        next_quantity = cart_item.quantity + quantity
        if sku.stock < next_quantity:
            raise exceptions.ValidationError({"quantity": ["SKU 库存不足"]})
        cart_item.quantity = next_quantity
        cart_item.save(update_fields=["quantity", "updated_at"])
    return CartItem.objects.select_related("product", "sku").get(id=cart_item.id)


@transaction.atomic
def update_cart_item(*, cart_item: CartItem, quantity: int) -> CartItem:
    locked = CartItem.objects.select_for_update().select_related("product", "sku").get(id=cart_item.id)
    if locked.sku.stock < quantity:
        raise exceptions.ValidationError({"quantity": ["SKU 库存不足"]})
    locked.quantity = quantity
    locked.save(update_fields=["quantity", "updated_at"])
    return locked


@transaction.atomic
def delete_cart_item(*, cart_item: CartItem) -> None:
    CartItem.objects.filter(id=cart_item.id).delete()


@transaction.atomic
def seed_product_demo_data() -> None:
    daily, _ = ProductCategory.objects.update_or_create(
        name="日用百货",
        defaults={"sort_order": 10, "status": CatalogStatus.ACTIVE},
    )
    electronics, _ = ProductCategory.objects.update_or_create(
        name="数码配件",
        defaults={"sort_order": 20, "status": CatalogStatus.ACTIVE},
    )

    product_a, _ = Product.objects.update_or_create(
        title="测试收纳箱",
        defaults={
            "category": daily,
            "description": "用于代购链路演示的自营商品。",
            "status": CatalogStatus.ACTIVE,
            "main_image_file_id": "demo-product-storage-box",
        },
    )
    ProductSku.objects.update_or_create(
        sku_code="DEMO-STORAGE-BOX-M",
        defaults={
            "product": product_a,
            "spec_json": {"颜色": "透明", "规格": "中号"},
            "price": "39.90",
            "stock": 100,
            "status": CatalogStatus.ACTIVE,
        },
    )

    product_b, _ = Product.objects.update_or_create(
        title="测试数据线",
        defaults={
            "category": electronics,
            "description": "用于购物车和代购订单演示的数码配件。",
            "status": CatalogStatus.ACTIVE,
            "main_image_file_id": "demo-product-usb-cable",
        },
    )
    ProductSku.objects.update_or_create(
        sku_code="DEMO-USB-CABLE-1M",
        defaults={
            "product": product_b,
            "spec_json": {"长度": "1m", "接口": "USB-C"},
            "price": "19.90",
            "stock": 200,
            "status": CatalogStatus.ACTIVE,
        },
    )
