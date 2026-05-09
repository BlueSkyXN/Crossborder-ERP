from django.shortcuts import get_object_or_404
from drf_spectacular.utils import extend_schema
from rest_framework import status
from rest_framework.views import APIView

from apps.common.responses import error_response, success_response
from apps.finance.serializers import PaymentOrderSerializer, WalletSerializer
from apps.finance.services import InsufficientBalanceError, PaymentStateConflictError
from apps.iam.authentication import AdminTokenAuthentication
from apps.iam.permissions import HasAdminPermission
from apps.members.authentication import MemberTokenAuthentication
from apps.members.permissions import IsMemberAuthenticated
from apps.warehouses.models import ConfigStatus, Warehouse
from apps.warehouses.serializers import WarehouseSerializer

from .link_parser import parse_purchase_link
from .models import PurchaseOrder
from .serializers import (
    ManualPurchaseOrderCreateSerializer,
    PurchaseArrivedSerializer,
    PurchaseCancelSerializer,
    PurchaseConvertToParcelSerializer,
    PurchaseExceptionSerializer,
    PurchaseLinkParseResultSerializer,
    PurchaseLinkParseSerializer,
    PurchaseOrderCreateSerializer,
    PurchaseOrderSerializer,
    PurchasePaySerializer,
    PurchaseProcureSerializer,
    PurchaseReviewSerializer,
)
from .services import (
    StateConflictError,
    cancel_purchase_order,
    convert_purchase_order_to_parcel,
    create_manual_purchase_order,
    create_purchase_order_from_cart,
    mark_purchase_order_arrived,
    mark_purchase_order_exception,
    pay_purchase_order_with_wallet,
    procure_purchase_order,
    review_purchase_order,
)


def state_conflict_response(exc: Exception):
    return error_response("STATE_CONFLICT", str(exc), status=status.HTTP_409_CONFLICT)


def insufficient_balance_response(exc: InsufficientBalanceError):
    return error_response("INSUFFICIENT_BALANCE", str(exc), status=status.HTTP_409_CONFLICT)


class PurchaseOrderListCreateView(APIView):
    authentication_classes = [MemberTokenAuthentication]
    permission_classes = [IsMemberAuthenticated]

    @extend_schema(tags=["purchases"], responses={200: PurchaseOrderSerializer(many=True)})
    def get(self, request):
        orders = (
            PurchaseOrder.objects.filter(user=request.user)
            .select_related("user", "reviewed_by", "converted_parcel", "converted_parcel__warehouse")
            .prefetch_related("items", "items__product", "items__sku")
        )
        return success_response({"items": PurchaseOrderSerializer(orders, many=True).data})

    @extend_schema(tags=["purchases"], request=PurchaseOrderCreateSerializer, responses={201: PurchaseOrderSerializer})
    def post(self, request):
        serializer = PurchaseOrderCreateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        purchase_order = create_purchase_order_from_cart(user=request.user, **serializer.validated_data)
        return success_response(PurchaseOrderSerializer(purchase_order).data, status=status.HTTP_201_CREATED)


class ManualPurchaseOrderCreateView(APIView):
    authentication_classes = [MemberTokenAuthentication]
    permission_classes = [IsMemberAuthenticated]

    @extend_schema(tags=["purchases"], request=ManualPurchaseOrderCreateSerializer, responses={201: PurchaseOrderSerializer})
    def post(self, request):
        serializer = ManualPurchaseOrderCreateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        purchase_order = create_manual_purchase_order(user=request.user, **serializer.validated_data)
        return success_response(PurchaseOrderSerializer(purchase_order).data, status=status.HTTP_201_CREATED)


class PurchaseLinkParseView(APIView):
    authentication_classes = [MemberTokenAuthentication]
    permission_classes = [IsMemberAuthenticated]

    @extend_schema(
        tags=["purchases"],
        request=PurchaseLinkParseSerializer,
        responses={200: PurchaseLinkParseResultSerializer},
    )
    def post(self, request):
        serializer = PurchaseLinkParseSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        result = parse_purchase_link(**serializer.validated_data)
        return success_response(PurchaseLinkParseResultSerializer(result).data)


