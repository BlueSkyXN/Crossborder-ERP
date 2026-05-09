from decimal import Decimal

from rest_framework import serializers

from apps.parcels.models import Parcel
from apps.warehouses.models import ConfigStatus, Warehouse

from .models import ProcurementTask, PurchaseOrder, PurchaseOrderItem


class PurchaseOrderItemSerializer(serializers.ModelSerializer):
    product_title = serializers.CharField(source="product.title", read_only=True, allow_null=True)
    sku_code = serializers.CharField(source="sku.sku_code", read_only=True, allow_null=True)

    class Meta:
        model = PurchaseOrderItem
        fields = [
            "id",
            "product",
            "product_title",
            "sku",
            "sku_code",
            "name",
            "quantity",
            "unit_price",
            "actual_price",
            "product_url",
            "remark",
            "created_at",
        ]
        read_only_fields = fields


class ProcurementTaskSerializer(serializers.ModelSerializer):
    assignee_name = serializers.CharField(source="assignee.name", read_only=True, allow_null=True)

    class Meta:
        model = ProcurementTask
        fields = [
            "id",
            "assignee_name",
            "status",
            "purchase_amount",
            "external_order_no",
            "tracking_no",
            "remark",
            "procured_at",
            "arrived_at",
            "created_at",
            "updated_at",
        ]
        read_only_fields = fields


class ConvertedParcelSerializer(serializers.ModelSerializer):
    warehouse_name = serializers.CharField(source="warehouse.name", read_only=True)

    class Meta:
        model = Parcel
        fields = ["id", "parcel_no", "tracking_no", "status", "warehouse", "warehouse_name", "inbound_at"]
        read_only_fields = fields


class PurchaseOrderSerializer(serializers.ModelSerializer):
    user_email = serializers.EmailField(source="user.email", read_only=True)
    reviewed_by_name = serializers.CharField(source="reviewed_by.name", read_only=True, allow_null=True)
    items = PurchaseOrderItemSerializer(many=True, read_only=True)
    procurement_task = ProcurementTaskSerializer(read_only=True)
    converted_parcel = ConvertedParcelSerializer(read_only=True)

    class Meta:
        model = PurchaseOrder
        fields = [
            "id",
            "order_no",
            "user",
            "user_email",
            "status",
            "source_type",
            "total_amount",
            "service_fee",
            "paid_at",
            "reviewed_by_name",
            "reviewed_at",
            "review_remark",
            "converted_parcel",
            "items",
            "procurement_task",
            "created_at",
            "updated_at",
        ]
        read_only_fields = fields


class PurchaseOrderCreateSerializer(serializers.Serializer):
    cart_item_ids = serializers.ListField(
        child=serializers.IntegerField(min_value=1),
        required=False,
        allow_empty=True,
    )
    service_fee = serializers.DecimalField(max_digits=12, decimal_places=2, required=False, default=Decimal("0.00"))

    def validate_service_fee(self, value):
        if value < 0:
            raise serializers.ValidationError("服务费不能为负数")
        return value


class ManualPurchaseOrderItemInputSerializer(serializers.Serializer):
    name = serializers.CharField(max_length=160)
    quantity = serializers.IntegerField(min_value=1)
    unit_price = serializers.DecimalField(max_digits=12, decimal_places=2)
    actual_price = serializers.DecimalField(max_digits=12, decimal_places=2, required=False, allow_null=True)
    product_url = serializers.URLField(required=False, allow_blank=True)
    remark = serializers.CharField(max_length=255, required=False, allow_blank=True)

    def validate_unit_price(self, value):
        if value < 0:
            raise serializers.ValidationError("单价不能为负数")
        return value

    def validate_actual_price(self, value):
        if value is not None and value < 0:
            raise serializers.ValidationError("实付单价不能为负数")
        return value


class ManualPurchaseOrderCreateSerializer(serializers.Serializer):
    items = ManualPurchaseOrderItemInputSerializer(many=True)
    service_fee = serializers.DecimalField(max_digits=12, decimal_places=2, required=False, default=Decimal("0.00"))

    def validate_service_fee(self, value):
        if value < 0:
            raise serializers.ValidationError("服务费不能为负数")
        return value

    def validate_items(self, value):
        if not value:
            raise serializers.ValidationError("至少提交一个商品")
        return value


class PurchaseLinkParseSerializer(serializers.Serializer):
    source_url = serializers.URLField(max_length=1000)


class PurchaseLinkParseResultSerializer(serializers.Serializer):
    source_url = serializers.URLField()
    normalized_url = serializers.URLField()
    provider = serializers.CharField()
    provider_label = serializers.CharField()
    external_item_id = serializers.CharField(allow_blank=True)
    name = serializers.CharField()
    quantity = serializers.IntegerField()
    unit_price = serializers.CharField()
    product_url = serializers.URLField()
    remark = serializers.CharField()


class PurchasePaySerializer(serializers.Serializer):
    idempotency_key = serializers.CharField(max_length=120)


class PurchaseReviewSerializer(serializers.Serializer):
    review_remark = serializers.CharField(required=False, allow_blank=True)


class PurchaseProcureSerializer(serializers.Serializer):
    purchase_amount = serializers.DecimalField(max_digits=12, decimal_places=2, required=False, allow_null=True)
    external_order_no = serializers.CharField(max_length=120, required=False, allow_blank=True)
    tracking_no = serializers.CharField(max_length=120, required=False, allow_blank=True)
    remark = serializers.CharField(max_length=255, required=False, allow_blank=True)

    def validate_purchase_amount(self, value):
        if value is not None and value < 0:
            raise serializers.ValidationError("实采金额不能为负数")
        return value


class PurchaseArrivedSerializer(serializers.Serializer):
    tracking_no = serializers.CharField(max_length=120, required=False, allow_blank=True)
    remark = serializers.CharField(max_length=255, required=False, allow_blank=True)


class PurchaseExceptionSerializer(serializers.Serializer):
    remark = serializers.CharField(max_length=255, required=False, allow_blank=True)


class PurchaseCancelSerializer(serializers.Serializer):
    reason = serializers.CharField(max_length=255, required=False, allow_blank=True)


class PurchaseConvertToParcelSerializer(serializers.Serializer):
    warehouse_id = serializers.PrimaryKeyRelatedField(
        queryset=Warehouse.objects.filter(status=ConfigStatus.ACTIVE),
        source="warehouse",
    )
    tracking_no = serializers.CharField(max_length=80, required=False, allow_blank=True)
    carrier = serializers.CharField(max_length=80, required=False, allow_blank=True)
    weight_kg = serializers.DecimalField(max_digits=10, decimal_places=3)
    length_cm = serializers.DecimalField(max_digits=10, decimal_places=2, required=False, allow_null=True)
    width_cm = serializers.DecimalField(max_digits=10, decimal_places=2, required=False, allow_null=True)
    height_cm = serializers.DecimalField(max_digits=10, decimal_places=2, required=False, allow_null=True)
    remark = serializers.CharField(required=False, allow_blank=True)

    def validate_weight_kg(self, value):
        if value <= 0:
            raise serializers.ValidationError("重量必须大于 0")
        return value
