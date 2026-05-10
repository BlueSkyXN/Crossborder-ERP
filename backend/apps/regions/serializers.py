from drf_spectacular.utils import extend_schema_field
from rest_framework import serializers

from .models import CountryRegion, RegionLevel


class CountryRegionSerializer(serializers.ModelSerializer):
    parent_name = serializers.CharField(source="parent.name", read_only=True, allow_null=True)
    children_count = serializers.SerializerMethodField()

    class Meta:
        model = CountryRegion
        fields = [
            "id", "parent", "parent_name", "name", "code", "iso_code",
            "phone_code", "currency_code", "level", "postal_code",
            "sort_order", "is_active", "children_count",
            "created_at", "updated_at",
        ]
        read_only_fields = fields

    def get_children_count(self, obj: CountryRegion) -> int:
        return getattr(obj, "_children_count", 0)


class CountryRegionTreeSerializer(serializers.ModelSerializer):
    children = serializers.SerializerMethodField()

    class Meta:
        model = CountryRegion
        fields = [
            "id", "name", "code", "iso_code", "level",
            "is_active", "sort_order", "children",
        ]
        read_only_fields = fields

    @extend_schema_field(serializers.ListField(child=serializers.DictField()))
    def get_children(self, obj: CountryRegion) -> list[dict]:
        children = obj.children.filter(is_active=True).order_by("sort_order", "id")
        return CountryRegionTreeSerializer(children, many=True).data


class CountryRegionInputSerializer(serializers.Serializer):
    parent_id = serializers.PrimaryKeyRelatedField(
        queryset=CountryRegion.objects.all(),
        source="parent", required=False, allow_null=True,
    )
    name = serializers.CharField(max_length=120)
    code = serializers.CharField(max_length=20)
    iso_code = serializers.CharField(max_length=10, required=False, allow_blank=True)
    phone_code = serializers.CharField(max_length=10, required=False, allow_blank=True)
    currency_code = serializers.CharField(max_length=10, required=False, allow_blank=True)
    level = serializers.ChoiceField(choices=RegionLevel.choices, required=False, default=RegionLevel.COUNTRY)
    postal_code = serializers.CharField(max_length=20, required=False, allow_blank=True)
    sort_order = serializers.IntegerField(min_value=0, required=False, default=0)
    is_active = serializers.BooleanField(required=False, default=True)

    def validate_code(self, value: str) -> str:
        instance = self.context.get("instance")
        qs = CountryRegion.objects.filter(code=value)
        if instance:
            qs = qs.exclude(pk=instance.pk)
        if qs.exists():
            raise serializers.ValidationError("该编码已存在")
        return value
