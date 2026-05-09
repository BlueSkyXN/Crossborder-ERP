from rest_framework import serializers

from apps.addresses.services import build_recipient_snapshot, get_active_address, manual_recipient_snapshot
from apps.parcels.models import Parcel
from apps.warehouses.models import ConfigStatus, ShippingChannel

from .models import ShippingBatch, TrackingEvent, Waybill, WaybillParcel


class TrackingEventSerializer(serializers.ModelSerializer):
    operator_name = serializers.CharField(source="operator.name", read_only=True, allow_null=True)

    class Meta:
        model = TrackingEvent
        fields = [
            "id",
            "waybill",
            "event_time",
            "location",
            "status_text",
            "description",
            "source",
            "operator_name",
            "created_at",
        ]
        read_only_fields = fields


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
    shipping_batch_no = serializers.CharField(source="shipping_batch.batch_no", read_only=True, allow_null=True)
    parcels = WaybillParcelSerializer(source="parcel_links", many=True, read_only=True)
    tracking_events = TrackingEventSerializer(many=True, read_only=True)

    class Meta:
        model = Waybill
        fields = [
            "id",
            "waybill_no",
            "user",
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
            "shipping_batch",
            "shipping_batch_no",
            "transfer_no",
            "reviewed_by_name",
            "fee_set_by_name",
            "reviewed_at",
            "fee_set_at",
            "paid_at",
            "shipped_at",
            "signed_at",
            "parcels",
            "tracking_events",
            "created_at",
            "updated_at",
        ]
        read_only_fields = fields


class WaybillCreateSerializer(serializers.Serializer):
    parcel_ids = serializers.PrimaryKeyRelatedField(queryset=Parcel.objects.all(), many=True)
    address_id = serializers.IntegerField(required=False, allow_null=True)
    channel_id = serializers.PrimaryKeyRelatedField(
        queryset=ShippingChannel.objects.filter(status=ConfigStatus.ACTIVE),
        source="channel",
        required=False,
        allow_null=True,
    )
    destination_country = serializers.CharField(max_length=80, required=False, allow_blank=True)
    recipient_name = serializers.CharField(max_length=100, required=False, allow_blank=True)
    recipient_phone = serializers.CharField(max_length=30, required=False, allow_blank=True)
    recipient_address = serializers.CharField(max_length=255, required=False, allow_blank=True)
    postal_code = serializers.CharField(max_length=30, required=False, allow_blank=True)
    remark = serializers.CharField(required=False, allow_blank=True)

    def validate(self, attrs):
        parcel_ids = [parcel.id for parcel in attrs.pop("parcel_ids")]
        attrs["parcel_ids"] = parcel_ids
        address_id = attrs.pop("address_id", None)
        if address_id:
            request = self.context.get("request")
            address = get_active_address(user=request.user, address_id=address_id)
            attrs["destination_country"] = address.country_region
            attrs["recipient_snapshot"] = build_recipient_snapshot(address)
            return attrs

        required_fields = {
            "destination_country": "目的国家不能为空",
            "recipient_name": "收件人不能为空",
            "recipient_phone": "电话不能为空",
            "recipient_address": "收件地址不能为空",
        }
        errors = {field: [message] for field, message in required_fields.items() if not attrs.get(field, "").strip()}
        if errors:
            raise serializers.ValidationError(errors)

        attrs["destination_country"] = attrs.pop("destination_country").strip()
        attrs["recipient_snapshot"] = manual_recipient_snapshot(
            recipient_name=attrs.pop("recipient_name").strip(),
            recipient_phone=attrs.pop("recipient_phone").strip(),
            recipient_address=attrs.pop("recipient_address").strip(),
            destination_country=attrs["destination_country"],
            postal_code=attrs.pop("postal_code", "").strip(),
        )
        return attrs


class WaybillReviewSerializer(serializers.Serializer):
    review_remark = serializers.CharField(required=False, allow_blank=True)


