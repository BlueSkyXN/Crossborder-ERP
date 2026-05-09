from dataclasses import dataclass
from decimal import Decimal
from uuid import uuid4

from django.db import transaction
from django.utils import timezone
from rest_framework import exceptions

from apps.audit.services import log_audit_event
from apps.files.models import FileOwnerType, FileStatus, FileUsage, StoredFile
from apps.iam.models import AdminUser
from apps.members.models import User
from apps.waybills.models import Waybill, WaybillStatus

from .models import (
    CostType,
    CostTypeStatus,
    Payable,
    PayableStatus,
    PaymentBusinessType,
    PaymentOrder,
    PaymentOrderStatus,
    RechargeRequest,
    RechargeRequestStatus,
    Supplier,
    SupplierStatus,
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


class PayableStateConflictError(Exception):
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


def _build_payable_no(payable_id: int) -> str:
    return f"AP{payable_id:08d}"


def _build_pending_recharge_request_no() -> str:
    return f"PENDING-{uuid4().hex[:22]}"


def _build_pending_payable_no() -> str:
    return f"PENDING-{uuid4().hex[:22]}"


def _log_finance_audit(
    *,
    action: str,
    operator: AdminUser,
    target_type: str,
    target_id: int | None,
    target_repr: str = "",
    metadata: dict | None = None,
) -> None:
    log_audit_event(
        action=action,
        module="finance",
        actor_admin=operator,
        target_type=target_type,
        target_id=target_id,
        target_repr=target_repr,
        metadata=metadata or {},
    )


def _assert_positive_amount(amount: Decimal, field: str = "amount") -> None:
    if amount <= Decimal("0.00"):
        raise exceptions.ValidationError({field: ["金额必须大于 0"]})


def _normalize_code(value: str, field: str = "code") -> str:
    normalized = (value or "").strip().upper()
    if not normalized:
        raise exceptions.ValidationError({field: ["编码不能为空"]})
    return normalized


def _assert_active_supplier(supplier: Supplier) -> None:
    if supplier.status != SupplierStatus.ACTIVE:
        raise exceptions.ValidationError({"supplier_id": ["供应商已停用"]})


def _assert_active_cost_type(cost_type: CostType) -> None:
    if cost_type.status != CostTypeStatus.ACTIVE:
        raise exceptions.ValidationError({"cost_type_id": ["成本类型已停用"]})


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
def create_supplier(
    *,
    code: str,
    name: str,
    status: str = SupplierStatus.ACTIVE,
    contact_name: str = "",
    phone: str = "",
    email: str = "",
    address: str = "",
    bank_account: str = "",
    remark: str = "",
) -> Supplier:
    normalized_code = _normalize_code(code)
    if not name.strip():
        raise exceptions.ValidationError({"name": ["供应商名称不能为空"]})
    return Supplier.objects.create(
        code=normalized_code,
        name=name.strip(),
        status=status,
        contact_name=contact_name.strip(),
        phone=phone.strip(),
        email=email.strip(),
        address=address.strip(),
        bank_account=bank_account.strip(),
        remark=remark.strip(),
    )


@transaction.atomic
def update_supplier(
    *,
    supplier: Supplier,
    code: str,
    name: str,
    status: str = SupplierStatus.ACTIVE,
    contact_name: str = "",
    phone: str = "",
    email: str = "",
    address: str = "",
    bank_account: str = "",
    remark: str = "",
) -> Supplier:
    locked = Supplier.objects.select_for_update().get(id=supplier.id)
    normalized_code = _normalize_code(code)
    if not name.strip():
        raise exceptions.ValidationError({"name": ["供应商名称不能为空"]})
    locked.code = normalized_code
    locked.name = name.strip()
    locked.status = status
    locked.contact_name = contact_name.strip()
    locked.phone = phone.strip()
    locked.email = email.strip()
    locked.address = address.strip()
    locked.bank_account = bank_account.strip()
    locked.remark = remark.strip()
    locked.save(
        update_fields=[
            "code",
            "name",
            "status",
            "contact_name",
            "phone",
            "email",
            "address",
            "bank_account",
            "remark",
            "updated_at",
        ]
    )
    return locked


@transaction.atomic
def create_cost_type(
    *,
    code: str,
    name: str,
    category: str = "",
    status: str = CostTypeStatus.ACTIVE,
    remark: str = "",
) -> CostType:
    normalized_code = _normalize_code(code)
    if not name.strip():
        raise exceptions.ValidationError({"name": ["成本类型名称不能为空"]})
    return CostType.objects.create(
        code=normalized_code,
        name=name.strip(),
        category=category.strip(),
        status=status,
        remark=remark.strip(),
    )


@transaction.atomic
def update_cost_type(
    *,
    cost_type: CostType,
    code: str,
    name: str,
    category: str = "",
    status: str = CostTypeStatus.ACTIVE,
    remark: str = "",
) -> CostType:
    locked = CostType.objects.select_for_update().get(id=cost_type.id)
    normalized_code = _normalize_code(code)
    if not name.strip():
        raise exceptions.ValidationError({"name": ["成本类型名称不能为空"]})
    locked.code = normalized_code
    locked.name = name.strip()
    locked.category = category.strip()
    locked.status = status
    locked.remark = remark.strip()
    locked.save(update_fields=["code", "name", "category", "status", "remark", "updated_at"])
    return locked


def payable_queryset():
    return Payable.objects.select_related(
        "supplier",
        "cost_type",
        "created_by",
        "confirmed_by",
        "settled_by",
        "cancelled_by",
    )


@transaction.atomic
def create_payable(
    *,
    operator: AdminUser,
    supplier: Supplier,
    cost_type: CostType,
    amount: Decimal,
    currency: str = "CNY",
    source_type: str = "",
    source_id: int | None = None,
    description: str = "",
    due_date=None,
) -> Payable:
    _assert_positive_amount(amount)
    _assert_active_supplier(supplier)
    _assert_active_cost_type(cost_type)
    payable = Payable.objects.create(
        payable_no=_build_pending_payable_no(),
        supplier=supplier,
        cost_type=cost_type,
        status=PayableStatus.PENDING_REVIEW,
        amount=amount,
        currency=currency,
        source_type=source_type.strip(),
        source_id=source_id,
        description=description.strip(),
        due_date=due_date,
        created_by=operator,
    )
    payable.payable_no = _build_payable_no(payable.id)
    payable.save(update_fields=["payable_no", "updated_at"])
    _log_finance_audit(
        action="finance.payable.create",
        operator=operator,
        target_type="Payable",
        target_id=payable.id,
        target_repr=payable.payable_no,
        metadata={
            "amount": str(payable.amount),
            "currency": payable.currency,
            "status": payable.status,
            "supplier_id": supplier.id,
            "cost_type_id": cost_type.id,
            "source_type": payable.source_type,
            "source_id": payable.source_id,
        },
    )
    return payable_queryset().get(id=payable.id)


@transaction.atomic
def update_payable(
    *,
    payable: Payable,
    operator: AdminUser | None = None,
    supplier: Supplier,
    cost_type: CostType,
    amount: Decimal,
    currency: str = "CNY",
    source_type: str = "",
    source_id: int | None = None,
    description: str = "",
    due_date=None,
) -> Payable:
    _assert_positive_amount(amount)
    _assert_active_supplier(supplier)
    _assert_active_cost_type(cost_type)
    locked = Payable.objects.select_for_update().get(id=payable.id)
    if locked.status != PayableStatus.PENDING_REVIEW:
        raise PayableStateConflictError("应付款当前状态不允许修改")
    previous = {
        "supplier_id": locked.supplier_id,
        "cost_type_id": locked.cost_type_id,
        "amount": str(locked.amount),
        "currency": locked.currency,
        "source_type": locked.source_type,
        "source_id": locked.source_id,
        "due_date": locked.due_date.isoformat() if locked.due_date else None,
    }
    locked.supplier = supplier
    locked.cost_type = cost_type
    locked.amount = amount
    locked.currency = currency
    locked.source_type = source_type.strip()
    locked.source_id = source_id
    locked.description = description.strip()
    locked.due_date = due_date
    locked.save(
        update_fields=[
            "supplier",
            "cost_type",
            "amount",
            "currency",
            "source_type",
            "source_id",
            "description",
            "due_date",
            "updated_at",
        ]
    )
    if operator:
        _log_finance_audit(
            action="finance.payable.update",
            operator=operator,
            target_type="Payable",
            target_id=locked.id,
            target_repr=locked.payable_no,
            metadata={
                "previous": previous,
                "current": {
                    "supplier_id": locked.supplier_id,
                    "cost_type_id": locked.cost_type_id,
                    "amount": str(locked.amount),
                    "currency": locked.currency,
                    "source_type": locked.source_type,
                    "source_id": locked.source_id,
                    "due_date": locked.due_date.isoformat() if locked.due_date else None,
                },
            },
        )
    return payable_queryset().get(id=locked.id)


@transaction.atomic
def confirm_payable(*, payable: Payable, operator: AdminUser) -> Payable:
    locked = Payable.objects.select_for_update().get(id=payable.id)
    if locked.status == PayableStatus.CONFIRMED:
        return payable_queryset().get(id=locked.id)
    if locked.status != PayableStatus.PENDING_REVIEW:
        raise PayableStateConflictError("应付款当前状态不允许确认")
    previous_status = locked.status
    locked.status = PayableStatus.CONFIRMED
    locked.confirmed_by = operator
    locked.confirmed_at = timezone.now()
    locked.save(update_fields=["status", "confirmed_by", "confirmed_at", "updated_at"])
    _log_finance_audit(
        action="finance.payable.confirm",
        operator=operator,
        target_type="Payable",
        target_id=locked.id,
        target_repr=locked.payable_no,
        metadata={
            "old_status": previous_status,
            "new_status": locked.status,
            "amount": str(locked.amount),
            "currency": locked.currency,
        },
    )
    return payable_queryset().get(id=locked.id)


@transaction.atomic
def settle_payable(
    *,
    payable: Payable,
    operator: AdminUser,
    settlement_reference: str = "",
    settlement_note: str = "",
) -> Payable:
    locked = Payable.objects.select_for_update().get(id=payable.id)
    if locked.status == PayableStatus.SETTLED:
        raise PayableStateConflictError("应付款已核销，不能重复核销")
    if locked.status != PayableStatus.CONFIRMED:
        raise PayableStateConflictError("应付款需要确认后才能核销")
    previous_status = locked.status
    locked.status = PayableStatus.SETTLED
    locked.settled_by = operator
    locked.settled_at = timezone.now()
    locked.settlement_reference = settlement_reference.strip()
    locked.settlement_note = settlement_note.strip()
    locked.save(
        update_fields=[
            "status",
            "settled_by",
            "settled_at",
            "settlement_reference",
            "settlement_note",
            "updated_at",
        ]
    )
    _log_finance_audit(
        action="finance.payable.settle",
        operator=operator,
        target_type="Payable",
        target_id=locked.id,
        target_repr=locked.payable_no,
        metadata={
            "old_status": previous_status,
            "new_status": locked.status,
            "amount": str(locked.amount),
            "currency": locked.currency,
            "settlement_reference": locked.settlement_reference,
        },
    )
    return payable_queryset().get(id=locked.id)


@transaction.atomic
def cancel_payable(*, payable: Payable, operator: AdminUser, cancel_reason: str = "") -> Payable:
    locked = Payable.objects.select_for_update().get(id=payable.id)
    if locked.status == PayableStatus.CANCELLED:
        return payable_queryset().get(id=locked.id)
    if locked.status == PayableStatus.SETTLED:
        raise PayableStateConflictError("已核销应付款不允许取消")
    previous_status = locked.status
    locked.status = PayableStatus.CANCELLED
    locked.cancelled_by = operator
    locked.cancelled_at = timezone.now()
    locked.cancel_reason = cancel_reason.strip()
    locked.save(update_fields=["status", "cancelled_by", "cancelled_at", "cancel_reason", "updated_at"])
    _log_finance_audit(
        action="finance.payable.cancel",
        operator=operator,
        target_type="Payable",
        target_id=locked.id,
        target_repr=locked.payable_no,
        metadata={
            "old_status": previous_status,
            "new_status": locked.status,
            "amount": str(locked.amount),
            "currency": locked.currency,
            "cancel_reason": locked.cancel_reason,
        },
    )
    return payable_queryset().get(id=locked.id)


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
    wallet_transaction = WalletTransaction.objects.create(
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
    _log_finance_audit(
        action="finance.wallet.admin_recharge",
        operator=operator,
        target_type="WalletTransaction",
        target_id=wallet_transaction.id,
        target_repr=wallet_transaction.type,
        metadata={
            "user_id": user.id,
            "wallet_id": wallet.id,
            "amount": str(amount),
            "currency": currency,
            "balance_after": str(wallet.balance),
            "recharge_request_id": recharge.id,
        },
    )
    return wallet_transaction


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

    wallet_transaction = WalletTransaction.objects.create(
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
    _log_finance_audit(
        action="finance.remittance.approve",
        operator=operator,
        target_type="RechargeRequest",
        target_id=locked_request.id,
        target_repr=locked_request.request_no,
        metadata={
            "user_id": locked_request.user_id,
            "wallet_id": wallet.id,
            "wallet_transaction_id": wallet_transaction.id,
            "amount": str(locked_request.amount),
            "currency": locked_request.currency,
            "new_status": locked_request.status,
            "balance_after": str(wallet.balance),
        },
    )
    return wallet_transaction


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
    _log_finance_audit(
        action="finance.remittance.cancel",
        operator=operator,
        target_type="RechargeRequest",
        target_id=locked_request.id,
        target_repr=locked_request.request_no,
        metadata={
            "user_id": locked_request.user_id,
            "wallet_id": locked_request.wallet_id,
            "amount": str(locked_request.amount),
            "currency": locked_request.currency,
            "new_status": locked_request.status,
            "review_remark": locked_request.review_remark,
        },
    )
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
    wallet_transaction = WalletTransaction.objects.create(
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
    _log_finance_audit(
        action="finance.wallet.admin_deduct",
        operator=operator,
        target_type="WalletTransaction",
        target_id=wallet_transaction.id,
        target_repr=wallet_transaction.type,
        metadata={
            "user_id": user.id,
            "wallet_id": wallet.id,
            "amount": str(amount),
            "currency": currency,
            "balance_after": str(wallet.balance),
        },
    )
    return wallet_transaction


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
