from decimal import Decimal
from typing import Any

from django.db.models import Sum
from django.utils import timezone

from apps.audit.models import AuditLog
from apps.content.models import ContentPage, ContentStatus
from apps.finance.models import (
    Payable,
    PayableStatus,
    PaymentOrder,
    PaymentOrderStatus,
    RechargeRequest,
    RechargeRequestStatus,
    Wallet,
)
from apps.members.models import User, UserStatus
from apps.parcels.models import Parcel, ParcelStatus, UnclaimedParcel, UnclaimedParcelStatus
from apps.products.models import CatalogStatus, Product, ProductSku
from apps.purchases.models import PurchaseOrder, PurchaseOrderStatus
from apps.tickets.models import Ticket, TicketStatus
from apps.warehouses.models import ConfigStatus, RatePlan, ShippingChannel, Warehouse
from apps.waybills.models import ShippingBatch, ShippingBatchStatus, Waybill, WaybillStatus

from .models import AdminUser
from .services import admin_has_permission


def _card(
    key: str,
    label: str,
    value: int | str,
    hint: str,
    path: str,
    tone: str = "blue",
) -> dict[str, int | str]:
    return {
        "key": key,
        "label": label,
        "value": value,
        "hint": hint,
        "path": path,
        "tone": tone,
    }


def _metric(label: str, value: int | str) -> dict[str, int | str]:
    return {"label": label, "value": value}


def _queue(
    key: str,
    label: str,
    value: int,
    path: str,
    tone: str = "default",
) -> dict[str, int | str]:
    return {
        "key": key,
        "label": label,
        "value": value,
        "path": path,
        "tone": tone,
    }


def _decimal_string(value: Decimal | None) -> str:
    return f"{value or Decimal('0.00'):.2f}"


def _can(admin_user: AdminUser, permission_code: str) -> bool:
    return admin_has_permission(admin_user, permission_code)


