from decimal import Decimal

from django.db import transaction
from django.utils import timezone
from rest_framework import exceptions

from apps.iam.models import AdminUser
from apps.members.models import User
from apps.parcels.models import Parcel, ParcelStatus
from apps.warehouses.models import ConfigStatus, ShippingChannel

from .models import TrackingEvent, TrackingEventSource, Waybill, WaybillParcel, WaybillStatus


class StateConflictError(Exception):
    pass


def _build_waybill_no(waybill_id: int) -> str:
    return f"W{waybill_id:08d}"


def _assert_active_channel(channel: ShippingChannel | None) -> None:
    if channel and channel.status != ConfigStatus.ACTIVE:
        raise exceptions.ValidationError({"channel_id": ["渠道已停用"]})


def _normalize_parcel_ids(parcel_ids: list[int]) -> list[int]:
    normalized = list(dict.fromkeys(parcel_ids))
    if not normalized:
        raise exceptions.ValidationError({"parcel_ids": ["至少选择一个包裹"]})
    return normalized


@transaction.atomic
def create_waybill(
    *,
    user: User,
    parcel_ids: list[int],
    destination_country: str,
    recipient_snapshot: dict,
    channel: ShippingChannel | None = None,
    remark: str = "",
) -> Waybill:
    _assert_active_channel(channel)
    normalized_ids = _normalize_parcel_ids(parcel_ids)
    parcels = list(
        Parcel.objects.select_for_update()
        .select_related("warehouse", "user")
        .filter(id__in=normalized_ids, user=user)
        .order_by("id")
    )
    if len(parcels) != len(normalized_ids):
        raise exceptions.ValidationError({"parcel_ids": ["包裹不存在或不属于当前用户"]})

    blocked = [parcel.parcel_no for parcel in parcels if parcel.status != ParcelStatus.IN_STOCK]
    if blocked:
        raise StateConflictError(f"包裹当前状态不允许申请打包: {', '.join(blocked)}")

    warehouse_ids = {parcel.warehouse_id for parcel in parcels}
    if len(warehouse_ids) != 1:
        raise exceptions.ValidationError({"parcel_ids": ["一次运单只能选择同一仓库的包裹"]})

    waybill = Waybill.objects.create(
        waybill_no="PENDING",
        user=user,
        warehouse=parcels[0].warehouse,
        channel=channel,
        status=WaybillStatus.PENDING_REVIEW,
        destination_country=destination_country,
        recipient_snapshot=recipient_snapshot,
        remark=remark,
    )
    waybill.waybill_no = _build_waybill_no(waybill.id)
    waybill.save(update_fields=["waybill_no", "updated_at"])

    WaybillParcel.objects.bulk_create([WaybillParcel(waybill=waybill, parcel=parcel) for parcel in parcels])
    Parcel.objects.filter(id__in=[parcel.id for parcel in parcels]).update(
        status=ParcelStatus.PACKING_REQUESTED,
        updated_at=timezone.now(),
    )
    return get_waybill_for_output(waybill.id)


@transaction.atomic
def review_waybill(*, waybill: Waybill, operator: AdminUser | None, review_remark: str = "") -> Waybill:
    locked = Waybill.objects.select_for_update().get(id=waybill.id)
    if locked.status != WaybillStatus.PENDING_REVIEW:
        raise StateConflictError("运单当前状态不允许审核")

    locked.status = WaybillStatus.PENDING_PACKING
    locked.reviewed_by = operator
    locked.review_remark = review_remark
    locked.reviewed_at = timezone.now()
    locked.save(update_fields=["status", "reviewed_by", "review_remark", "reviewed_at", "updated_at"])
    return get_waybill_for_output(locked.id)


@transaction.atomic
def set_waybill_fee(
    *,
    waybill: Waybill,
    operator: AdminUser | None,
    fee_total: Decimal,
    fee_detail_json: dict | None = None,
    fee_remark: str = "",
) -> Waybill:
    locked = Waybill.objects.select_for_update().get(id=waybill.id)
    if locked.status != WaybillStatus.PENDING_PACKING:
        raise StateConflictError("运单当前状态不允许设置费用")
    if fee_total < Decimal("0.00"):
        raise exceptions.ValidationError({"fee_total": ["费用不能为负数"]})

    locked.status = WaybillStatus.PENDING_PAYMENT
    locked.fee_total = fee_total
    locked.fee_detail_json = fee_detail_json or {}
    locked.fee_remark = fee_remark
    locked.fee_set_by = operator
    locked.fee_set_at = timezone.now()
    locked.save(
        update_fields=[
            "status",
            "fee_total",
            "fee_detail_json",
            "fee_remark",
            "fee_set_by",
            "fee_set_at",
            "updated_at",
        ]
    )
    return get_waybill_for_output(locked.id)


