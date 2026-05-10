from django.shortcuts import get_object_or_404
from drf_spectacular.utils import extend_schema
from rest_framework import status
from rest_framework.views import APIView

from apps.common.responses import success_response
from apps.iam.authentication import AdminTokenAuthentication
from apps.iam.permissions import HasAdminPermission

from .models import ContentCategory, ContentCategoryStatus, ContentPage
from .serializers import (
    ContentCategoryInputSerializer,
    ContentCategorySerializer,
    ContentPageInputSerializer,
    ContentPageQuerySerializer,
    ContentPageSerializer,
    PublicContentPageDetailSerializer,
    PublicContentPageListSerializer,
)
from .selectors import (
    get_admin_categories,
    get_admin_pages,
    get_public_categories,
    get_public_pages,
    get_public_page_by_slug,
)
from .services import (
    create_content_page,
    hide_content_page,
    publish_content_page,
    update_content_page,
)


class ContentCategoryListView(APIView):
    @extend_schema(tags=["content"], responses={200: ContentCategorySerializer(many=True)})
    def get(self, request):
        content_type = request.query_params.get("type", "").strip()
        categories = get_public_categories(content_type=content_type)
        return success_response({"items": ContentCategorySerializer(categories, many=True).data})


class ContentPageListView(APIView):
    @extend_schema(
        tags=["content"],
        parameters=[ContentPageQuerySerializer],
        responses={200: PublicContentPageListSerializer(many=True)},
    )
    def get(self, request):
        serializer = ContentPageQuerySerializer(data=request.query_params)
        serializer.is_valid(raise_exception=True)
        pages = get_public_pages(
            content_type=serializer.validated_data.get("type", ""),
            category_slug=serializer.validated_data.get("category_slug", "").strip(),
            keyword=serializer.validated_data.get("keyword", "").strip(),
        )
        return success_response({"items": PublicContentPageListSerializer(pages, many=True).data})


class ContentPageDetailView(APIView):
    @extend_schema(tags=["content"], responses={200: PublicContentPageDetailSerializer})
    def get(self, request, slug: str):
        page = get_object_or_404(get_public_pages(), slug=slug)
        return success_response(PublicContentPageDetailSerializer(page).data)


class AdminContentCategoryListCreateView(APIView):
    authentication_classes = [AdminTokenAuthentication]
    permission_classes = [HasAdminPermission]
    required_permission = "content.view"
    write_permission = "content.manage"

    @extend_schema(tags=["admin-content"], responses={200: ContentCategorySerializer(many=True)})
    def get(self, request):
        return success_response({"items": ContentCategorySerializer(get_admin_categories(), many=True).data})

    @extend_schema(tags=["admin-content"], request=ContentCategoryInputSerializer, responses={201: ContentCategorySerializer})
    def post(self, request):
        serializer = ContentCategoryInputSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        category = ContentCategory.objects.create(**serializer.validated_data)
        return success_response(ContentCategorySerializer(category).data, status=status.HTTP_201_CREATED)


class AdminContentCategoryDetailView(APIView):
    authentication_classes = [AdminTokenAuthentication]
    permission_classes = [HasAdminPermission]
    required_permission = "content.view"
    write_permission = "content.manage"

    @extend_schema(tags=["admin-content"], request=ContentCategoryInputSerializer, responses={200: ContentCategorySerializer})
    def patch(self, request, category_id: int):
        serializer = ContentCategoryInputSerializer(data=request.data, context={"category_id": category_id})
        serializer.is_valid(raise_exception=True)
        category = get_object_or_404(ContentCategory, id=category_id)
        for field, value in serializer.validated_data.items():
            setattr(category, field, value)
        category.save(update_fields=[*serializer.validated_data.keys(), "updated_at"])
        return success_response(ContentCategorySerializer(category).data)

    @extend_schema(tags=["admin-content"], responses={200: ContentCategorySerializer})
    def delete(self, request, category_id: int):
        category = get_object_or_404(ContentCategory, id=category_id)
        category.status = ContentCategoryStatus.DISABLED
        category.save(update_fields=["status", "updated_at"])
        return success_response(ContentCategorySerializer(category).data)


class AdminContentPageListCreateView(APIView):
    authentication_classes = [AdminTokenAuthentication]
    permission_classes = [HasAdminPermission]
    required_permission = "content.view"
    write_permission = "content.manage"

    @extend_schema(tags=["admin-content"], responses={200: ContentPageSerializer(many=True)})
    def get(self, request):
        return success_response({"items": ContentPageSerializer(get_admin_pages(), many=True).data})

    @extend_schema(tags=["admin-content"], request=ContentPageInputSerializer, responses={201: ContentPageSerializer})
    def post(self, request):
        serializer = ContentPageInputSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        page = create_content_page(operator=request.user, **serializer.validated_data)
        return success_response(ContentPageSerializer(page).data, status=status.HTTP_201_CREATED)


class AdminContentPageDetailView(APIView):
    authentication_classes = [AdminTokenAuthentication]
    permission_classes = [HasAdminPermission]
    required_permission = "content.view"
    write_permission = "content.manage"

    @extend_schema(tags=["admin-content"], request=ContentPageInputSerializer, responses={200: ContentPageSerializer})
    def patch(self, request, page_id: int):
        serializer = ContentPageInputSerializer(data=request.data, context={"page_id": page_id})
        serializer.is_valid(raise_exception=True)
        page = get_object_or_404(ContentPage, id=page_id)
        updated = update_content_page(page=page, operator=request.user, **serializer.validated_data)
        return success_response(ContentPageSerializer(updated).data)

    @extend_schema(tags=["admin-content"], responses={200: ContentPageSerializer})
    def delete(self, request, page_id: int):
        page = get_object_or_404(ContentPage, id=page_id)
        hidden = hide_content_page(page=page, operator=request.user)
        return success_response(ContentPageSerializer(hidden).data)


class AdminContentPagePublishView(APIView):
    authentication_classes = [AdminTokenAuthentication]
    permission_classes = [HasAdminPermission]
    required_permission = "content.view"
    write_permission = "content.manage"

    @extend_schema(tags=["admin-content"], request=None, responses={200: ContentPageSerializer})
    def post(self, request, page_id: int):
        page = get_object_or_404(ContentPage, id=page_id)
        published = publish_content_page(page=page, operator=request.user)
        return success_response(ContentPageSerializer(published).data)


class AdminContentPageHideView(APIView):
    authentication_classes = [AdminTokenAuthentication]
    permission_classes = [HasAdminPermission]
    required_permission = "content.view"
    write_permission = "content.manage"

    @extend_schema(tags=["admin-content"], request=None, responses={200: ContentPageSerializer})
    def post(self, request, page_id: int):
        page = get_object_or_404(ContentPage, id=page_id)
        hidden = hide_content_page(page=page, operator=request.user)
        return success_response(ContentPageSerializer(hidden).data)
