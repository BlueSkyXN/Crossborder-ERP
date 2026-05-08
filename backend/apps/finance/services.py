from dataclasses import dataclass
from decimal import Decimal
from uuid import uuid4

from django.db import transaction
from django.utils import timezone
from rest_framework import exceptions

from apps.files.models import FileOwnerType, FileStatus, FileUsage, StoredFile
from apps.iam.models import AdminUser
from apps.members.models import User
from apps.waybills.models import Waybill, WaybillStatus

from .models import (
    PaymentBusinessType,
    PaymentOrder,
    PaymentOrderStatus,
    RechargeRequest,
    RechargeRequestStatus,
    Wallet,
    WalletTransaction,
    WalletTransactionDirection,
    WalletTransactionType,
)


class InsufficientBalanceError(Exception):
    pass


class PaymentStateConflictError(Exception):
    pass


class RechargeRequestStateConflictError(Exception):
    pass


@dataclass(frozen=True)
class WalletPaymentResult:
    wallet: Wallet
    payment_order: PaymentOrder
    transaction: WalletTransaction | None
    waybill: Waybill
    already_paid: bool = False


def _build_payment_no(payment_order_id: int) -> str:
    return f"PAY{payment_order_id:08d}"


def _build_recharge_request_no(request_id: int) -> str:
    return f"RCG{request_id:08d}"


def _build_pending_recharge_request_no() -> str:
    return f"PENDING-{uuid4().hex[:22]}"


def _assert_positive_amount(amount: Decimal, field: str = "amount") -> None:
    if amount <= Decimal("0.00"):
        raise exceptions.ValidationError({field: ["金额必须大于 0"]})


def get_or_create_wallet(user: User, currency: str = "CNY") -> Wallet:
    wallet, _ = Wallet.objects.get_or_create(user=user, currency=currency)
    return wallet


def _locked_wallet(user: User, currency: str = "CNY") -> Wallet:
    get_or_create_wallet(user, currency)
    return Wallet.objects.select_for_update().get(user=user, currency=currency)


def _assert_member_remittance_proof(*, user: User, proof_file_id: str) -> StoredFile:
    proof_file_id = (proof_file_id or "").strip()
    if not proof_file_id:
        raise exceptions.ValidationError({"proof_file_id": ["汇款凭证不能为空"]})

    try:
        stored_file = StoredFile.objects.get(file_id=proof_file_id, status=FileStatus.ACTIVE)
    except StoredFile.DoesNotExist as exc:
        raise exceptions.NotFound("汇款凭证不存在") from exc

    if (
        stored_file.owner_type != FileOwnerType.MEMBER
        or stored_file.uploaded_by_member_id != user.id
        or stored_file.usage != FileUsage.REMITTANCE_PROOF
    ):
        raise exceptions.ValidationError({"proof_file_id": ["汇款凭证无效"]})
    return stored_file


@transaction.atomic
def admin_recharge(
    *,
    user: User,
    operator: AdminUser,
    amount: Decimal,
    currency: str = "CNY",
    remark: str = "",
) -> WalletTransaction:
    _assert_positive_amount(amount)
    wallet = _locked_wallet(user, currency)
    wallet.balance += amount
    wallet.save(update_fields=["balance", "updated_at"])
    recharge = RechargeRequest.objects.create(
        request_no=_build_pending_recharge_request_no(),
        user=user,
        wallet=wallet,
        operator=operator,
        amount=amount,
        currency=currency,
        status=RechargeRequestStatus.COMPLETED,
        remark=remark,
        completed_at=timezone.now(),
    )
    recharge.request_no = _build_recharge_request_no(recharge.id)
    recharge.save(update_fields=["request_no"])
    return WalletTransaction.objects.create(
        wallet=wallet,
        user=user,
        operator=operator,
        type=WalletTransactionType.ADMIN_RECHARGE,
        direction=WalletTransactionDirection.INCREASE,
        amount=amount,
        balance_after=wallet.balance,
        business_type="RECHARGE_REQUEST",
        business_id=recharge.id,
        remark=remark,
    )


