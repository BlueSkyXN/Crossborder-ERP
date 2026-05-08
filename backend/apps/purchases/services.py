from dataclasses import dataclass
from decimal import Decimal

from django.db import transaction
from django.utils import timezone
from rest_framework import exceptions

from apps.finance.models import (
    PaymentBusinessType,
    PaymentOrder,
    PaymentOrderStatus,
    Wallet,
    WalletTransaction,
    WalletTransactionDirection,
    WalletTransactionType,
)
from apps.finance.services import InsufficientBalanceError, PaymentStateConflictError, create_payment_order, get_or_create_wallet
from apps.iam.models import AdminUser
from apps.members.models import User
from apps.parcels.models import InboundRecord, Parcel, ParcelItem, ParcelStatus
from apps.products.models import CartItem, CatalogStatus
from apps.warehouses.models import Warehouse

from .models import ProcurementTask, ProcurementTaskStatus, PurchaseOrder, PurchaseOrderItem, PurchaseOrderSourceType, PurchaseOrderStatus


class StateConflictError(Exception):
    pass


@dataclass(frozen=True)
class PurchaseWalletPaymentResult:
    wallet: Wallet
    payment_order: PaymentOrder
    transaction: WalletTransaction | None
    purchase_order: PurchaseOrder
    already_paid: bool = False


def _build_purchase_order_no(purchase_order_id: int) -> str:
    return f"PO{purchase_order_id:08d}"


def _build_parcel_no(parcel_id: int) -> str:
    return f"P{parcel_id:08d}"


def _dimensions_json(length_cm: Decimal | None, width_cm: Decimal | None, height_cm: Decimal | None) -> dict:
    return {
        "length_cm": str(length_cm) if length_cm is not None else "",
        "width_cm": str(width_cm) if width_cm is not None else "",
        "height_cm": str(height_cm) if height_cm is not None else "",
    }


def _locked_wallet(user: User, currency: str = "CNY") -> Wallet:
    get_or_create_wallet(user, currency)
    return Wallet.objects.select_for_update().get(user=user, currency=currency)


def _assert_non_negative_amount(amount: Decimal, field: str) -> None:
    if amount < Decimal("0.00"):
        raise exceptions.ValidationError({field: ["金额不能为负数"]})


def _line_amount(item: dict) -> Decimal:
    actual_price = item.get("actual_price")
    unit_price = item.get("unit_price", Decimal("0.00"))
    price = actual_price if actual_price is not None else unit_price
    return price * item["quantity"]


def _assert_payable_total(total_amount: Decimal) -> None:
    if total_amount <= Decimal("0.00"):
        raise exceptions.ValidationError({"total_amount": ["订单金额必须大于 0"]})


def get_purchase_order_for_output(purchase_order_id: int) -> PurchaseOrder:
    return (
        PurchaseOrder.objects.select_related("user", "reviewed_by", "converted_parcel", "converted_parcel__warehouse")
        .prefetch_related("items", "items__product", "items__sku")
        .select_related("procurement_task", "procurement_task__assignee")
        .get(id=purchase_order_id)
    )


@transaction.atomic
def create_manual_purchase_order(*, user: User, items: list[dict], service_fee: Decimal = Decimal("0.00")) -> PurchaseOrder:
    _assert_non_negative_amount(service_fee, "service_fee")
    normalized_items = []
    for item in items:
        unit_price = item["unit_price"]
        actual_price = item.get("actual_price")
        _assert_non_negative_amount(unit_price, "unit_price")
        if actual_price is not None:
            _assert_non_negative_amount(actual_price, "actual_price")
        normalized_items.append(
            {
                "name": item["name"],
                "quantity": item["quantity"],
                "unit_price": unit_price,
                "actual_price": actual_price if actual_price is not None else unit_price,
                "product_url": item.get("product_url", ""),
                "remark": item.get("remark", ""),
            }
        )

    total_amount = sum((_line_amount(item) for item in normalized_items), service_fee)
    _assert_payable_total(total_amount)

    order = PurchaseOrder.objects.create(
        order_no="PENDING",
        user=user,
        status=PurchaseOrderStatus.PENDING_PAYMENT,
        source_type=PurchaseOrderSourceType.MANUAL,
        total_amount=total_amount,
        service_fee=service_fee,
    )
    order.order_no = _build_purchase_order_no(order.id)
    order.save(update_fields=["order_no", "updated_at"])
    PurchaseOrderItem.objects.bulk_create([PurchaseOrderItem(purchase_order=order, **item) for item in normalized_items])
    return get_purchase_order_for_output(order.id)


