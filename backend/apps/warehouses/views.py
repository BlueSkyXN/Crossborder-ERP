from django.shortcuts import get_object_or_404
from drf_spectacular.utils import extend_schema
from rest_framework import status, viewsets
from rest_framework.views import APIView

from apps.common.responses import success_response
from apps.iam.authentication import AdminTokenAuthentication
from apps.iam.permissions import HasAdminPermission
from apps.members.authentication import MemberTokenAuthentication
from apps.members.permissions import IsMemberAuthenticated

from .models import (
    ConfigStatus,
    PackagingMethod,
    RatePlan,
    ShippingChannel,
    ValueAddedService,
    Warehouse,
)
from .serializers import (
    MemberWarehouseAddressSerializer,
    PackagingMethodSerializer,
    RatePlanSerializer,
    ShippingChannelSerializer,
    ValueAddedServiceSerializer,
    WarehouseListResponseSerializer,
    WarehouseSerializer,
)
from .services import build_member_warehouse_address


class AdminConfigViewSet(viewsets.ModelViewSet):
    authentication_classes = [AdminTokenAuthentication]
    permission_classes = [HasAdminPermission]
    required_permission = "warehouses.view"
    write_permission = "warehouses.manage"

    def list(self, request, *args, **kwargs):
        serializer = self.get_serializer(self.get_queryset(), many=True)
        return success_response({"items": serializer.data})

    def retrieve(self, request, *args, **kwargs):
        return success_response(self.get_serializer(self.get_object()).data)

    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        instance = serializer.save()
        return success_response(self.get_serializer(instance).data, status=status.HTTP_201_CREATED)

    def update(self, request, *args, **kwargs):
        serializer = self.get_serializer(self.get_object(), data=request.data, partial=False)
        serializer.is_valid(raise_exception=True)
        return success_response(self.get_serializer(serializer.save()).data)

    def partial_update(self, request, *args, **kwargs):
        serializer = self.get_serializer(self.get_object(), data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        return success_response(self.get_serializer(serializer.save()).data)

    def destroy(self, request, *args, **kwargs):
        self.get_object().delete()
        return success_response({"deleted": True})


class AdminWarehouseViewSet(AdminConfigViewSet):
    queryset = Warehouse.objects.select_related("address").all()
    serializer_class = WarehouseSerializer


class AdminShippingChannelViewSet(AdminConfigViewSet):
    queryset = ShippingChannel.objects.all()
    serializer_class = ShippingChannelSerializer


class AdminPackagingMethodViewSet(AdminConfigViewSet):
    queryset = PackagingMethod.objects.all()
    serializer_class = PackagingMethodSerializer


class AdminValueAddedServiceViewSet(AdminConfigViewSet):
    queryset = ValueAddedService.objects.all()
    serializer_class = ValueAddedServiceSerializer


class AdminRatePlanViewSet(AdminConfigViewSet):
    queryset = RatePlan.objects.select_related("channel").all()
    serializer_class = RatePlanSerializer


class WarehouseListView(APIView):
    authentication_classes = []
    permission_classes = []

    @extend_schema(tags=["warehouses"], responses={200: WarehouseListResponseSerializer})
    def get(self, request):
        warehouses = Warehouse.objects.filter(status=ConfigStatus.ACTIVE).select_related("address")
        return success_response({"items": WarehouseSerializer(warehouses, many=True).data})


class WarehouseAddressView(APIView):
    authentication_classes = [MemberTokenAuthentication]
    permission_classes = [IsMemberAuthenticated]

    @extend_schema(tags=["warehouses"], responses={200: MemberWarehouseAddressSerializer})
    def get(self, request, warehouse_id: int):
        warehouse = get_object_or_404(
            Warehouse.objects.select_related("address"),
            id=warehouse_id,
            status=ConfigStatus.ACTIVE,
        )
        return success_response(
            build_member_warehouse_address(warehouse, request.user.profile.warehouse_code)
        )
