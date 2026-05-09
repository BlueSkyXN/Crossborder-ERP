from rest_framework import serializers

from .models import ContentCategory, ContentCategoryStatus, ContentPage, ContentStatus, ContentType


class ContentCategorySerializer(serializers.ModelSerializer):
    class Meta:
        model = ContentCategory
        fields = [
            "id",
            "type",
            "slug",
            "name",
            "description",
            "sort_order",
            "status",
            "created_at",
            "updated_at",
        ]
        read_only_fields = fields


class ContentPageSerializer(serializers.ModelSerializer):
    category_name = serializers.CharField(source="category.name", read_only=True, allow_null=True)
    created_by_name = serializers.CharField(source="created_by_admin.name", read_only=True, allow_null=True)
    updated_by_name = serializers.CharField(source="updated_by_admin.name", read_only=True, allow_null=True)

    class Meta:
        model = ContentPage
        fields = [
            "id",
            "category",
            "category_name",
            "type",
            "slug",
            "title",
            "summary",
            "body",
            "status",
            "sort_order",
            "published_at",
            "created_by_name",
            "updated_by_name",
            "created_at",
            "updated_at",
        ]
        read_only_fields = fields


class PublicContentPageListSerializer(serializers.ModelSerializer):
    category_slug = serializers.CharField(source="category.slug", read_only=True, allow_null=True)
    category_name = serializers.CharField(source="category.name", read_only=True, allow_null=True)

    class Meta:
        model = ContentPage
        fields = [
            "id",
            "category_slug",
            "category_name",
            "type",
            "slug",
            "title",
            "summary",
            "sort_order",
            "published_at",
        ]
        read_only_fields = fields


class PublicContentPageDetailSerializer(PublicContentPageListSerializer):
    class Meta(PublicContentPageListSerializer.Meta):
        fields = [*PublicContentPageListSerializer.Meta.fields, "body", "updated_at"]


class ContentCategoryInputSerializer(serializers.Serializer):
    type = serializers.ChoiceField(choices=ContentType.choices, default=ContentType.HELP)
    slug = serializers.SlugField(max_length=120)
    name = serializers.CharField(max_length=120)
    description = serializers.CharField(required=False, allow_blank=True)
    sort_order = serializers.IntegerField(min_value=0, required=False, default=0)
    status = serializers.ChoiceField(
        choices=ContentCategoryStatus.choices,
        required=False,
        default=ContentCategoryStatus.ACTIVE,
    )

    def validate_slug(self, value: str) -> str:
        queryset = ContentCategory.objects.filter(slug=value)
        category_id = self.context.get("category_id")
        if category_id:
            queryset = queryset.exclude(id=category_id)
        if queryset.exists():
            raise serializers.ValidationError("内容分类 slug 已存在")
        return value


class ContentPageInputSerializer(serializers.Serializer):
    category_id = serializers.PrimaryKeyRelatedField(
        queryset=ContentCategory.objects.all(),
        source="category",
        required=False,
        allow_null=True,
    )
    type = serializers.ChoiceField(choices=ContentType.choices, default=ContentType.HELP)
    slug = serializers.SlugField(max_length=120)
    title = serializers.CharField(max_length=180)
    summary = serializers.CharField(required=False, allow_blank=True, max_length=300)
    body = serializers.CharField()
    status = serializers.ChoiceField(choices=ContentStatus.choices, required=False, default=ContentStatus.DRAFT)
    sort_order = serializers.IntegerField(min_value=0, required=False, default=0)
    published_at = serializers.DateTimeField(required=False, allow_null=True)

    def validate_slug(self, value: str) -> str:
        queryset = ContentPage.objects.filter(slug=value)
        page_id = self.context.get("page_id")
        if page_id:
            queryset = queryset.exclude(id=page_id)
        if queryset.exists():
            raise serializers.ValidationError("内容 slug 已存在")
        return value


class ContentPageQuerySerializer(serializers.Serializer):
    type = serializers.ChoiceField(choices=ContentType.choices, required=False)
    category_slug = serializers.CharField(required=False, allow_blank=True, max_length=120)
    keyword = serializers.CharField(required=False, allow_blank=True, max_length=120)
