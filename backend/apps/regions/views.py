from django.shortcuts import get_object_or_404
from drf_spectacular.utils import extend_schema
from rest_framework import status
from rest_framework.views import APIView

from apps.common.responses import success_response
from apps.iam.authentication import AdminTokenAuthentication
from apps.iam.permissions import HasAdminPermission

from .models import CountryRegion
from .serializers import (
    CountryRegionInputSerializer,
    CountryRegionSerializer,
    CountryRegionTreeSerializer,
)
from .services import create_region, delete_region, get_region_tree, get_regions, update_region


class PublicRegionListView(APIView):
    authentication_classes = []
    permission_classes = []

    @extend_schema(tags=["regions"], responses={200: CountryRegionSerializer(many=True)})
    def get(self, request):
        parent_id = request.query_params.get("parent_id")
        level = request.query_params.get("level")
        regions = get_regions(
            parent_id=int(parent_id) if parent_id else None,
            level=level,
            is_active=True,
        )
        return success_response(CountryRegionSerializer(regions, many=True).data)


class PublicRegionTreeView(APIView):
    authentication_classes = []
    permission_classes = []

    @extend_schema(tags=["regions"], responses={200: CountryRegionTreeSerializer(many=True)})
    def get(self, request):
        roots = get_region_tree()
        return success_response(CountryRegionTreeSerializer(roots, many=True).data)


class AdminRegionListCreateView(APIView):
    authentication_classes = [AdminTokenAuthentication]
    permission_classes = [HasAdminPermission]
    required_permission = "regions.view"
    method_permissions = {"POST": "regions.create"}

    @extend_schema(tags=["admin-regions"], responses={200: CountryRegionSerializer(many=True)})
    def get(self, request):
        parent_id = request.query_params.get("parent_id")
        level = request.query_params.get("level")
        keyword = request.query_params.get("keyword")
        is_active = request.query_params.get("is_active")
        active_val = None
        if is_active is not None:
            active_val = is_active.lower() in ("true", "1")
        regions = get_regions(
            parent_id=int(parent_id) if parent_id else None,
            level=level,
            is_active=active_val,
            keyword=keyword,
        )
        return success_response(CountryRegionSerializer(regions, many=True).data)

    @extend_schema(tags=["admin-regions"], request=CountryRegionInputSerializer, responses={201: CountryRegionSerializer})
    def post(self, request):
        ser = CountryRegionInputSerializer(data=request.data)
        ser.is_valid(raise_exception=True)
        region = create_region(ser.validated_data)
        return success_response(CountryRegionSerializer(region).data, status=status.HTTP_201_CREATED)


class AdminRegionDetailView(APIView):
    authentication_classes = [AdminTokenAuthentication]
    permission_classes = [HasAdminPermission]
    required_permission = "regions.view"
    method_permissions = {"PUT": "regions.update", "DELETE": "regions.delete"}

    def _get_region(self, region_id: int) -> CountryRegion:
        return get_object_or_404(CountryRegion, pk=region_id)

    @extend_schema(tags=["admin-regions"], responses={200: CountryRegionSerializer})
    def get(self, request, region_id: int):
        region = self._get_region(region_id)
        return success_response(CountryRegionSerializer(region).data)

    @extend_schema(tags=["admin-regions"], request=CountryRegionInputSerializer, responses={200: CountryRegionSerializer})
    def put(self, request, region_id: int):
        region = self._get_region(region_id)
        ser = CountryRegionInputSerializer(data=request.data, context={"instance": region})
        ser.is_valid(raise_exception=True)
        region = update_region(region, ser.validated_data)
        return success_response(CountryRegionSerializer(region).data)

    @extend_schema(tags=["admin-regions"], responses={200: dict})
    def delete(self, request, region_id: int):
        region = self._get_region(region_id)
        try:
            delete_region(region)
        except ValueError as e:
            return success_response({"detail": str(e)}, status=status.HTTP_400_BAD_REQUEST)
        return success_response({"detail": "已删除"})