class PurchaseOrderDetailView(APIView):
    authentication_classes = [MemberTokenAuthentication]
    permission_classes = [IsMemberAuthenticated]

    @extend_schema(tags=["purchases"], responses={200: PurchaseOrderSerializer})
    def get(self, request, purchase_order_id: int):
        purchase_order = get_object_or_404(
            PurchaseOrder.objects.filter(user=request.user)
            .select_related("user", "reviewed_by", "converted_parcel", "converted_parcel__warehouse")
            .prefetch_related("items", "items__product", "items__sku"),
            id=purchase_order_id,
        )
        return success_response(PurchaseOrderSerializer(purchase_order).data)


class PurchaseOrderPayView(APIView):
    authentication_classes = [MemberTokenAuthentication]
    permission_classes = [IsMemberAuthenticated]

    @extend_schema(tags=["purchases"], request=PurchasePaySerializer, responses={200: PaymentOrderSerializer})
    def post(self, request, purchase_order_id: int):
        serializer = PurchasePaySerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        purchase_order = get_object_or_404(PurchaseOrder, id=purchase_order_id, user=request.user)
        try:
            result = pay_purchase_order_with_wallet(
                purchase_order=purchase_order,
                user=request.user,
                **serializer.validated_data,
            )
        except InsufficientBalanceError as exc:
            return insufficient_balance_response(exc)
        except PaymentStateConflictError as exc:
            return state_conflict_response(exc)
        return success_response(
            {
                "payment_order": PaymentOrderSerializer(result.payment_order).data,
                "wallet": WalletSerializer(result.wallet).data,
                "purchase_order": PurchaseOrderSerializer(result.purchase_order).data,
                "already_paid": result.already_paid,
            }
        )


class AdminPurchaseOrderListView(APIView):
    authentication_classes = [AdminTokenAuthentication]
    permission_classes = [HasAdminPermission]
    required_permission = "purchases.view"

    @extend_schema(tags=["admin-purchases"], responses={200: PurchaseOrderSerializer(many=True)})
    def get(self, request):
        orders = (
            PurchaseOrder.objects.select_related("user", "reviewed_by", "converted_parcel", "converted_parcel__warehouse")
            .prefetch_related("items", "items__product", "items__sku")
        )
        return success_response({"items": PurchaseOrderSerializer(orders, many=True).data})


class AdminPurchaseWarehouseOptionListView(APIView):
    authentication_classes = [AdminTokenAuthentication]
    permission_classes = [HasAdminPermission]
    required_permission = "purchases.view"

    @extend_schema(tags=["admin-purchases"], responses={200: WarehouseSerializer(many=True)})
    def get(self, request):
        warehouses = Warehouse.objects.filter(status=ConfigStatus.ACTIVE).select_related("address")
        return success_response({"items": WarehouseSerializer(warehouses, many=True).data})


class AdminPurchaseOrderDetailView(APIView):
    authentication_classes = [AdminTokenAuthentication]
    permission_classes = [HasAdminPermission]
    required_permission = "purchases.view"

    @extend_schema(tags=["admin-purchases"], responses={200: PurchaseOrderSerializer})
    def get(self, request, purchase_order_id: int):
        purchase_order = get_object_or_404(
            PurchaseOrder.objects.select_related("user", "reviewed_by", "converted_parcel", "converted_parcel__warehouse")
            .prefetch_related("items", "items__product", "items__sku"),
            id=purchase_order_id,
        )
        return success_response(PurchaseOrderSerializer(purchase_order).data)


class AdminPurchaseOrderReviewView(APIView):
    authentication_classes = [AdminTokenAuthentication]
    permission_classes = [HasAdminPermission]
    required_permission = "purchases.view"

    @extend_schema(tags=["admin-purchases"], request=PurchaseReviewSerializer, responses={200: PurchaseOrderSerializer})
    def post(self, request, purchase_order_id: int):
        serializer = PurchaseReviewSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        purchase_order = get_object_or_404(PurchaseOrder, id=purchase_order_id)
        try:
            reviewed = review_purchase_order(purchase_order=purchase_order, operator=request.user, **serializer.validated_data)
        except StateConflictError as exc:
            return state_conflict_response(exc)
        return success_response(PurchaseOrderSerializer(reviewed).data)