@transaction.atomic
def create_purchase_order_from_cart(
    *,
    user: User,
    cart_item_ids: list[int] | None = None,
    service_fee: Decimal = Decimal("0.00"),
) -> PurchaseOrder:
    _assert_non_negative_amount(service_fee, "service_fee")
    queryset = (
        CartItem.objects.select_for_update()
        .select_related("product", "sku")
        .filter(user=user)
        .order_by("id")
    )
    if cart_item_ids:
        normalized_ids = list(dict.fromkeys(cart_item_ids))
        queryset = queryset.filter(id__in=normalized_ids)
    cart_items = list(queryset)
    if not cart_items:
        raise exceptions.ValidationError({"cart_item_ids": ["购物车商品不能为空"]})
    if cart_item_ids and len(cart_items) != len(set(cart_item_ids)):
        raise exceptions.ValidationError({"cart_item_ids": ["购物车商品不存在或不属于当前用户"]})

    order_items = []
    for cart_item in cart_items:
        if cart_item.product.status != CatalogStatus.ACTIVE or cart_item.sku.status != CatalogStatus.ACTIVE:
            raise exceptions.ValidationError({"cart_item_ids": ["购物车包含不可购买商品"]})
        if cart_item.sku.stock < cart_item.quantity:
            raise exceptions.ValidationError({"cart_item_ids": ["购物车包含库存不足商品"]})
        order_items.append(
            {
                "product": cart_item.product,
                "sku": cart_item.sku,
                "name": cart_item.product.title,
                "quantity": cart_item.quantity,
                "unit_price": cart_item.sku.price,
                "actual_price": cart_item.sku.price,
                "product_url": "",
                "remark": "",
            }
        )

    total_amount = sum((_line_amount(item) for item in order_items), service_fee)
    _assert_payable_total(total_amount)
    order = PurchaseOrder.objects.create(
        order_no="PENDING",
        user=user,
        status=PurchaseOrderStatus.PENDING_PAYMENT,
        source_type=PurchaseOrderSourceType.PRODUCT,
        total_amount=total_amount,
        service_fee=service_fee,
    )
    order.order_no = _build_purchase_order_no(order.id)
    order.save(update_fields=["order_no", "updated_at"])
    PurchaseOrderItem.objects.bulk_create([PurchaseOrderItem(purchase_order=order, **item) for item in order_items])
    CartItem.objects.filter(id__in=[item.id for item in cart_items]).delete()
    return get_purchase_order_for_output(order.id)