@transaction.atomic
def submit_offline_remittance(
    *,
    user: User,
    amount: Decimal,
    proof_file_id: str,
    currency: str = "CNY",
    remark: str = "",
) -> RechargeRequest:
    _assert_positive_amount(amount)
    proof = _assert_member_remittance_proof(user=user, proof_file_id=proof_file_id)
    wallet = _locked_wallet(user, currency)
    recharge = RechargeRequest.objects.create(
        request_no=_build_pending_recharge_request_no(),
        user=user,
        wallet=wallet,
        amount=amount,
        currency=currency,
        proof_file_id=proof.file_id,
        status=RechargeRequestStatus.PENDING,
        remark=remark,
    )
    recharge.request_no = _build_recharge_request_no(recharge.id)
    recharge.save(update_fields=["request_no"])
    return recharge


@transaction.atomic
def approve_offline_remittance(
    *,
    recharge_request: RechargeRequest,
    operator: AdminUser,
    review_remark: str = "",
) -> WalletTransaction:
    locked_request = (
        RechargeRequest.objects.select_for_update()
        .select_related("user", "wallet")
        .get(id=recharge_request.id)
    )
    if not locked_request.proof_file_id:
        raise RechargeRequestStateConflictError("该充值记录不是线下汇款单")
    if locked_request.status != RechargeRequestStatus.PENDING:
        raise RechargeRequestStateConflictError("汇款单已审核，不能重复处理")

    wallet = Wallet.objects.select_for_update().get(id=locked_request.wallet_id)
    wallet.balance += locked_request.amount
    wallet.save(update_fields=["balance", "updated_at"])

    now = timezone.now()
    locked_request.status = RechargeRequestStatus.COMPLETED
    locked_request.operator = operator
    locked_request.review_remark = review_remark
    locked_request.reviewed_at = now
    locked_request.completed_at = now
    locked_request.save(update_fields=["status", "operator", "review_remark", "reviewed_at", "completed_at"])

    return WalletTransaction.objects.create(
        wallet=wallet,
        user=locked_request.user,
        operator=operator,
        type=WalletTransactionType.OFFLINE_REMITTANCE,
        direction=WalletTransactionDirection.INCREASE,
        amount=locked_request.amount,
        balance_after=wallet.balance,
        business_type="RECHARGE_REQUEST",
        business_id=locked_request.id,
        remark=review_remark or locked_request.remark,
    )


@transaction.atomic
def cancel_offline_remittance(
    *,
    recharge_request: RechargeRequest,
    operator: AdminUser,
    review_remark: str = "",
) -> RechargeRequest:
    locked_request = (
        RechargeRequest.objects.select_for_update()
        .select_related("user", "wallet")
        .get(id=recharge_request.id)
    )
    if not locked_request.proof_file_id:
        raise RechargeRequestStateConflictError("该充值记录不是线下汇款单")
    if locked_request.status != RechargeRequestStatus.PENDING:
        raise RechargeRequestStateConflictError("汇款单已审核，不能重复处理")

    locked_request.status = RechargeRequestStatus.CANCELLED
    locked_request.operator = operator
    locked_request.review_remark = review_remark
    locked_request.reviewed_at = timezone.now()
    locked_request.save(update_fields=["status", "operator", "review_remark", "reviewed_at"])
    return locked_request


@transaction.atomic
def admin_deduct(
    *,
    user: User,
    operator: AdminUser,
    amount: Decimal,
    currency: str = "CNY",
    remark: str = "",
) -> WalletTransaction:
    _assert_positive_amount(amount)
    wallet = _locked_wallet(user, currency)
    if wallet.balance < amount:
        raise InsufficientBalanceError("钱包余额不足")
    wallet.balance -= amount
    wallet.save(update_fields=["balance", "updated_at"])
    return WalletTransaction.objects.create(
        wallet=wallet,
        user=user,
        operator=operator,
        type=WalletTransactionType.ADMIN_DEDUCT,
        direction=WalletTransactionDirection.DECREASE,
        amount=amount,
        balance_after=wallet.balance,
        business_type="ADMIN_DEDUCT",
        business_id=None,
        remark=remark,
    )


