from django.shortcuts import get_object_or_404
from drf_spectacular.utils import extend_schema
from rest_framework import status
from rest_framework.views import APIView

from apps.common.responses import error_response, success_response
from apps.iam.authentication import AdminTokenAuthentication
from apps.iam.permissions import HasAdminPermission
from apps.members.authentication import MemberTokenAuthentication
from apps.members.models import User
from apps.members.permissions import IsMemberAuthenticated
from apps.waybills.models import Waybill
from apps.waybills.serializers import WaybillSerializer

from .models import PaymentOrder, WalletTransaction
from .serializers import (
    PaymentOrderSerializer,
    WalletAdjustmentSerializer,
    WalletSerializer,
    WalletTransactionSerializer,
    WaybillPaySerializer,
)
from .services import (
    InsufficientBalanceError,
    PaymentStateConflictError,
    admin_deduct,
    admin_recharge,
    get_or_create_wallet,
    pay_with_wallet,
)


def insufficient_balance_response(exc: InsufficientBalanceError):
    return error_response("INSUFFICIENT_BALANCE", str(exc), status=status.HTTP_409_CONFLICT)


def payment_state_conflict_response(exc: PaymentStateConflictError):
    return error_response("STATE_CONFLICT", str(exc), status=status.HTTP_409_CONFLICT)


class WalletView(APIView):
    authentication_classes = [MemberTokenAuthentication]
    permission_classes = [IsMemberAuthenticated]

    @extend_schema(tags=["finance"], responses={200: WalletSerializer})
    def get(self, request):
        wallet = get_or_create_wallet(request.user)
        return success_response(WalletSerializer(wallet).data)


class WalletTransactionListView(APIView):
    authentication_classes = [MemberTokenAuthentication]
    permission_classes = [IsMemberAuthenticated]

    @extend_schema(tags=["finance"], responses={200: WalletTransactionSerializer(many=True)})
    def get(self, request):
        transactions = (
            WalletTransaction.objects.filter(user=request.user)
            .select_related("wallet", "user", "payment_order", "operator")
        )
        return success_response({"items": WalletTransactionSerializer(transactions, many=True).data})


class WaybillPayView(APIView):
    authentication_classes = [MemberTokenAuthentication]
    permission_classes = [IsMemberAuthenticated]

    @extend_schema(tags=["finance"], request=WaybillPaySerializer, responses={200: PaymentOrderSerializer})
    def post(self, request, waybill_id: int):
        serializer = WaybillPaySerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        waybill = get_object_or_404(Waybill, id=waybill_id, user=request.user)
        try:
            result = pay_with_wallet(waybill=waybill, user=request.user, **serializer.validated_data)
        except InsufficientBalanceError as exc:
            return insufficient_balance_response(exc)
        except PaymentStateConflictError as exc:
            return payment_state_conflict_response(exc)
        return success_response(
            {
                "payment_order": PaymentOrderSerializer(result.payment_order).data,
                "wallet": WalletSerializer(result.wallet).data,
                "waybill": WaybillSerializer(result.waybill).data,
                "already_paid": result.already_paid,
            }
        )


class AdminWalletTransactionListView(APIView):
    authentication_classes = [AdminTokenAuthentication]
    permission_classes = [HasAdminPermission]
    required_permission = "finance.view"

    @extend_schema(tags=["admin-finance"], responses={200: WalletTransactionSerializer(many=True)})
    def get(self, request):
        transactions = WalletTransaction.objects.select_related("wallet", "user", "payment_order", "operator")
        return success_response({"items": WalletTransactionSerializer(transactions, many=True).data})


class AdminUserWalletRechargeView(APIView):
    authentication_classes = [AdminTokenAuthentication]
    permission_classes = [HasAdminPermission]
    required_permission = "finance.view"

    @extend_schema(tags=["admin-finance"], request=WalletAdjustmentSerializer, responses={201: WalletTransactionSerializer})
    def post(self, request, user_id: int):
        serializer = WalletAdjustmentSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        user = get_object_or_404(User, id=user_id)
        transaction = admin_recharge(user=user, operator=request.user, **serializer.validated_data)
        return success_response(WalletTransactionSerializer(transaction).data, status=status.HTTP_201_CREATED)


class AdminUserWalletDeductView(APIView):
    authentication_classes = [AdminTokenAuthentication]
    permission_classes = [HasAdminPermission]
    required_permission = "finance.view"

    @extend_schema(tags=["admin-finance"], request=WalletAdjustmentSerializer, responses={201: WalletTransactionSerializer})
    def post(self, request, user_id: int):
        serializer = WalletAdjustmentSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        user = get_object_or_404(User, id=user_id)
        try:
            transaction = admin_deduct(user=user, operator=request.user, **serializer.validated_data)
        except InsufficientBalanceError as exc:
            return insufficient_balance_response(exc)
        return success_response(WalletTransactionSerializer(transaction).data, status=status.HTTP_201_CREATED)


class AdminPaymentOrderListView(APIView):
    authentication_classes = [AdminTokenAuthentication]
    permission_classes = [HasAdminPermission]
    required_permission = "finance.view"

    @extend_schema(tags=["admin-finance"], responses={200: PaymentOrderSerializer(many=True)})
    def get(self, request):
        payment_orders = PaymentOrder.objects.select_related("user")
        return success_response({"items": PaymentOrderSerializer(payment_orders, many=True).data})