class WaybillFeeSerializer(serializers.Serializer):
    fee_total = serializers.DecimalField(max_digits=10, decimal_places=2)
    fee_detail_json = serializers.DictField(required=False, allow_empty=True)
    fee_remark = serializers.CharField(required=False, allow_blank=True)


class WaybillShipSerializer(serializers.Serializer):
    status_text = serializers.CharField(max_length=120, required=False, default="已发货")
    location = serializers.CharField(max_length=120, required=False, allow_blank=True)
    description = serializers.CharField(required=False, allow_blank=True)
    event_time = serializers.DateTimeField(required=False, allow_null=True)


class TrackingEventCreateSerializer(serializers.Serializer):
    status_text = serializers.CharField(max_length=120)
    location = serializers.CharField(max_length=120, required=False, allow_blank=True)
    description = serializers.CharField(required=False, allow_blank=True)
    event_time = serializers.DateTimeField(required=False, allow_null=True)


class ShippingBatchWaybillSerializer(serializers.ModelSerializer):
    user_email = serializers.EmailField(source="user.email", read_only=True)
    warehouse_name = serializers.CharField(source="warehouse.name", read_only=True)
    channel_name = serializers.CharField(source="channel.name", read_only=True, allow_null=True)
    parcels = WaybillParcelSerializer(source="parcel_links", many=True, read_only=True)

    class Meta:
        model = Waybill
        fields = [
            "id",
            "waybill_no",
            "user_email",
            "warehouse_name",
            "channel_name",
            "status",
            "destination_country",
            "recipient_snapshot",
            "fee_total",
            "transfer_no",
            "parcels",
            "created_at",
            "updated_at",
        ]
        read_only_fields = fields


class ShippingBatchSerializer(serializers.ModelSerializer):
    warehouse_name = serializers.CharField(source="warehouse.name", read_only=True, allow_null=True)
    channel_name = serializers.CharField(source="channel.name", read_only=True, allow_null=True)
    created_by_name = serializers.CharField(source="created_by.name", read_only=True, allow_null=True)
    locked_by_name = serializers.CharField(source="locked_by.name", read_only=True, allow_null=True)
    shipped_by_name = serializers.CharField(source="shipped_by.name", read_only=True, allow_null=True)
    waybills = ShippingBatchWaybillSerializer(many=True, read_only=True)
    waybill_count = serializers.SerializerMethodField()

    class Meta:
        model = ShippingBatch
        fields = [
            "id",
            "batch_no",
            "name",
            "status",
            "warehouse",
            "warehouse_name",
            "channel",
            "channel_name",
            "carrier_batch_no",
            "transfer_no",
            "ship_note",
            "created_by_name",
            "locked_by_name",
            "shipped_by_name",
            "locked_at",
            "shipped_at",
            "waybills",
            "waybill_count",
            "created_at",
            "updated_at",
        ]
        read_only_fields = fields

    def get_waybill_count(self, obj: ShippingBatch) -> int:
        if hasattr(obj, "waybill_count"):
            return obj.waybill_count
        return obj.waybills.count()


class ShippingBatchCreateSerializer(serializers.Serializer):
    name = serializers.CharField(max_length=120, required=False, allow_blank=True)
    carrier_batch_no = serializers.CharField(max_length=80, required=False, allow_blank=True)
    transfer_no = serializers.CharField(max_length=80, required=False, allow_blank=True)
    ship_note = serializers.CharField(max_length=255, required=False, allow_blank=True)
    waybill_ids = serializers.ListField(child=serializers.IntegerField(), required=False, allow_empty=True)


class ShippingBatchWaybillIdsSerializer(serializers.Serializer):
    waybill_ids = serializers.ListField(child=serializers.IntegerField(), allow_empty=False)


class ShippingBatchPrintPreviewSerializer(serializers.Serializer):
    template = serializers.ChoiceField(choices=["label", "picking", "handover"], required=False, default="label")


class ConfirmReceiptSerializer(serializers.Serializer):
    description = serializers.CharField(required=False, allow_blank=True)
