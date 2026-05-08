from django.shortcuts import get_object_or_404
from drf_spectacular.utils import extend_schema
from rest_framework import status
from rest_framework.views import APIView

from apps.common.responses import error_response, success_response
from apps.iam.authentication import AdminTokenAuthentication
from apps.iam.permissions import HasAdminPermission
from apps.members.authentication import MemberTokenAuthentication
from apps.members.permissions import IsMemberAuthenticated

from .models import TrackingEvent, Waybill
from .serializers import (
    ConfirmReceiptSerializer,
    TrackingEventCreateSerializer,
    TrackingEventSerializer,
    WaybillCreateSerializer,
    WaybillFeeSerializer,
    WaybillReviewSerializer,
    WaybillSerializer,
    WaybillShipSerializer,
)
from .services import (
    StateConflictError,
    add_tracking_event,
    confirm_receipt,
    create_waybill,
    review_waybill,
    set_waybill_fee,
    ship_waybill,
)


def state_conflict_response(exc: StateConflictError):
    return error_response("STATE_CONFLICT", str(exc), status=status.HTTP_409_CONFLICT)


class WaybillListCreateView(APIView):
    authentication_classes = [MemberTokenAuthentication]
    permission_classes = [IsMemberAuthenticated]

    @extend_schema(tags=["waybills"], responses={200: WaybillSerializer(many=True)})
    def get(self, request):
        waybills = (
            Waybill.objects.filter(user=request.user)
            .select_related("user", "warehouse", "channel", "reviewed_by", "fee_set_by")
            .prefetch_related("parcel_links__parcel")
        )
        return success_response({"items": WaybillSerializer(waybills, many=True).data})

    @extend_schema(tags=["waybills"], request=WaybillCreateSerializer, responses={201: WaybillSerializer})
    def post(self, request):
        serializer = WaybillCreateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        try:
            waybill = create_waybill(user=request.user, **serializer.validated_data)
        except StateConflictError as exc:
            return state_conflict_response(exc)
        return success_response(WaybillSerializer(waybill).data, status=status.HTTP_201_CREATED)


class WaybillDetailView(APIView):
    authentication_classes = [MemberTokenAuthentication]
    permission_classes = [IsMemberAuthenticated]

    @extend_schema(tags=["waybills"], responses={200: WaybillSerializer})
    def get(self, request, waybill_id: int):
        waybill = get_object_or_404(
            Waybill.objects.select_related("user", "warehouse", "channel", "reviewed_by", "fee_set_by").prefetch_related(
                "parcel_links__parcel"
            ),
            id=waybill_id,
            user=request.user,
        )
        return success_response(WaybillSerializer(waybill).data)


class WaybillTrackingEventListView(APIView):
    authentication_classes = [MemberTokenAuthentication]
    permission_classes = [IsMemberAuthenticated]

    @extend_schema(tags=["waybills"], responses={200: TrackingEventSerializer(many=True)})
    def get(self, request, waybill_id: int):
        waybill = get_object_or_404(Waybill, id=waybill_id, user=request.user)
        events = TrackingEvent.objects.filter(waybill=waybill).select_related("operator")
        return success_response({"items": TrackingEventSerializer(events, many=True).data})


class WaybillTrackingQueryView(APIView):
    authentication_classes = [MemberTokenAuthentication]
    permission_classes = [IsMemberAuthenticated]

    @extend_schema(tags=["waybills"], responses={200: TrackingEventSerializer(many=True)})
    def get(self, request):
        waybill_no = request.query_params.get("waybill_no", "").strip()
        if not waybill_no:
            return error_response("VALIDATION_ERROR", "waybill_no 不能为空", status=status.HTTP_400_BAD_REQUEST)
        waybill = get_object_or_404(Waybill, waybill_no=waybill_no, user=request.user)
        events = TrackingEvent.objects.filter(waybill=waybill).select_related("operator")
        return success_response({"waybill": WaybillSerializer(waybill).data, "items": TrackingEventSerializer(events, many=True).data})