@transaction.atomic
def pay_purchase_order_with_wallet(
    *,
    purchase_order: PurchaseOrder,
    user: User,
    idempotency_key: str,
    currency: str = "CNY",
) -> PurchaseWalletPaymentResult:
    locked_order = PurchaseOrder.objects.select_for_update().get(id=purchase_order.id)
    if locked_order.user_id != user.id:
        raise exceptions.NotFound("代购订单不存在")

    existing_paid_order = (
        PaymentOrder.objects.select_for_update()
        .filter(
            business_type=PaymentBusinessType.PURCHASE_ORDER,
            business_id=locked_order.id,
            status=PaymentOrderStatus.PAID,
        )
        .first()
    )
    if existing_paid_order:
        wallet = _locked_wallet(user, currency)
        return PurchaseWalletPaymentResult(
            wallet=wallet,
            payment_order=existing_paid_order,
            transaction=existing_paid_order.wallet_transactions.first(),
            purchase_order=get_purchase_order_for_output(locked_order.id),
            already_paid=True,
        )

    if locked_order.status != PurchaseOrderStatus.PENDING_PAYMENT:
        raise PaymentStateConflictError("代购订单当前状态不允许支付")
    if locked_order.total_amount <= Decimal("0.00"):
        raise PaymentStateConflictError("代购订单金额未设置")

    wallet = _locked_wallet(user, currency)
    if wallet.balance < locked_order.total_amount:
        raise InsufficientBalanceError("钱包余额不足")

    payment_order = create_payment_order(
        user=user,
        business_type=PaymentBusinessType.PURCHASE_ORDER,
        business_id=locked_order.id,
        amount=locked_order.total_amount,
        idempotency_key=idempotency_key,
        currency=currency,
        remark=f"Purchase order {locked_order.order_no}",
    )
    if payment_order.status == PaymentOrderStatus.PAID:
        return PurchaseWalletPaymentResult(
            wallet=wallet,
            payment_order=payment_order,
            transaction=payment_order.wallet_transactions.first(),
            purchase_order=get_purchase_order_for_output(locked_order.id),
            already_paid=True,
        )
    if payment_order.status != PaymentOrderStatus.PENDING:
        raise PaymentStateConflictError("支付单当前状态不允许余额支付")

    wallet.balance -= locked_order.total_amount
    wallet.save(update_fields=["balance", "updated_at"])
    transaction_record = WalletTransaction.objects.create(
        wallet=wallet,
        user=user,
        payment_order=payment_order,
        type=WalletTransactionType.PURCHASE_PAYMENT,
        direction=WalletTransactionDirection.DECREASE,
        amount=locked_order.total_amount,
        balance_after=wallet.balance,
        business_type=PaymentBusinessType.PURCHASE_ORDER,
        business_id=locked_order.id,
        remark=f"代购单 {locked_order.order_no} 余额支付",
    )
    paid_at = timezone.now()
    payment_order.status = PaymentOrderStatus.PAID
    payment_order.paid_at = paid_at
    payment_order.save(update_fields=["status", "paid_at", "updated_at"])
    locked_order.status = PurchaseOrderStatus.PENDING_REVIEW
    locked_order.paid_at = paid_at
    locked_order.save(update_fields=["status", "paid_at", "updated_at"])
    return PurchaseWalletPaymentResult(
        wallet=wallet,
        payment_order=payment_order,
        transaction=transaction_record,
        purchase_order=get_purchase_order_for_output(locked_order.id),
    )


@transaction.atomic
def review_purchase_order(*, purchase_order: PurchaseOrder, operator: AdminUser, review_remark: str = "") -> PurchaseOrder:
    locked = PurchaseOrder.objects.select_for_update().get(id=purchase_order.id)
    if locked.status != PurchaseOrderStatus.PENDING_REVIEW:
        raise StateConflictError("代购订单当前状态不允许审核")
    locked.status = PurchaseOrderStatus.PENDING_PROCUREMENT
    locked.reviewed_by = operator
    locked.reviewed_at = timezone.now()
    locked.review_remark = review_remark
    locked.save(update_fields=["status", "reviewed_by", "reviewed_at", "review_remark", "updated_at"])
    ProcurementTask.objects.get_or_create(purchase_order=locked, defaults={"assignee": operator})
    return get_purchase_order_for_output(locked.id)


@transaction.atomic
def procure_purchase_order(
    *,
    purchase_order: PurchaseOrder,
    operator: AdminUser,
    purchase_amount: Decimal | None = None,
    external_order_no: str = "",
    tracking_no: str = "",
    remark: str = "",
) -> PurchaseOrder:
    locked = PurchaseOrder.objects.select_for_update().get(id=purchase_order.id)
    if locked.status != PurchaseOrderStatus.PENDING_PROCUREMENT:
        raise StateConflictError("代购订单当前状态不允许采购")
    if purchase_amount is None:
        purchase_amount = locked.total_amount - locked.service_fee
    _assert_non_negative_amount(purchase_amount, "purchase_amount")
    task, _ = ProcurementTask.objects.select_for_update().get_or_create(purchase_order=locked)
    task.assignee = operator
    task.status = ProcurementTaskStatus.PROCURED
    task.purchase_amount = purchase_amount
    task.external_order_no = external_order_no
    task.tracking_no = tracking_no
    task.remark = remark
    task.procured_at = timezone.now()
    task.save(
        update_fields=[
            "assignee",
            "status",
            "purchase_amount",
            "external_order_no",
            "tracking_no",
            "remark",
            "procured_at",
            "updated_at",
        ]
    )
    locked.status = PurchaseOrderStatus.PROCURED
    locked.save(update_fields=["status", "updated_at"])
    return get_purchase_order_for_output(locked.id)