class AdminPurchaseOrderProcureView(APIView):
    authentication_classes = [AdminTokenAuthentication]
    permission_classes = [HasAdminPermission]
    required_permission = "purchases.view"

    @extend_schema(tags=["admin-purchases"], request=PurchaseProcureSerializer, responses={200: PurchaseOrderSerializer})
    def post(self, request, purchase_order_id: int):
        serializer = PurchaseProcureSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        purchase_order = get_object_or_404(PurchaseOrder, id=purchase_order_id)
        try:
            procured = procure_purchase_order(purchase_order=purchase_order, operator=request.user, **serializer.validated_data)
        except StateConflictError as exc:
            return state_conflict_response(exc)
        return success_response(PurchaseOrderSerializer(procured).data)


class AdminPurchaseOrderMarkArrivedView(APIView):
    authentication_classes = [AdminTokenAuthentication]
    permission_classes = [HasAdminPermission]
    required_permission = "purchases.view"

    @extend_schema(tags=["admin-purchases"], request=PurchaseArrivedSerializer, responses={200: PurchaseOrderSerializer})
    def post(self, request, purchase_order_id: int):
        serializer = PurchaseArrivedSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        purchase_order = get_object_or_404(PurchaseOrder, id=purchase_order_id)
        try:
            arrived = mark_purchase_order_arrived(
                purchase_order=purchase_order,
                operator=request.user,
                **serializer.validated_data,
            )
        except StateConflictError as exc:
            return state_conflict_response(exc)
        return success_response(PurchaseOrderSerializer(arrived).data)


class AdminPurchaseOrderConvertToParcelView(APIView):
    authentication_classes = [AdminTokenAuthentication]
    permission_classes = [HasAdminPermission]
    required_permission = "purchases.view"

    @extend_schema(
        tags=["admin-purchases"],
        request=PurchaseConvertToParcelSerializer,
        responses={200: PurchaseOrderSerializer},
    )
    def post(self, request, purchase_order_id: int):
        serializer = PurchaseConvertToParcelSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        purchase_order = get_object_or_404(PurchaseOrder, id=purchase_order_id)
        try:
            converted = convert_purchase_order_to_parcel(
                purchase_order=purchase_order,
                operator=request.user,
                **serializer.validated_data,
            )
        except StateConflictError as exc:
            return state_conflict_response(exc)
        return success_response(PurchaseOrderSerializer(converted).data)


class AdminPurchaseOrderMarkExceptionView(APIView):
    authentication_classes = [AdminTokenAuthentication]
    permission_classes = [HasAdminPermission]
    required_permission = "purchases.view"

    @extend_schema(
        tags=["admin-purchases"],
        request=PurchaseExceptionSerializer,
        responses={200: PurchaseOrderSerializer},
    )
    def post(self, request, purchase_order_id: int):
        serializer = PurchaseExceptionSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        purchase_order = get_object_or_404(PurchaseOrder, id=purchase_order_id)
        try:
            exception_order = mark_purchase_order_exception(
                purchase_order=purchase_order,
                operator=request.user,
                **serializer.validated_data,
            )
        except StateConflictError as exc:
            return state_conflict_response(exc)
        return success_response(PurchaseOrderSerializer(exception_order).data)


class AdminPurchaseOrderCancelView(APIView):
    authentication_classes = [AdminTokenAuthentication]
    permission_classes = [HasAdminPermission]
    required_permission = "purchases.view"

    @extend_schema(
        tags=["admin-purchases"],
        request=PurchaseCancelSerializer,
        responses={200: PurchaseOrderSerializer},
    )
    def post(self, request, purchase_order_id: int):
        serializer = PurchaseCancelSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        purchase_order = get_object_or_404(PurchaseOrder, id=purchase_order_id)
        try:
            cancelled = cancel_purchase_order(purchase_order=purchase_order, **serializer.validated_data)
        except StateConflictError as exc:
            return state_conflict_response(exc)
        return success_response(PurchaseOrderSerializer(cancelled).data)