class WaybillConfirmReceiptView(APIView):
    authentication_classes = [MemberTokenAuthentication]
    permission_classes = [IsMemberAuthenticated]

    @extend_schema(tags=["waybills"], request=ConfirmReceiptSerializer, responses={200: WaybillSerializer})
    def post(self, request, waybill_id: int):
        serializer = ConfirmReceiptSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        waybill = get_object_or_404(Waybill, id=waybill_id, user=request.user)
        try:
            signed = confirm_receipt(waybill=waybill, user=request.user, **serializer.validated_data)
        except StateConflictError as exc:
            return state_conflict_response(exc)
        return success_response(WaybillSerializer(signed).data)


class AdminWaybillListView(APIView):
    authentication_classes = [AdminTokenAuthentication]
    permission_classes = [HasAdminPermission]
    required_permission = "waybills.view"

    @extend_schema(tags=["admin-waybills"], responses={200: WaybillSerializer(many=True)})
    def get(self, request):
        waybills = Waybill.objects.select_related(
            "user", "warehouse", "channel", "reviewed_by", "fee_set_by"
        ).prefetch_related("parcel_links__parcel")
        return success_response({"items": WaybillSerializer(waybills, many=True).data})


class AdminWaybillReviewView(APIView):
    authentication_classes = [AdminTokenAuthentication]
    permission_classes = [HasAdminPermission]
    required_permission = "waybills.view"

    @extend_schema(tags=["admin-waybills"], request=WaybillReviewSerializer, responses={200: WaybillSerializer})
    def post(self, request, waybill_id: int):
        serializer = WaybillReviewSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        waybill = get_object_or_404(Waybill, id=waybill_id)
        try:
            reviewed = review_waybill(waybill=waybill, operator=request.user, **serializer.validated_data)
        except StateConflictError as exc:
            return state_conflict_response(exc)
        return success_response(WaybillSerializer(reviewed).data)


class AdminWaybillSetFeeView(APIView):
    authentication_classes = [AdminTokenAuthentication]
    permission_classes = [HasAdminPermission]
    required_permission = "waybills.view"

    @extend_schema(tags=["admin-waybills"], request=WaybillFeeSerializer, responses={200: WaybillSerializer})
    def post(self, request, waybill_id: int):
        serializer = WaybillFeeSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        waybill = get_object_or_404(Waybill, id=waybill_id)
        try:
            fee_set = set_waybill_fee(waybill=waybill, operator=request.user, **serializer.validated_data)
        except StateConflictError as exc:
            return state_conflict_response(exc)
        return success_response(WaybillSerializer(fee_set).data)


class AdminWaybillShipView(APIView):
    authentication_classes = [AdminTokenAuthentication]
    permission_classes = [HasAdminPermission]
    required_permission = "waybills.view"

    @extend_schema(tags=["admin-waybills"], request=WaybillShipSerializer, responses={200: WaybillSerializer})
    def post(self, request, waybill_id: int):
        serializer = WaybillShipSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        waybill = get_object_or_404(Waybill, id=waybill_id)
        try:
            shipped = ship_waybill(waybill=waybill, operator=request.user, **serializer.validated_data)
        except StateConflictError as exc:
            return state_conflict_response(exc)
        return success_response(WaybillSerializer(shipped).data)


class AdminWaybillTrackingEventCreateView(APIView):
    authentication_classes = [AdminTokenAuthentication]
    permission_classes = [HasAdminPermission]
    required_permission = "waybills.view"

    @extend_schema(
        tags=["admin-waybills"],
        request=TrackingEventCreateSerializer,
        responses={201: TrackingEventSerializer},
    )
    def post(self, request, waybill_id: int):
        serializer = TrackingEventCreateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        waybill = get_object_or_404(Waybill, id=waybill_id)
        event = add_tracking_event(waybill=waybill, operator=request.user, **serializer.validated_data)
        return success_response(TrackingEventSerializer(event).data, status=status.HTTP_201_CREATED)
