from django.shortcuts import get_object_or_404
from django.db.models import Count
from drf_spectacular.utils import extend_schema
from rest_framework import status
from rest_framework.views import APIView

from apps.common.responses import error_response, success_response
from apps.iam.authentication import AdminTokenAuthentication
from apps.iam.permissions import HasAdminPermission
from apps.members.authentication import MemberTokenAuthentication
from apps.members.permissions import IsMemberAuthenticated

from .models import ShippingBatch, TrackingEvent, Waybill
from .serializers import (
    ConfirmReceiptSerializer,
    ShippingBatchCreateSerializer,
    ShippingBatchPrintPreviewSerializer,
    ShippingBatchSerializer,
    ShippingBatchWaybillIdsSerializer,
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
    add_shipping_batch_tracking_event,
    add_waybills_to_shipping_batch,
    build_shipping_batch_print_preview,
    confirm_receipt,
    create_waybill,
    create_shipping_batch,
    lock_shipping_batch,
    remove_waybill_from_shipping_batch,
    review_waybill,
    set_waybill_fee,
    ship_shipping_batch,
    ship_waybill,
    update_shipping_batch,
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
        serializer = WaybillCreateSerializer(data=request.data, context={"request": request})
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
    write_permission = "waybills.manage"

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
    write_permission = "waybills.manage"

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
    write_permission = "waybills.manage"

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
    write_permission = "waybills.manage"

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


def shipping_batch_queryset():
    return (
        ShippingBatch.objects.select_related("warehouse", "channel", "created_by", "locked_by", "shipped_by")
        .prefetch_related("waybills__user", "waybills__warehouse", "waybills__channel", "waybills__parcel_links__parcel")
        .annotate(waybill_count=Count("waybills"))
    )


class AdminShippingBatchListCreateView(APIView):
    authentication_classes = [AdminTokenAuthentication]
    permission_classes = [HasAdminPermission]
    required_permission = "waybills.view"
    write_permission = "waybills.manage"

    @extend_schema(tags=["admin-shipping-batches"], responses={200: ShippingBatchSerializer(many=True)})
    def get(self, request):
        batches = shipping_batch_queryset()
        return success_response({"items": ShippingBatchSerializer(batches, many=True).data})

    @extend_schema(
        tags=["admin-shipping-batches"],
        request=ShippingBatchCreateSerializer,
        responses={201: ShippingBatchSerializer},
    )
    def post(self, request):
        serializer = ShippingBatchCreateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        try:
            batch = create_shipping_batch(operator=request.user, **serializer.validated_data)
        except StateConflictError as exc:
            return state_conflict_response(exc)
        return success_response(ShippingBatchSerializer(batch).data, status=status.HTTP_201_CREATED)


class AdminShippingBatchDetailView(APIView):
    authentication_classes = [AdminTokenAuthentication]
    permission_classes = [HasAdminPermission]
    required_permission = "waybills.view"
    write_permission = "waybills.manage"

    @extend_schema(tags=["admin-shipping-batches"], responses={200: ShippingBatchSerializer})
    def get(self, request, batch_id: int):
        batch = get_object_or_404(shipping_batch_queryset(), id=batch_id)
        return success_response(ShippingBatchSerializer(batch).data)

    @extend_schema(
        tags=["admin-shipping-batches"],
        request=ShippingBatchCreateSerializer,
        responses={200: ShippingBatchSerializer},
    )
    def patch(self, request, batch_id: int):
        serializer = ShippingBatchCreateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        batch = get_object_or_404(ShippingBatch, id=batch_id)
        update_data = dict(serializer.validated_data)
        update_data.pop("waybill_ids", None)
        try:
            updated = update_shipping_batch(batch=batch, **update_data)
        except StateConflictError as exc:
            return state_conflict_response(exc)
        return success_response(ShippingBatchSerializer(updated).data)


class AdminShippingBatchWaybillListView(APIView):
    authentication_classes = [AdminTokenAuthentication]
    permission_classes = [HasAdminPermission]
    required_permission = "waybills.view"
    write_permission = "waybills.manage"

    @extend_schema(
        tags=["admin-shipping-batches"],
        request=ShippingBatchWaybillIdsSerializer,
        responses={200: ShippingBatchSerializer},
    )
    def post(self, request, batch_id: int):
        serializer = ShippingBatchWaybillIdsSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        batch = get_object_or_404(ShippingBatch, id=batch_id)
        try:
            updated = add_waybills_to_shipping_batch(batch=batch, **serializer.validated_data)
        except StateConflictError as exc:
            return state_conflict_response(exc)
        return success_response(ShippingBatchSerializer(updated).data)


class AdminShippingBatchWaybillDetailView(APIView):
    authentication_classes = [AdminTokenAuthentication]
    permission_classes = [HasAdminPermission]
    required_permission = "waybills.view"
    write_permission = "waybills.manage"

    @extend_schema(tags=["admin-shipping-batches"], responses={200: ShippingBatchSerializer})
    def delete(self, request, batch_id: int, waybill_id: int):
        batch = get_object_or_404(ShippingBatch, id=batch_id)
        try:
            updated = remove_waybill_from_shipping_batch(batch=batch, waybill_id=waybill_id)
        except StateConflictError as exc:
            return state_conflict_response(exc)
        return success_response(ShippingBatchSerializer(updated).data)


class AdminShippingBatchLockView(APIView):
    authentication_classes = [AdminTokenAuthentication]
    permission_classes = [HasAdminPermission]
    required_permission = "waybills.view"
    write_permission = "waybills.manage"

    @extend_schema(tags=["admin-shipping-batches"], request=None, responses={200: ShippingBatchSerializer})
    def post(self, request, batch_id: int):
        batch = get_object_or_404(ShippingBatch, id=batch_id)
        try:
            locked = lock_shipping_batch(batch=batch, operator=request.user)
        except StateConflictError as exc:
            return state_conflict_response(exc)
        return success_response(ShippingBatchSerializer(locked).data)


class AdminShippingBatchShipView(APIView):
    authentication_classes = [AdminTokenAuthentication]
    permission_classes = [HasAdminPermission]
    required_permission = "waybills.view"
    write_permission = "waybills.manage"

    @extend_schema(tags=["admin-shipping-batches"], request=WaybillShipSerializer, responses={200: ShippingBatchSerializer})
    def post(self, request, batch_id: int):
        serializer = WaybillShipSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        batch = get_object_or_404(ShippingBatch, id=batch_id)
        try:
            shipped = ship_shipping_batch(batch=batch, operator=request.user, **serializer.validated_data)
        except StateConflictError as exc:
            return state_conflict_response(exc)
        return success_response(ShippingBatchSerializer(shipped).data)


class AdminShippingBatchTrackingEventCreateView(APIView):
    authentication_classes = [AdminTokenAuthentication]
    permission_classes = [HasAdminPermission]
    required_permission = "waybills.view"
    write_permission = "waybills.manage"

    @extend_schema(
        tags=["admin-shipping-batches"],
        request=TrackingEventCreateSerializer,
        responses={201: TrackingEventSerializer(many=True)},
    )
    def post(self, request, batch_id: int):
        serializer = TrackingEventCreateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        batch = get_object_or_404(ShippingBatch, id=batch_id)
        try:
            events = add_shipping_batch_tracking_event(batch=batch, operator=request.user, **serializer.validated_data)
        except StateConflictError as exc:
            return state_conflict_response(exc)
        event_items = TrackingEventSerializer(events, many=True).data
        payload = {"items": event_items}
        if event_items:
            payload.update(event_items[0])
        return success_response(payload, status=status.HTTP_201_CREATED)


class AdminShippingBatchPrintPreviewView(APIView):
    authentication_classes = [AdminTokenAuthentication]
    permission_classes = [HasAdminPermission]
    required_permission = "waybills.view"

    @extend_schema(tags=["admin-shipping-batches"], responses={200: dict})
    def get(self, request, batch_id: int):
        serializer = ShippingBatchPrintPreviewSerializer(data=request.query_params)
        serializer.is_valid(raise_exception=True)
        batch = get_object_or_404(ShippingBatch, id=batch_id)
        preview = build_shipping_batch_print_preview(batch=batch, **serializer.validated_data)
        return success_response(preview)
