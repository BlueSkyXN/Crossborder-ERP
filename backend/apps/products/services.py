from django.db import models, transaction
from django.db import IntegrityError
from django.db.models import Prefetch
from rest_framework import exceptions

from apps.members.models import User

from .models import CartItem, CatalogStatus, Product, ProductAttribute, ProductAttributeValue, ProductCategory, ProductSku, ProductTranslation


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


def get_admin_categories():
    return ProductCategory.objects.select_related("parent").all()


def get_admin_products():
    return Product.objects.select_related("category").prefetch_related("skus").all()


def get_admin_skus():
    return ProductSku.objects.select_related("product", "product__category").all()


@transaction.atomic
def create_product_category(*, parent: ProductCategory | None = None, name: str, sort_order: int = 0, status: str = CatalogStatus.ACTIVE) -> ProductCategory:
    return ProductCategory.objects.create(parent=parent, name=name, sort_order=sort_order, status=status)


@transaction.atomic
def update_product_category(
    *,
    category: ProductCategory,
    parent: ProductCategory | None = None,
    name: str,
    sort_order: int = 0,
    status: str = CatalogStatus.ACTIVE,
) -> ProductCategory:
    locked = ProductCategory.objects.select_for_update().get(id=category.id)
    if parent and parent.id == locked.id:
        raise exceptions.ValidationError({"parent_id": ["分类不能选择自己作为上级"]})
    locked.parent = parent
    locked.name = name
    locked.sort_order = sort_order
    locked.status = status
    locked.save(update_fields=["parent", "name", "sort_order", "status", "updated_at"])
    return locked


@transaction.atomic
def disable_product_category(*, category: ProductCategory) -> ProductCategory:
    locked = ProductCategory.objects.select_for_update().get(id=category.id)
    locked.status = CatalogStatus.DISABLED
    locked.save(update_fields=["status", "updated_at"])
    return locked


@transaction.atomic
def create_product(
    *,
    category: ProductCategory | None = None,
    title: str,
    description: str = "",
    status: str = CatalogStatus.ACTIVE,
    main_image_file_id: str = "",
) -> Product:
    return Product.objects.create(
        category=category,
        title=title,
        description=description,
        status=status,
        main_image_file_id=main_image_file_id,
    )


@transaction.atomic
def update_product(
    *,
    product: Product,
    category: ProductCategory | None = None,
    title: str,
    description: str = "",
    status: str = CatalogStatus.ACTIVE,
    main_image_file_id: str = "",
) -> Product:
    locked = Product.objects.select_for_update().get(id=product.id)
    locked.category = category
    locked.title = title
    locked.description = description
    locked.status = status
    locked.main_image_file_id = main_image_file_id
    locked.save(update_fields=["category", "title", "description", "status", "main_image_file_id", "updated_at"])
    return Product.objects.select_related("category").prefetch_related("skus").get(id=locked.id)


@transaction.atomic
def disable_product(*, product: Product) -> Product:
    locked = Product.objects.select_for_update().get(id=product.id)
    locked.status = CatalogStatus.DISABLED
    locked.save(update_fields=["status", "updated_at"])
    ProductSku.objects.filter(product=locked).update(status=CatalogStatus.DISABLED)
    return Product.objects.select_related("category").prefetch_related("skus").get(id=locked.id)


@transaction.atomic
def create_product_sku(
    *,
    product: Product,
    sku_code: str,
    spec_json: dict | None = None,
    price,
    stock: int = 0,
    status: str = CatalogStatus.ACTIVE,
) -> ProductSku:
    try:
        return ProductSku.objects.create(
            product=product,
            sku_code=sku_code,
            spec_json=spec_json or {},
            price=price,
            stock=stock,
            status=status,
        )
    except IntegrityError as exc:
        raise exceptions.ValidationError({"sku_code": ["SKU 编码已存在"]}) from exc


@transaction.atomic
def update_product_sku(
    *,
    sku: ProductSku,
    product: Product,
    sku_code: str,
    spec_json: dict | None = None,
    price,
    stock: int = 0,
    status: str = CatalogStatus.ACTIVE,
) -> ProductSku:
    locked = ProductSku.objects.select_for_update().get(id=sku.id)
    locked.product = product
    locked.sku_code = sku_code
    locked.spec_json = spec_json or {}
    locked.price = price
    locked.stock = stock
    locked.status = status
    try:
        locked.save(update_fields=["product", "sku_code", "spec_json", "price", "stock", "status", "updated_at"])
    except IntegrityError as exc:
        raise exceptions.ValidationError({"sku_code": ["SKU 编码已存在"]}) from exc
    return ProductSku.objects.select_related("product", "product__category").get(id=locked.id)


@transaction.atomic
def disable_product_sku(*, sku: ProductSku) -> ProductSku:
    locked = ProductSku.objects.select_for_update().get(id=sku.id)
    locked.status = CatalogStatus.DISABLED
    locked.save(update_fields=["status", "updated_at"])
    return ProductSku.objects.select_related("product", "product__category").get(id=locked.id)


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


# ─── Translation Services ───────────────────────────────────


def get_product_translations(product_id: int):
    return ProductTranslation.objects.filter(product_id=product_id)


def create_product_translation(data: dict) -> ProductTranslation:
    return ProductTranslation.objects.create(**data)


@transaction.atomic
def update_product_translation(trans: ProductTranslation, data: dict) -> ProductTranslation:
    for key, value in data.items():
        setattr(trans, key, value)
    trans.save()
    return trans


def delete_product_translation(trans: ProductTranslation) -> None:
    trans.delete()


# ─── Attribute Services ─────────────────────────────────────


def get_product_attributes(category_id: int | None = None, is_active: bool | None = None):
    qs = ProductAttribute.objects.select_related("category")
    if category_id is not None:
        qs = qs.filter(models.Q(category_id=category_id) | models.Q(category__isnull=True))
    if is_active is not None:
        qs = qs.filter(is_active=is_active)
    return qs


def create_product_attribute(data: dict) -> ProductAttribute:
    return ProductAttribute.objects.create(**data)


@transaction.atomic
def update_product_attribute(attr: ProductAttribute, data: dict) -> ProductAttribute:
    for key, value in data.items():
        setattr(attr, key, value)
    attr.save()
    return attr


def delete_product_attribute(attr: ProductAttribute) -> None:
    if attr.values.exists():
        raise exceptions.ValidationError({"detail": "该属性已有关联值，请先删除属性值"})
    attr.delete()


def get_product_attribute_values(product_id: int):
    return ProductAttributeValue.objects.filter(product_id=product_id).select_related("attribute")


def set_product_attribute_value(data: dict) -> ProductAttributeValue:
    obj, _ = ProductAttributeValue.objects.update_or_create(
        product=data["product"], attribute=data["attribute"],
        defaults={"value": data["value"], "sort_order": data.get("sort_order", 0)},
    )
    return obj


def delete_product_attribute_value(val: ProductAttributeValue) -> None:
    val.delete()
