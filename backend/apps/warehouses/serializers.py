from rest_framework import serializers

from .models import (
    PackagingMethod,
    RatePlan,
    ShippingChannel,
    ValueAddedService,
    Warehouse,
    WarehouseAddress,
)


class WarehouseAddressSerializer(serializers.ModelSerializer):
    class Meta:
        model = WarehouseAddress
        fields = ["address_line", "receiver_name", "phone", "postal_code"]


class WarehouseSerializer(serializers.ModelSerializer):
    address = WarehouseAddressSerializer(required=False)

    class Meta:
        model = Warehouse
        fields = ["id", "code", "name", "country", "city", "status", "address"]

    def create(self, validated_data):
        address_data = validated_data.pop("address", None)
        warehouse = Warehouse.objects.create(**validated_data)
        if address_data:
            WarehouseAddress.objects.create(warehouse=warehouse, **address_data)
        return warehouse

    def update(self, instance, validated_data):
        address_data = validated_data.pop("address", None)
        for key, value in validated_data.items():
            setattr(instance, key, value)
        instance.save()
        if address_data:
            WarehouseAddress.objects.update_or_create(warehouse=instance, defaults=address_data)
        return instance


class WarehouseListResponseSerializer(serializers.Serializer):
    items = WarehouseSerializer(many=True)


class MemberWarehouseAddressSerializer(serializers.Serializer):
    warehouse_code = serializers.CharField()
    warehouse_name = serializers.CharField()
    member_warehouse_code = serializers.CharField()
    receiver_name = serializers.CharField()
    phone = serializers.CharField()
    postal_code = serializers.CharField(allow_blank=True)
    address_line = serializers.CharField()
    full_address = serializers.CharField()


class FreightEstimateRequestSerializer(serializers.Serializer):
    channel_id = serializers.IntegerField()
    weight_kg = serializers.DecimalField(max_digits=10, decimal_places=3)
    length_cm = serializers.DecimalField(max_digits=10, decimal_places=2, required=False, default=0)
    width_cm = serializers.DecimalField(max_digits=10, decimal_places=2, required=False, default=0)
    height_cm = serializers.DecimalField(max_digits=10, decimal_places=2, required=False, default=0)


class FreightEstimateResponseSerializer(serializers.Serializer):
    channel_code = serializers.CharField(required=False)
    channel_name = serializers.CharField(required=False)
    actual_weight_kg = serializers.DecimalField(max_digits=10, decimal_places=3, required=False)
    volumetric_weight_kg = serializers.DecimalField(max_digits=10, decimal_places=2, required=False)
    billable_weight_kg = serializers.DecimalField(max_digits=10, decimal_places=3, required=False)
    fee = serializers.DecimalField(max_digits=12, decimal_places=2, required=False, allow_null=True)
    currency = serializers.CharField(required=False)
    rate_plan = serializers.CharField(required=False)
    error = serializers.CharField(required=False, allow_null=True)


class ShippingChannelSerializer(serializers.ModelSerializer):
    class Meta:
        model = ShippingChannel
        fields = ["id", "code", "name", "status", "billing_method"]


class RatePlanSerializer(serializers.ModelSerializer):
    class Meta:
        model = RatePlan
        fields = ["id", "channel", "name", "rule_json", "status"]


class PackagingMethodSerializer(serializers.ModelSerializer):
    class Meta:
        model = PackagingMethod
        fields = ["id", "code", "name", "price", "is_default", "status"]


class ValueAddedServiceSerializer(serializers.ModelSerializer):
    class Meta:
        model = ValueAddedService
        fields = ["id", "code", "name", "price", "status"]
