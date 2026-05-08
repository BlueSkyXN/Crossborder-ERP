from rest_framework import serializers

from apps.warehouses.models import ConfigStatus, Warehouse

from .models import InboundRecord, Parcel, ParcelItem, ParcelPhoto, UnclaimedParcel


class ParcelItemSerializer(serializers.ModelSerializer):
    class Meta:
        model = ParcelItem
        fields = ["id", "name", "quantity", "declared_value", "product_url", "remark"]
        read_only_fields = ["id"]


class ParcelPhotoSerializer(serializers.ModelSerializer):
    class Meta:
        model = ParcelPhoto
        fields = ["id", "file_id", "photo_type", "created_at"]
        read_only_fields = ["id", "created_at"]


class InboundRecordSerializer(serializers.ModelSerializer):
    operator_name = serializers.CharField(source="operator.name", read_only=True)

    class Meta:
        model = InboundRecord
        fields = ["id", "operator_name", "weight_kg", "dimensions_json", "remark", "created_at"]


class ParcelSerializer(serializers.ModelSerializer):
    warehouse_name = serializers.CharField(source="warehouse.name", read_only=True)
    user_email = serializers.EmailField(source="user.email", read_only=True)
    items = ParcelItemSerializer(many=True, read_only=True)
    photos = ParcelPhotoSerializer(many=True, read_only=True)

    class Meta:
        model = Parcel
        fields = [
            "id",
            "parcel_no",
            "user_email",
            "warehouse",
            "warehouse_name",
            "tracking_no",
            "carrier",
            "status",
            "weight_kg",
            "length_cm",
            "width_cm",
            "height_cm",
            "remark",
            "inbound_at",
            "items",
            "photos",
            "created_at",
            "updated_at",
        ]
        read_only_fields = fields


class ParcelForecastSerializer(serializers.Serializer):
    warehouse_id = serializers.PrimaryKeyRelatedField(
        queryset=Warehouse.objects.filter(status=ConfigStatus.ACTIVE),
        source="warehouse",
    )
    tracking_no = serializers.CharField(max_length=80)
    carrier = serializers.CharField(max_length=80, required=False, allow_blank=True)
    remark = serializers.CharField(required=False, allow_blank=True)
    items = ParcelItemSerializer(many=True, required=False)


class InboundRequestSerializer(serializers.Serializer):
    weight_kg = serializers.DecimalField(max_digits=10, decimal_places=3)
    length_cm = serializers.DecimalField(max_digits=10, decimal_places=2, required=False, allow_null=True)
    width_cm = serializers.DecimalField(max_digits=10, decimal_places=2, required=False, allow_null=True)
    height_cm = serializers.DecimalField(max_digits=10, decimal_places=2, required=False, allow_null=True)
    photo_file_ids = serializers.ListField(
        child=serializers.CharField(max_length=120),
        required=False,
        allow_empty=True,
        write_only=True,
    )
    remark = serializers.CharField(required=False, allow_blank=True)


class ScanInboundRequestSerializer(InboundRequestSerializer):
    warehouse_id = serializers.PrimaryKeyRelatedField(
        queryset=Warehouse.objects.filter(status=ConfigStatus.ACTIVE),
        source="warehouse",
    )
    tracking_no = serializers.CharField(max_length=80)


class ScanInboundResponseSerializer(serializers.Serializer):
    parcel = ParcelSerializer(allow_null=True)
    unclaimed_parcel = serializers.DictField(allow_null=True)
    created_unclaimed = serializers.BooleanField(required=False)


class UnclaimedParcelSerializer(serializers.ModelSerializer):
    warehouse_name = serializers.CharField(source="warehouse.name", read_only=True)
    claimed_by_email = serializers.EmailField(source="claimed_by_user.email", read_only=True)

    class Meta:
        model = UnclaimedParcel
        fields = [
            "id",
            "warehouse",
            "warehouse_name",
            "tracking_no",
            "status",
            "description",
            "claimed_by_email",
            "weight_kg",
            "dimensions_json",
            "created_at",
            "updated_at",
        ]
        read_only_fields = ["id", "status", "claimed_by_email", "dimensions_json", "created_at", "updated_at"]


class AdminUnclaimedParcelCreateSerializer(serializers.Serializer):
    warehouse_id = serializers.PrimaryKeyRelatedField(
        queryset=Warehouse.objects.filter(status=ConfigStatus.ACTIVE),
        source="warehouse",
    )
    tracking_no = serializers.CharField(max_length=80)
    description = serializers.CharField(required=False, allow_blank=True)
    weight_kg = serializers.DecimalField(max_digits=10, decimal_places=3, required=False, allow_null=True)
