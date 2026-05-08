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

from .models import PaymentOrder, RechargeRequest, WalletTransaction
from .serializers import (
    OfflineRemittanceCreateSerializer,
    OfflineRemittanceReviewSerializer,
    PaymentOrderSerializer,
    RechargeRequestSerializer,
    WalletAdjustmentSerializer,
    WalletSerializer,
    WalletTransactionSerializer,
    WaybillPaySerializer,
)
from .services import (
    InsufficientBalanceError,
    PaymentStateConflictError,
    RechargeRequestStateConflictError,
    approve_offline_remittance,
    admin_deduct,
    admin_recharge,
    cancel_offline_remittance,
    get_or_create_wallet,
    pay_with_wallet,
    submit_offline_remittance,
)


def insufficient_balance_response(exc: InsufficientBalanceError):
    return error_response("INSUFFICIENT_BALANCE", str(exc), status=status.HTTP_409_CONFLICT)


def payment_state_conflict_response(exc: PaymentStateConflictError):
    return error_response("STATE_CONFLICT", str(exc), status=status.HTTP_409_CONFLICT)


def recharge_request_state_conflict_response(exc: RechargeRequestStateConflictError):
    return error_response("STATE_CONFLICT", str(exc), status=status.HTTP_409_CONFLICT)


def offline_remittance_queryset():
    return RechargeRequest.objects.exclude(proof_file_id="").select_related("user", "wallet", "operator")


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


class OfflineRemittanceListCreateView(APIView):
    authentication_classes = [MemberTokenAuthentication]
    permission_classes = [IsMemberAuthenticated]

    @extend_schema(tags=["finance"], responses={200: RechargeRequestSerializer(many=True)})
    def get(self, request):
        remittances = offline_remittance_queryset().filter(user=request.user)
        return success_response(
            {"items": RechargeRequestSerializer(remittances, many=True, context={"scope": "member"}).data}
        )

    @extend_schema(tags=["finance"], request=OfflineRemittanceCreateSerializer, responses={201: RechargeRequestSerializer})
    def post(self, request):
        serializer = OfflineRemittanceCreateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        remittance = submit_offline_remittance(user=request.user, **serializer.validated_data)
        return success_response(
            RechargeRequestSerializer(remittance, context={"scope": "member"}).data,
            status=status.HTTP_201_CREATED,
        )


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


class AdminOfflineRemittanceListView(APIView):
    authentication_classes = [AdminTokenAuthentication]
    permission_classes = [HasAdminPermission]
    required_permission = "finance.view"

    @extend_schema(tags=["admin-finance"], responses={200: RechargeRequestSerializer(many=True)})
    def get(self, request):
        remittances = offline_remittance_queryset()
        return success_response(
            {"items": RechargeRequestSerializer(remittances, many=True, context={"scope": "admin"}).data}
        )


class AdminOfflineRemittanceApproveView(APIView):
    authentication_classes = [AdminTokenAuthentication]
    permission_classes = [HasAdminPermission]
    required_permission = "finance.view"

    @extend_schema(
        tags=["admin-finance"],
        request=OfflineRemittanceReviewSerializer,
        responses={200: WalletTransactionSerializer},
    )
    def post(self, request, remittance_id: int):
        serializer = OfflineRemittanceReviewSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        remittance = get_object_or_404(offline_remittance_queryset(), id=remittance_id)
        try:
            transaction = approve_offline_remittance(
                recharge_request=remittance,
                operator=request.user,
                **serializer.validated_data,
            )
        except RechargeRequestStateConflictError as exc:
            return recharge_request_state_conflict_response(exc)
        return success_response(WalletTransactionSerializer(transaction).data)


class AdminOfflineRemittanceCancelView(APIView):
    authentication_classes = [AdminTokenAuthentication]
    permission_classes = [HasAdminPermission]
    required_permission = "finance.view"

    @extend_schema(
        tags=["admin-finance"],
        request=OfflineRemittanceReviewSerializer,
        responses={200: RechargeRequestSerializer},
    )
    def post(self, request, remittance_id: int):
        serializer = OfflineRemittanceReviewSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        remittance = get_object_or_404(offline_remittance_queryset(), id=remittance_id)
        try:
            remittance = cancel_offline_remittance(
                recharge_request=remittance,
                operator=request.user,
                **serializer.validated_data,
            )
        except RechargeRequestStateConflictError as exc:
            return recharge_request_state_conflict_response(exc)
        return success_response(RechargeRequestSerializer(remittance, context={"scope": "admin"}).data)


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