@transaction.atomic
def mark_purchase_order_arrived(
    *,
    purchase_order: PurchaseOrder,
    operator: AdminUser,
    tracking_no: str = "",
    remark: str = "",
) -> PurchaseOrder:
    locked = PurchaseOrder.objects.select_for_update().get(id=purchase_order.id)
    if locked.status != PurchaseOrderStatus.PROCURED:
        raise StateConflictError("代购订单当前状态不允许标记到货")
    task, _ = ProcurementTask.objects.select_for_update().get_or_create(purchase_order=locked)
    task.assignee = task.assignee or operator
    task.status = ProcurementTaskStatus.ARRIVED
    if tracking_no:
        task.tracking_no = tracking_no
    if remark:
        task.remark = remark
    task.arrived_at = timezone.now()
    task.save(update_fields=["assignee", "status", "tracking_no", "remark", "arrived_at", "updated_at"])
    locked.status = PurchaseOrderStatus.ARRIVED
    locked.save(update_fields=["status", "updated_at"])
    return get_purchase_order_for_output(locked.id)


@transaction.atomic
def convert_purchase_order_to_parcel(
    *,
    purchase_order: PurchaseOrder,
    operator: AdminUser,
    warehouse: Warehouse,
    weight_kg: Decimal,
    tracking_no: str = "",
    carrier: str = "",
    length_cm: Decimal | None = None,
    width_cm: Decimal | None = None,
    height_cm: Decimal | None = None,
    remark: str = "",
) -> PurchaseOrder:
    locked = (
        PurchaseOrder.objects.select_for_update()
        .select_related("user")
        .prefetch_related("items")
        .get(id=purchase_order.id)
    )
    if locked.status != PurchaseOrderStatus.ARRIVED:
        raise StateConflictError("代购订单当前状态不允许转包裹")
    if locked.converted_parcel_id:
        raise StateConflictError("代购订单已转包裹")

    task = getattr(locked, "procurement_task", None)
    final_tracking_no = (tracking_no or getattr(task, "tracking_no", "") or f"{locked.order_no}-ARRIVED").strip()
    if not final_tracking_no:
        raise exceptions.ValidationError({"tracking_no": ["包裹快递单号不能为空"]})
    if Parcel.objects.filter(tracking_no=final_tracking_no).exists():
        raise exceptions.ValidationError({"tracking_no": ["包裹快递单号已存在"]})

    parcel = Parcel.objects.create(
        parcel_no="PENDING",
        user=locked.user,
        warehouse=warehouse,
        tracking_no=final_tracking_no,
        carrier=carrier,
        status=ParcelStatus.IN_STOCK,
        weight_kg=weight_kg,
        length_cm=length_cm,
        width_cm=width_cm,
        height_cm=height_cm,
        inbound_at=timezone.now(),
        remark=remark or f"由代购单 {locked.order_no} 到货转入",
    )
    parcel.parcel_no = _build_parcel_no(parcel.id)
    parcel.save(update_fields=["parcel_no", "updated_at"])
    ParcelItem.objects.bulk_create(
        [
            ParcelItem(
                parcel=parcel,
                name=item.name,
                quantity=item.quantity,
                declared_value=item.actual_price,
                product_url=item.product_url,
                remark=item.remark,
            )
            for item in locked.items.all()
        ]
    )
    InboundRecord.objects.create(
        parcel=parcel,
        operator=operator,
        weight_kg=weight_kg,
        dimensions_json=_dimensions_json(length_cm, width_cm, height_cm),
        remark=remark or f"代购单 {locked.order_no} 到货转包裹",
    )
    locked.status = PurchaseOrderStatus.COMPLETED
    locked.converted_parcel = parcel
    locked.save(update_fields=["status", "converted_parcel", "updated_at"])
    return get_purchase_order_for_output(locked.id)
