from django.shortcuts import get_object_or_404
from drf_spectacular.utils import extend_schema
from rest_framework import status
from rest_framework.views import APIView

from apps.common.responses import error_response, success_response
from apps.iam.authentication import AdminTokenAuthentication
from apps.iam.permissions import HasAdminPermission
from apps.members.authentication import MemberTokenAuthentication
from apps.members.permissions import IsMemberAuthenticated

from .models import Parcel, ParcelStatus, UnclaimedParcel, UnclaimedParcelStatus
from .serializers import (
    AdminUnclaimedParcelCreateSerializer,
    InboundRequestSerializer,
    ParcelForecastSerializer,
    ParcelSerializer,
    ScanInboundResponseSerializer,
    ScanInboundRequestSerializer,
    UnclaimedParcelSerializer,
)
from .services import StateConflictError, forecast_parcel, inbound_parcel, scan_inbound


def state_conflict_response(exc: StateConflictError):
    return error_response("STATE_CONFLICT", str(exc), status=status.HTTP_409_CONFLICT)


class ParcelForecastView(APIView):
    authentication_classes = [MemberTokenAuthentication]
    permission_classes = [IsMemberAuthenticated]

    @extend_schema(tags=["parcels"], request=ParcelForecastSerializer, responses={201: ParcelSerializer})
    def post(self, request):
        serializer = ParcelForecastSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        parcel = forecast_parcel(user=request.user, **serializer.validated_data)
        return success_response(ParcelSerializer(parcel).data, status=status.HTTP_201_CREATED)


class ParcelListView(APIView):
    authentication_classes = [MemberTokenAuthentication]
    permission_classes = [IsMemberAuthenticated]

    @extend_schema(tags=["parcels"], responses={200: ParcelSerializer(many=True)})
    def get(self, request):
        parcels = (
            Parcel.objects.filter(user=request.user)
            .select_related("warehouse", "user")
            .prefetch_related("items", "photos")
        )
        return success_response({"items": ParcelSerializer(parcels, many=True).data})


class PackableParcelListView(APIView):
    authentication_classes = [MemberTokenAuthentication]
    permission_classes = [IsMemberAuthenticated]

    @extend_schema(tags=["parcels"], responses={200: ParcelSerializer(many=True)})
    def get(self, request):
        parcels = (
            Parcel.objects.filter(user=request.user, status=ParcelStatus.IN_STOCK)
            .select_related("warehouse", "user")
            .prefetch_related("items", "photos")
        )
        return success_response({"items": ParcelSerializer(parcels, many=True).data})


class ParcelDetailView(APIView):
    authentication_classes = [MemberTokenAuthentication]
    permission_classes = [IsMemberAuthenticated]

    @extend_schema(tags=["parcels"], responses={200: ParcelSerializer})
    def get(self, request, parcel_id: int):
        parcel = get_object_or_404(
            Parcel.objects.select_related("warehouse", "user").prefetch_related("items", "photos"),
            id=parcel_id,
            user=request.user,
        )
        return success_response(ParcelSerializer(parcel).data)


class AdminParcelListView(APIView):
    authentication_classes = [AdminTokenAuthentication]
    permission_classes = [HasAdminPermission]
    required_permission = "parcels.view"

    @extend_schema(tags=["admin-parcels"], responses={200: ParcelSerializer(many=True)})
    def get(self, request):
        parcels = Parcel.objects.select_related("warehouse", "user").prefetch_related("items", "photos")
        return success_response({"items": ParcelSerializer(parcels, many=True).data})


class AdminParcelInboundView(APIView):
    authentication_classes = [AdminTokenAuthentication]
    permission_classes = [HasAdminPermission]
    required_permission = "parcels.view"

    @extend_schema(tags=["admin-parcels"], request=InboundRequestSerializer, responses={200: ParcelSerializer})
    def post(self, request, parcel_id: int):
        serializer = InboundRequestSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        parcel = get_object_or_404(Parcel, id=parcel_id)
        try:
            inbounded = inbound_parcel(parcel=parcel, operator=request.user, **serializer.validated_data)
        except StateConflictError as exc:
            return state_conflict_response(exc)
        return success_response(ParcelSerializer(inbounded).data)


class AdminParcelScanInboundView(APIView):
    authentication_classes = [AdminTokenAuthentication]
    permission_classes = [HasAdminPermission]
    required_permission = "parcels.view"

    @extend_schema(
        tags=["admin-parcels"],
        request=ScanInboundRequestSerializer,
        responses={200: ScanInboundResponseSerializer, 201: ScanInboundResponseSerializer},
    )
    def post(self, request):
        serializer = ScanInboundRequestSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        try:
            result = scan_inbound(operator=request.user, **serializer.validated_data)
        except StateConflictError as exc:
            return state_conflict_response(exc)

        if result.parcel:
            return success_response({"parcel": ParcelSerializer(result.parcel).data, "unclaimed_parcel": None})
        return success_response(
            {
                "parcel": None,
                "unclaimed_parcel": UnclaimedParcelSerializer(result.unclaimed_parcel).data,
                "created_unclaimed": result.created_unclaimed,
            },
            status=status.HTTP_201_CREATED if result.created_unclaimed else status.HTTP_200_OK,
        )


class AdminUnclaimedParcelListCreateView(APIView):
    authentication_classes = [AdminTokenAuthentication]
    permission_classes = [HasAdminPermission]
    required_permission = "parcels.view"

    @extend_schema(tags=["admin-parcels"], responses={200: UnclaimedParcelSerializer(many=True)})
    def get(self, request):
        unclaimed = UnclaimedParcel.objects.select_related("warehouse", "claimed_by_user").all()
        return success_response({"items": UnclaimedParcelSerializer(unclaimed, many=True).data})

    @extend_schema(
        tags=["admin-parcels"],
        request=AdminUnclaimedParcelCreateSerializer,
        responses={201: UnclaimedParcelSerializer},
    )
    def post(self, request):
        serializer = AdminUnclaimedParcelCreateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        unclaimed = UnclaimedParcel.objects.create(
            status=UnclaimedParcelStatus.UNCLAIMED,
            **serializer.validated_data,
        )
        return success_response(UnclaimedParcelSerializer(unclaimed).data, status=status.HTTP_201_CREATED)