@transaction.atomic
def cancel_waybill(*, waybill: Waybill, reason: str = "") -> Waybill:
    locked = Waybill.objects.select_for_update().prefetch_related("parcel_links__parcel").get(id=waybill.id)
    if locked.status not in {
        WaybillStatus.PENDING_REVIEW,
        WaybillStatus.PENDING_PACKING,
        WaybillStatus.PENDING_PAYMENT,
    }:
        raise StateConflictError("运单当前状态不允许取消")

    parcel_ids = [link.parcel_id for link in locked.parcel_links.all()]
    Parcel.objects.filter(id__in=parcel_ids, status=ParcelStatus.PACKING_REQUESTED).update(
        status=ParcelStatus.IN_STOCK,
        updated_at=timezone.now(),
    )
    locked.status = WaybillStatus.CANCELLED
    locked.cancel_reason = reason
    locked.save(update_fields=["status", "cancel_reason", "updated_at"])
    return get_waybill_for_output(locked.id)


@transaction.atomic
def add_tracking_event(
    *,
    waybill: Waybill,
    status_text: str,
    location: str = "",
    description: str = "",
    event_time=None,
    source: str = TrackingEventSource.MANUAL,
    operator: AdminUser | None = None,
) -> TrackingEvent:
    if not status_text.strip():
        raise exceptions.ValidationError({"status_text": ["轨迹状态不能为空"]})
    locked = Waybill.objects.select_for_update().get(id=waybill.id)
    return TrackingEvent.objects.create(
        waybill=locked,
        event_time=event_time or timezone.now(),
        location=location,
        status_text=status_text,
        description=description,
        source=source,
        operator=operator,
    )


@transaction.atomic
def ship_waybill(
    *,
    waybill: Waybill,
    operator: AdminUser | None,
    status_text: str = "已发货",
    location: str = "",
    description: str = "",
    event_time=None,
) -> Waybill:
    locked = Waybill.objects.select_for_update().prefetch_related("parcel_links__parcel").get(id=waybill.id)
    if locked.status != WaybillStatus.PENDING_SHIPMENT:
        raise StateConflictError("运单当前状态不允许发货")

    shipped_at = timezone.now()
    locked.status = WaybillStatus.SHIPPED
    locked.shipped_at = shipped_at
    locked.save(update_fields=["status", "shipped_at", "updated_at"])
    parcel_ids = [link.parcel_id for link in locked.parcel_links.all()]
    Parcel.objects.filter(id__in=parcel_ids).update(status=ParcelStatus.OUTBOUND, updated_at=timezone.now())
    TrackingEvent.objects.create(
        waybill=locked,
        event_time=event_time or shipped_at,
        location=location,
        status_text=status_text,
        description=description,
        source=TrackingEventSource.MANUAL,
        operator=operator,
    )
    return get_waybill_for_output(locked.id)


@transaction.atomic
def confirm_receipt(*, waybill: Waybill, user: User, description: str = "") -> Waybill:
    locked = Waybill.objects.select_for_update().get(id=waybill.id)
    if locked.user_id != user.id:
        raise exceptions.NotFound("运单不存在")
    if locked.status != WaybillStatus.SHIPPED:
        raise StateConflictError("运单当前状态不允许确认收货")

    signed_at = timezone.now()
    locked.status = WaybillStatus.SIGNED
    locked.signed_at = signed_at
    locked.save(update_fields=["status", "signed_at", "updated_at"])
    TrackingEvent.objects.create(
        waybill=locked,
        event_time=signed_at,
        status_text="已签收",
        description=description,
        source=TrackingEventSource.MEMBER,
    )
    return get_waybill_for_output(locked.id)


def get_waybill_for_output(waybill_id: int) -> Waybill:
    return (
        Waybill.objects.select_related("user", "warehouse", "channel", "reviewed_by", "fee_set_by")
        .prefetch_related("parcel_links__parcel", "tracking_events")
        .get(id=waybill_id)
    )
