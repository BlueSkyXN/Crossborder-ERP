from rest_framework import serializers

from .models import CartItem, CatalogStatus, Product, ProductCategory, ProductSku


class ProductCategorySerializer(serializers.ModelSerializer):
    parent_name = serializers.CharField(source="parent.name", read_only=True, allow_null=True)

    class Meta:
        model = ProductCategory
        fields = ["id", "parent", "parent_name", "name", "sort_order", "status", "created_at", "updated_at"]
        read_only_fields = fields


class ProductSkuSerializer(serializers.ModelSerializer):
    product_title = serializers.CharField(source="product.title", read_only=True)

    class Meta:
        model = ProductSku
        fields = [
            "id",
            "product",
            "product_title",
            "sku_code",
            "spec_json",
            "price",
            "stock",
            "status",
            "created_at",
            "updated_at",
        ]
        read_only_fields = fields


class ProductSerializer(serializers.ModelSerializer):
    category_name = serializers.CharField(source="category.name", read_only=True, allow_null=True)
    skus = ProductSkuSerializer(many=True, read_only=True)

    class Meta:
        model = Product
        fields = [
            "id",
            "category",
            "category_name",
            "title",
            "description",
            "status",
            "main_image_file_id",
            "skus",
            "created_at",
            "updated_at",
        ]
        read_only_fields = fields


class CartItemSerializer(serializers.ModelSerializer):
    product_title = serializers.CharField(source="product.title", read_only=True)
    sku_code = serializers.CharField(source="sku.sku_code", read_only=True)
    sku_spec_json = serializers.JSONField(source="sku.spec_json", read_only=True)
    sku_price = serializers.DecimalField(source="sku.price", max_digits=12, decimal_places=2, read_only=True)
    line_amount = serializers.SerializerMethodField()

    class Meta:
        model = CartItem
        fields = [
            "id",
            "product",
            "product_title",
            "sku",
            "sku_code",
            "sku_spec_json",
            "sku_price",
            "quantity",
            "line_amount",
            "created_at",
            "updated_at",
        ]
        read_only_fields = fields

    def get_line_amount(self, obj: CartItem) -> str:
        return f"{obj.sku.price * obj.quantity:.2f}"


class CartItemCreateSerializer(serializers.Serializer):
    sku_id = serializers.PrimaryKeyRelatedField(
        queryset=ProductSku.objects.select_related("product").filter(
            status=CatalogStatus.ACTIVE,
            product__status=CatalogStatus.ACTIVE,
        ),
        source="sku",
    )
    quantity = serializers.IntegerField(min_value=1)

    def validate(self, attrs):
        sku = attrs["sku"]
        quantity = attrs["quantity"]
        if sku.stock < quantity:
            raise serializers.ValidationError({"quantity": ["SKU 库存不足"]})
        return attrs


class CartItemUpdateSerializer(serializers.Serializer):
    quantity = serializers.IntegerField(min_value=1)


class ProductCategoryInputSerializer(serializers.Serializer):
    parent_id = serializers.PrimaryKeyRelatedField(
        queryset=ProductCategory.objects.all(),
        source="parent",
        required=False,
        allow_null=True,
    )
    name = serializers.CharField(max_length=120)
    sort_order = serializers.IntegerField(min_value=0, required=False, default=0)
    status = serializers.ChoiceField(choices=CatalogStatus.choices, required=False, default=CatalogStatus.ACTIVE)


class ProductInputSerializer(serializers.Serializer):
    category_id = serializers.PrimaryKeyRelatedField(
        queryset=ProductCategory.objects.all(),
        source="category",
        required=False,
        allow_null=True,
    )
    title = serializers.CharField(max_length=160)
    description = serializers.CharField(required=False, allow_blank=True)
    status = serializers.ChoiceField(choices=CatalogStatus.choices, required=False, default=CatalogStatus.ACTIVE)
    main_image_file_id = serializers.CharField(max_length=120, required=False, allow_blank=True)


class ProductSkuInputSerializer(serializers.Serializer):
    product_id = serializers.PrimaryKeyRelatedField(queryset=Product.objects.all(), source="product")
    sku_code = serializers.CharField(max_length=80)
    spec_json = serializers.DictField(required=False, allow_empty=True)
    price = serializers.DecimalField(max_digits=12, decimal_places=2)
    stock = serializers.IntegerField(min_value=0, required=False, default=0)
    status = serializers.ChoiceField(choices=CatalogStatus.choices, required=False, default=CatalogStatus.ACTIVE)

    def validate_price(self, value):
        if value < 0:
            raise serializers.ValidationError("价格不能为负数")
        return value