@transaction.atomic
def create_payment_order(
    *,
    user: User,
    business_type: str,
    business_id: int,
    amount: Decimal,
    idempotency_key: str,
    currency: str = "CNY",
    remark: str = "",
) -> PaymentOrder:
    _assert_positive_amount(amount)
    if not idempotency_key.strip():
        raise exceptions.ValidationError({"idempotency_key": ["幂等键不能为空"]})

    existing = (
        PaymentOrder.objects.select_for_update()
        .filter(business_type=business_type, business_id=business_id)
        .first()
    )
    if existing:
        if existing.user_id != user.id or existing.amount != amount or existing.currency != currency:
            raise PaymentStateConflictError("业务单据已有不一致的支付单")
        if existing.idempotency_key and existing.idempotency_key != idempotency_key:
            raise PaymentStateConflictError("业务单据已有不同幂等键的支付单")
        if not existing.idempotency_key:
            existing.idempotency_key = idempotency_key
            existing.save(update_fields=["idempotency_key", "updated_at"])
        return existing

    payment_order = PaymentOrder.objects.create(
        payment_no="PENDING",
        user=user,
        business_type=business_type,
        business_id=business_id,
        status=PaymentOrderStatus.PENDING,
        amount=amount,
        currency=currency,
        idempotency_key=idempotency_key,
        remark=remark,
    )
    payment_order.payment_no = _build_payment_no(payment_order.id)
    payment_order.save(update_fields=["payment_no", "updated_at"])
    return payment_order


@transaction.atomic
def pay_with_wallet(*, waybill: Waybill, user: User, idempotency_key: str, currency: str = "CNY") -> WalletPaymentResult:
    locked_waybill = Waybill.objects.select_for_update().get(id=waybill.id)
    if locked_waybill.user_id != user.id:
        raise exceptions.NotFound("运单不存在")

    existing_paid_order = (
        PaymentOrder.objects.select_for_update()
        .filter(
            business_type=PaymentBusinessType.WAYBILL,
            business_id=locked_waybill.id,
            status=PaymentOrderStatus.PAID,
        )
        .first()
    )
    if existing_paid_order:
        wallet = _locked_wallet(user, currency)
        return WalletPaymentResult(
            wallet=wallet,
            payment_order=existing_paid_order,
            transaction=existing_paid_order.wallet_transactions.first(),
            waybill=locked_waybill,
            already_paid=True,
        )

    if locked_waybill.status != WaybillStatus.PENDING_PAYMENT:
        raise PaymentStateConflictError("运单当前状态不允许支付")
    if locked_waybill.fee_total <= Decimal("0.00"):
        raise PaymentStateConflictError("运单费用未设置")

    wallet = _locked_wallet(user, currency)
    if wallet.balance < locked_waybill.fee_total:
        raise InsufficientBalanceError("钱包余额不足")

    payment_order = create_payment_order(
        user=user,
        business_type=PaymentBusinessType.WAYBILL,
        business_id=locked_waybill.id,
        amount=locked_waybill.fee_total,
        idempotency_key=idempotency_key,
        currency=currency,
        remark=f"Waybill {locked_waybill.waybill_no}",
    )
    if payment_order.status == PaymentOrderStatus.PAID:
        return WalletPaymentResult(
            wallet=wallet,
            payment_order=payment_order,
            transaction=payment_order.wallet_transactions.first(),
            waybill=locked_waybill,
            already_paid=True,
        )
    if payment_order.status != PaymentOrderStatus.PENDING:
        raise PaymentStateConflictError("支付单当前状态不允许余额支付")

    wallet.balance -= locked_waybill.fee_total
    wallet.save(update_fields=["balance", "updated_at"])
    transaction_record = WalletTransaction.objects.create(
        wallet=wallet,
        user=user,
        payment_order=payment_order,
        type=WalletTransactionType.WAYBILL_PAYMENT,
        direction=WalletTransactionDirection.DECREASE,
        amount=locked_waybill.fee_total,
        balance_after=wallet.balance,
        business_type=PaymentBusinessType.WAYBILL,
        business_id=locked_waybill.id,
        remark=f"运单 {locked_waybill.waybill_no} 余额支付",
    )
    payment_order.status = PaymentOrderStatus.PAID
    payment_order.paid_at = timezone.now()
    payment_order.save(update_fields=["status", "paid_at", "updated_at"])
    locked_waybill.status = WaybillStatus.PENDING_SHIPMENT
    locked_waybill.paid_at = payment_order.paid_at
    locked_waybill.save(update_fields=["status", "paid_at", "updated_at"])
    return WalletPaymentResult(
        wallet=wallet,
        payment_order=payment_order,
        transaction=transaction_record,
        waybill=locked_waybill,
    )
