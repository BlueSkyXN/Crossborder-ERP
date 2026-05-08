from rest_framework import serializers

from .models import Address, AddressType


class AddressSerializer(serializers.ModelSerializer):
    user = serializers.IntegerField(source="user_id", read_only=True)
    recipient_name = serializers.CharField(source="contact_name", read_only=True)
    country = serializers.CharField(source="country_region", read_only=True)
    region = serializers.CharField(source="province_city", read_only=True)
    city = serializers.SerializerMethodField()
    address_line = serializers.CharField(source="detail_address", read_only=True)
    status = serializers.SerializerMethodField()
    full_address = serializers.SerializerMethodField()

    class Meta:
        model = Address
        fields = [
            "id",
            "user",
            "recipient_name",
            "phone",
            "country",
            "region",
            "city",
            "postal_code",
            "address_line",
            "company",
            "is_default",
            "status",
            "full_address",
            "created_at",
            "updated_at",
        ]
        read_only_fields = fields

    def get_city(self, obj: Address) -> str:
        return ""

    def get_status(self, obj: Address) -> str:
        return "ACTIVE" if obj.is_active else "INACTIVE"

    def get_full_address(self, obj: Address) -> str:
        return " ".join(part for part in [obj.country_region, obj.province_city, obj.detail_address] if part).strip()


class AddressUpsertSerializer(serializers.Serializer):
    recipient_name = serializers.CharField(max_length=100)
    phone = serializers.CharField(max_length=30)
    country = serializers.CharField(max_length=80)
    region = serializers.CharField(max_length=80, required=False, allow_blank=True, default="")
    city = serializers.CharField(max_length=80, required=False, allow_blank=True, default="")
    postal_code = serializers.CharField(max_length=30, required=False, allow_blank=True, default="")
    address_line = serializers.CharField(max_length=255)
    company = serializers.CharField(max_length=120, required=False, allow_blank=True, default="")
    is_default = serializers.BooleanField(required=False, default=False)

    def validate(self, attrs):
        for field in ["recipient_name", "phone", "country", "region", "city", "postal_code", "address_line", "company"]:
            attrs[field] = attrs.get(field, "").strip()
        attrs["contact_name"] = attrs.pop("recipient_name")
        attrs["country_region"] = attrs.pop("country")
        attrs["province_city"] = " ".join(part for part in [attrs.pop("region"), attrs.pop("city")] if part).strip()
        attrs["detail_address"] = attrs.pop("address_line")
        attrs["address_type"] = AddressType.RECIPIENT
        return attrs
