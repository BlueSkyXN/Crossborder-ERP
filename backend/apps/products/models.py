from decimal import Decimal

from django.db import models


class CatalogStatus(models.TextChoices):
    ACTIVE = "ACTIVE", "启用"
    DISABLED = "DISABLED", "停用"


class ProductCategory(models.Model):
    parent = models.ForeignKey("self", on_delete=models.PROTECT, related_name="children", null=True, blank=True)
    name = models.CharField(max_length=120)
    sort_order = models.PositiveIntegerField(default=0)
    status = models.CharField(max_length=30, choices=CatalogStatus.choices, default=CatalogStatus.ACTIVE)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "product_categories"
        ordering = ["sort_order", "id"]

    def __str__(self) -> str:
        return self.name


class Product(models.Model):
    category = models.ForeignKey(ProductCategory, on_delete=models.PROTECT, related_name="products", null=True, blank=True)
    title = models.CharField(max_length=160)
    description = models.TextField(blank=True)
    status = models.CharField(max_length=30, choices=CatalogStatus.choices, default=CatalogStatus.ACTIVE)
    main_image_file_id = models.CharField(max_length=120, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "products"
        ordering = ["-id"]

    def __str__(self) -> str:
        return self.title


class ProductSku(models.Model):
    product = models.ForeignKey(Product, on_delete=models.CASCADE, related_name="skus")
    sku_code = models.CharField(max_length=80, unique=True)
    spec_json = models.JSONField(default=dict, blank=True)
    price = models.DecimalField(max_digits=12, decimal_places=2, default=Decimal("0.00"))
    stock = models.PositiveIntegerField(default=0)
    status = models.CharField(max_length=30, choices=CatalogStatus.choices, default=CatalogStatus.ACTIVE)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "product_skus"
        ordering = ["id"]

    def __str__(self) -> str:
        return self.sku_code


class CartItem(models.Model):
    user = models.ForeignKey("members.User", on_delete=models.CASCADE, related_name="cart_items")
    product = models.ForeignKey(Product, on_delete=models.CASCADE, related_name="cart_items")
    sku = models.ForeignKey(ProductSku, on_delete=models.CASCADE, related_name="cart_items")
    quantity = models.PositiveIntegerField(default=1)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "cart_items"
        ordering = ["-id"]
        constraints = [
            models.UniqueConstraint(fields=["user", "sku"], name="uq_cart_user_sku"),
        ]

    def __str__(self) -> str:
        return f"{self.user_id}:{self.sku_id}"


class ProductTranslation(models.Model):
    product = models.ForeignKey(Product, on_delete=models.CASCADE, related_name="translations")
    language_code = models.CharField(max_length=10, help_text="例如 zh-CN, en, ja")
    title = models.CharField(max_length=160)
    description_rich = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "product_translations"
        ordering = ["language_code"]
        constraints = [
            models.UniqueConstraint(fields=["product", "language_code"], name="uq_product_lang"),
        ]

    def __str__(self) -> str:
        return f"{self.product_id}:{self.language_code}"


class AttributeType(models.TextChoices):
    TEXT = "TEXT", "文本"
    NUMBER = "NUMBER", "数字"
    ENUM = "ENUM", "枚举"
    BOOLEAN = "BOOLEAN", "布尔"


class ProductAttribute(models.Model):
    category = models.ForeignKey(
        ProductCategory, on_delete=models.SET_NULL,
        related_name="attributes", null=True, blank=True,
        help_text="绑定分类（为空则全局属性）",
    )
    name = models.CharField(max_length=120)
    attr_type = models.CharField(max_length=20, choices=AttributeType.choices, default=AttributeType.TEXT)
    is_filterable = models.BooleanField(default=False)
    sort_order = models.PositiveIntegerField(default=0)
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "product_attributes"
        ordering = ["sort_order", "id"]

    def __str__(self) -> str:
        return self.name


class ProductAttributeValue(models.Model):
    product = models.ForeignKey(Product, on_delete=models.CASCADE, related_name="attribute_values")
    attribute = models.ForeignKey(ProductAttribute, on_delete=models.CASCADE, related_name="values")
    value = models.CharField(max_length=500)
    sort_order = models.PositiveIntegerField(default=0)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "product_attribute_values"
        ordering = ["sort_order", "id"]
        constraints = [
            models.UniqueConstraint(fields=["product", "attribute"], name="uq_product_attr"),
        ]

    def __str__(self) -> str:
        return f"{self.attribute.name}: {self.value}"