def build_admin_dashboard_snapshot(admin_user: AdminUser) -> dict[str, Any]:
    summary_cards: list[dict[str, int | str]] = []
    work_queue: list[dict[str, int | str]] = []
    modules: list[dict[str, Any]] = []

    if _can(admin_user, "members.view"):
        active_members = User.objects.filter(status=UserStatus.ACTIVE).count()
        frozen_members = User.objects.filter(status=UserStatus.FROZEN).count()
        summary_cards.append(
            _card(
                "members",
                "会员总数",
                active_members + frozen_members,
                f"启用 {active_members} / 冻结 {frozen_members}",
                "/members",
                "green",
            )
        )
        modules.append(
            {
                "key": "members",
                "label": "会员服务",
                "path": "/members",
                "metrics": [
                    _metric("启用会员", active_members),
                    _metric("冻结会员", frozen_members),
                ],
            }
        )

    if _can(admin_user, "warehouses.view"):
        active_warehouses = Warehouse.objects.filter(status=ConfigStatus.ACTIVE).count()
        active_channels = ShippingChannel.objects.filter(status=ConfigStatus.ACTIVE).count()
        active_rate_plans = RatePlan.objects.filter(status=ConfigStatus.ACTIVE).count()
        summary_cards.append(
            _card(
                "warehouse_config",
                "可用仓库",
                active_warehouses,
                f"渠道 {active_channels} / 费率 {active_rate_plans}",
                "/warehouses",
                "cyan",
            )
        )
        modules.append(
            {
                "key": "warehouse_config",
                "label": "基础配置",
                "path": "/warehouses",
                "metrics": [
                    _metric("启用仓库", active_warehouses),
                    _metric("启用渠道", active_channels),
                    _metric("启用费率", active_rate_plans),
                ],
            }
        )

    if _can(admin_user, "parcels.view"):
        pending_inbound = Parcel.objects.filter(status=ParcelStatus.PENDING_INBOUND).count()
        in_stock = Parcel.objects.filter(status=ParcelStatus.IN_STOCK).count()
        problem_parcels = Parcel.objects.filter(status=ParcelStatus.PROBLEM).count()
        claim_pending = UnclaimedParcel.objects.filter(status=UnclaimedParcelStatus.CLAIM_PENDING).count()
        summary_cards.append(
            _card(
                "parcel_wms",
                "在库包裹",
                in_stock,
                f"待入库 {pending_inbound} / 认领待审 {claim_pending}",
                "/parcels",
                "gold",
            )
        )
        work_queue.extend(
            [
                _queue("pending_inbound", "待入库包裹", pending_inbound, "/parcels", "warning"),
                _queue("claim_pending", "无主认领待审", claim_pending, "/parcels", "warning"),
                _queue("problem_parcels", "问题包裹", problem_parcels, "/parcels", "danger"),
            ]
        )
        modules.append(
            {
                "key": "parcel_wms",
                "label": "包裹/WMS",
                "path": "/parcels",
                "metrics": [
                    _metric("待入库", pending_inbound),
                    _metric("在库", in_stock),
                    _metric("问题件", problem_parcels),
                    _metric("认领待审", claim_pending),
                ],
            }
        )

    if _can(admin_user, "waybills.view"):
        pending_review = Waybill.objects.filter(status=WaybillStatus.PENDING_REVIEW).count()
        pending_payment = Waybill.objects.filter(status=WaybillStatus.PENDING_PAYMENT).count()
        pending_shipment = Waybill.objects.filter(status=WaybillStatus.PENDING_SHIPMENT).count()
        draft_batches = ShippingBatch.objects.filter(status=ShippingBatchStatus.DRAFT).count()
        shipped_waybills = Waybill.objects.filter(status=WaybillStatus.SHIPPED).count()
        summary_cards.append(
            _card(
                "waybills",
                "待发货运单",
                pending_shipment,
                f"待审 {pending_review} / 待付款 {pending_payment}",
                "/waybills",
                "purple",
            )
        )
        work_queue.extend(
            [
                _queue("waybill_review", "运单待审核", pending_review, "/waybills", "warning"),
                _queue("waybill_payment", "运单待付款", pending_payment, "/waybills", "default"),
                _queue("batch_draft", "草稿发货批次", draft_batches, "/waybills", "default"),
            ]
        )
        modules.append(
            {
                "key": "waybills",
                "label": "运单/发货",
                "path": "/waybills",
                "metrics": [
                    _metric("待审核", pending_review),
                    _metric("待付款", pending_payment),
                    _metric("待发货", pending_shipment),
                    _metric("运输中", shipped_waybills),
                    _metric("草稿批次", draft_batches),
                ],
            }
        )

    if _can(admin_user, "finance.view"):
        pending_remittances = RechargeRequest.objects.filter(status=RechargeRequestStatus.PENDING).count()
        pending_payment_orders = PaymentOrder.objects.filter(status=PaymentOrderStatus.PENDING).count()
        pending_payables = Payable.objects.filter(status=PayableStatus.PENDING_REVIEW).count()
        confirmed_payables = Payable.objects.filter(status=PayableStatus.CONFIRMED).count()
        wallet_total = Wallet.objects.aggregate(total=Sum("balance"))["total"] or Decimal("0.00")
        summary_cards.append(
            _card(
                "finance",
                "钱包余额",
                _decimal_string(wallet_total),
                f"待审汇款 {pending_remittances} / 待审应付 {pending_payables}",
                "/finance",
                "blue",
            )
        )
        work_queue.extend(
            [
                _queue("pending_remittances", "线下汇款待审核", pending_remittances, "/finance", "warning"),
                _queue("pending_payables", "应付款待审核", pending_payables, "/finance", "warning"),
                _queue("confirmed_payables", "应付款待核销", confirmed_payables, "/finance", "default"),
            ]
        )
        modules.append(
            {
                "key": "finance",
                "label": "财务",
                "path": "/finance",
                "metrics": [
                    _metric("钱包余额 CNY", _decimal_string(wallet_total)),
                    _metric("待审汇款", pending_remittances),
                    _metric("待支付单", pending_payment_orders),
                    _metric("待审应付", pending_payables),
                    _metric("待核销应付", confirmed_payables),
                ],
            }
        )

    if _can(admin_user, "purchases.view"):
        purchase_review = PurchaseOrder.objects.filter(status=PurchaseOrderStatus.PENDING_REVIEW).count()
        purchase_procurement = PurchaseOrder.objects.filter(status=PurchaseOrderStatus.PENDING_PROCUREMENT).count()
        purchase_arrived = PurchaseOrder.objects.filter(status=PurchaseOrderStatus.ARRIVED).count()
        purchase_exception = PurchaseOrder.objects.filter(status=PurchaseOrderStatus.EXCEPTION).count()
        summary_cards.append(
            _card(
                "purchases",
                "待采购订单",
                purchase_procurement,
                f"待审 {purchase_review} / 已到货 {purchase_arrived}",
                "/purchases",
                "magenta",
            )
        )
        work_queue.extend(
            [
                _queue("purchase_review", "代购待审核", purchase_review, "/purchases", "warning"),
                _queue("purchase_procurement", "代购待采购", purchase_procurement, "/purchases", "warning"),
                _queue("purchase_exception", "代购异常单", purchase_exception, "/purchases", "danger"),
            ]
        )
        modules.append(
            {
                "key": "purchases",
                "label": "代购",
                "path": "/purchases",
                "metrics": [
                    _metric("待审核", purchase_review),
                    _metric("待采购", purchase_procurement),
                    _metric("已到货", purchase_arrived),
                    _metric("异常单", purchase_exception),
                ],
            }
        )

    if _can(admin_user, "products.view"):
        active_products = Product.objects.filter(status=CatalogStatus.ACTIVE).count()
        active_skus = ProductSku.objects.filter(status=CatalogStatus.ACTIVE).count()
        stock_total = ProductSku.objects.filter(status=CatalogStatus.ACTIVE).aggregate(total=Sum("stock"))["total"] or 0
        summary_cards.append(
            _card(
                "products",
                "启用商品",
                active_products,
                f"SKU {active_skus} / 库存 {stock_total}",
                "/products",
                "lime",
            )
        )
        modules.append(
            {
                "key": "products",
                "label": "商品",
                "path": "/products",
                "metrics": [
                    _metric("启用商品", active_products),
                    _metric("启用 SKU", active_skus),
                    _metric("总库存", stock_total),
                ],
            }
        )

    if _can(admin_user, "tickets.view"):
        open_tickets = Ticket.objects.filter(status=TicketStatus.OPEN).count()
        processing_tickets = Ticket.objects.filter(status=TicketStatus.PROCESSING).count()
        summary_cards.append(
            _card(
                "tickets",
                "待处理工单",
                open_tickets,
                f"处理中 {processing_tickets}",
                "/tickets",
                "orange",
            )
        )
        work_queue.extend(
            [
                _queue("open_tickets", "客服工单待处理", open_tickets, "/tickets", "warning"),
                _queue("processing_tickets", "客服工单处理中", processing_tickets, "/tickets", "default"),
            ]
        )
        modules.append(
            {
                "key": "tickets",
                "label": "客服",
                "path": "/tickets",
                "metrics": [
                    _metric("待处理", open_tickets),
                    _metric("处理中", processing_tickets),
                ],
            }
        )

    if _can(admin_user, "content.view"):
        published_pages = ContentPage.objects.filter(status=ContentStatus.PUBLISHED).count()
        draft_pages = ContentPage.objects.filter(status=ContentStatus.DRAFT).count()
        modules.append(
            {
                "key": "content",
                "label": "内容",
                "path": "/content",
                "metrics": [
                    _metric("已发布", published_pages),
                    _metric("草稿", draft_pages),
                ],
            }
        )

    recent_audit_logs: list[dict[str, Any]] = []
    if _can(admin_user, "audit.logs.view"):
        recent_audit_logs = [
            {
                "id": log.id,
                "action": log.action,
                "operator_label": log.operator_label,
                "target_type": log.target_type,
                "status_code": log.status_code,
                "created_at": log.created_at.isoformat(),
            }
            for log in AuditLog.objects.all()[:6]
        ]
        modules.append(
            {
                "key": "audit",
                "label": "审计",
                "path": "/audit-logs",
                "metrics": [
                    _metric("最近审计", len(recent_audit_logs)),
                    _metric("全部审计", AuditLog.objects.count()),
                ],
            }
        )

    visible_queue = [item for item in work_queue if int(item["value"]) > 0]
    return {
        "generated_at": timezone.now().isoformat(),
        "summary_cards": summary_cards,
        "work_queue": visible_queue or work_queue[:6],
        "modules": modules,
        "recent_audit_logs": recent_audit_logs,
    }
