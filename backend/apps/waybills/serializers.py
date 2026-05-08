from rest_framework import serializers

from apps.parcels.models import Parcel
from apps.warehouses.models import ConfigStatus, ShippingChannel

from .models import Waybill, WaybillParcel


class WaybillParcelSerializer(serializers.ModelSerializer):
    parcel_id = serializers.IntegerField(source="parcel.id", read_only=True)
    parcel_no = serializers.CharField(source="parcel.parcel_no", read_only=True)
    tracking_no = serializers.CharField(source="parcel.tracking_no", read_only=True)
    parcel_status = serializers.CharField(source="parcel.status", read_only=True)
    weight_kg = serializers.DecimalField(
        source="parcel.weight_kg",
        max_digits=10,
        decimal_places=3,
        read_only=True,
        allow_null=True,
    )

    class Meta:
        model = WaybillParcel
        fields = ["id", "parcel_id", "parcel_no", "tracking_no", "parcel_status", "weight_kg", "created_at"]
        read_only_fields = fields


class WaybillSerializer(serializers.ModelSerializer):
    user_email = serializers.EmailField(source="user.email", read_only=True)
    warehouse_name = serializers.CharField(source="warehouse.name", read_only=True)
    channel_name = serializers.CharField(source="channel.name", read_only=True, allow_null=True)
    reviewed_by_name = serializers.CharField(source="reviewed_by.name", read_only=True, allow_null=True)
    fee_set_by_name = serializers.CharField(source="fee_set_by.name", read_only=True, allow_null=True)
    parcels = WaybillParcelSerializer(source="parcel_links", many=True, read_only=True)

    class Meta:
        model = Waybill
        fields = [
            "id",
            "waybill_no",
            "user_email",
            "warehouse",
            "warehouse_name",
            "channel",
            "channel_name",
            "status",
            "destination_country",
            "recipient_snapshot",
            "fee_total",
            "fee_detail_json",
            "remark",
            "review_remark",
            "fee_remark",
            "cancel_reason",
            "reviewed_by_name",
            "fee_set_by_name",
            "reviewed_at",
            "fee_set_at",
            "paid_at",
            "shipped_at",
            "signed_at",
            "parcels",
            "created_at",
            "updated_at",
        ]
        read_only_fields = fields


class WaybillCreateSerializer(serializers.Serializer):
    parcel_ids = serializers.PrimaryKeyRelatedField(queryset=Parcel.objects.all(), many=True)
    channel_id = serializers.PrimaryKeyRelatedField(
        queryset=ShippingChannel.objects.filter(status=ConfigStatus.ACTIVE),
        source="channel",
        required=False,
        allow_null=True,
    )
    destination_country = serializers.CharField(max_length=80)
    recipient_name = serializers.CharField(max_length=100)
    recipient_phone = serializers.CharField(max_length=30)
    recipient_address = serializers.CharField(max_length=255)
    postal_code = serializers.CharField(max_length=30, required=False, allow_blank=True)
    remark = serializers.CharField(required=False, allow_blank=True)

    def validate(self, attrs):
        parcel_ids = [parcel.id for parcel in attrs.pop("parcel_ids")]
        attrs["parcel_ids"] = parcel_ids
        attrs["recipient_snapshot"] = {
            "name": attrs.pop("recipient_name"),
            "phone": attrs.pop("recipient_phone"),
            "address": attrs.pop("recipient_address"),
            "postal_code": attrs.pop("postal_code", ""),
        }
        return attrs


class WaybillReviewSerializer(serializers.Serializer):
    review_remark = serializers.CharField(required=False, allow_blank=True)


class WaybillFeeSerializer(serializers.Serializer):
    fee_total = serializers.DecimalField(max_digits=10, decimal_places=2)
    fee_detail_json = serializers.DictField(required=False, allow_empty=True)
    fee_remark = serializers.CharField(required=False, allow_blank=True)
