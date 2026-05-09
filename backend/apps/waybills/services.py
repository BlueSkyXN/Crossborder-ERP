from decimal import Decimal

from django.db import transaction
from django.utils import timezone
from rest_framework import exceptions

from apps.iam.models import AdminUser
from apps.members.models import User
from apps.parcels.models import Parcel, ParcelStatus
from apps.warehouses.models import ConfigStatus, ShippingChannel

from .models import (
    ShippingBatch,
    ShippingBatchStatus,
    TrackingEvent,
    TrackingEventSource,
    Waybill,
    WaybillParcel,
    WaybillStatus,
)


class StateConflictError(Exception):
    pass


def _build_waybill_no(waybill_id: int) -> str:
    return f"W{waybill_id:08d}"


def _build_shipping_batch_no(batch_id: int) -> str:
    return f"SB{batch_id:08d}"


def _assert_active_channel(channel: ShippingChannel | None) -> None:
    if channel and channel.status != ConfigStatus.ACTIVE:
        raise exceptions.ValidationError({"channel_id": ["渠道已停用"]})


def _normalize_parcel_ids(parcel_ids: list[int]) -> list[int]:
    normalized = list(dict.fromkeys(parcel_ids))
    if not normalized:
        raise exceptions.ValidationError({"parcel_ids": ["至少选择一个包裹"]})
    return normalized


def _normalize_waybill_ids(waybill_ids: list[int]) -> list[int]:
    normalized = list(dict.fromkeys(waybill_ids))
    if not normalized:
        raise exceptions.ValidationError({"waybill_ids": ["至少选择一个运单"]})
    return normalized


def _shipping_batch_queryset():
    return (
        ShippingBatch.objects.select_related("warehouse", "channel", "created_by", "locked_by", "shipped_by")
        .prefetch_related("waybills__user", "waybills__warehouse", "waybills__channel", "waybills__parcel_links__parcel")
    )


def _get_batch_for_output(batch_id: int) -> ShippingBatch:
    return _shipping_batch_queryset().get(id=batch_id)


def _validate_batch_mutable(batch: ShippingBatch) -> None:
    if batch.status != ShippingBatchStatus.DRAFT:
        raise StateConflictError("发货批次当前状态不允许调整运单")


def _validate_waybills_can_join_batch(*, batch: ShippingBatch, waybill_ids: list[int]) -> list[Waybill]:
    normalized_ids = _normalize_waybill_ids(waybill_ids)
    waybills = list(
        Waybill.objects.select_for_update()
        .select_related("warehouse", "shipping_batch")
        .filter(id__in=normalized_ids)
        .order_by("id")
    )
    if len(waybills) != len(normalized_ids):
        raise exceptions.ValidationError({"waybill_ids": ["运单不存在"]})

    blocked_status = [waybill.waybill_no for waybill in waybills if waybill.status != WaybillStatus.PENDING_SHIPMENT]
    if blocked_status:
        raise StateConflictError(f"运单当前状态不允许归入发货批次: {', '.join(blocked_status)}")

    blocked_batch = [
        waybill.waybill_no
        for waybill in waybills
        if waybill.shipping_batch_id and waybill.shipping_batch_id != batch.id
    ]
    if blocked_batch:
        raise StateConflictError(f"运单已归入其他发货批次: {', '.join(blocked_batch)}")

    warehouse_ids = {waybill.warehouse_id for waybill in waybills}
    if batch.warehouse_id:
        warehouse_ids.add(batch.warehouse_id)
    if len(warehouse_ids) != 1:
        raise exceptions.ValidationError({"waybill_ids": ["同一发货批次只能包含同一仓库的运单"]})

    channel_ids = {waybill.channel_id for waybill in waybills}
    if batch.channel_id:
        channel_ids.add(batch.channel_id)
    if len(channel_ids) != 1:
        raise exceptions.ValidationError({"waybill_ids": ["同一发货批次只能包含同一发货渠道的运单"]})

    return waybills


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
def create_shipping_batch(
    *,
    operator: AdminUser | None,
    name: str = "",
    carrier_batch_no: str = "",
    transfer_no: str = "",
    ship_note: str = "",
    waybill_ids: list[int] | None = None,
) -> ShippingBatch:
    batch = ShippingBatch.objects.create(
        batch_no="PENDING",
        name=name.strip(),
        carrier_batch_no=carrier_batch_no.strip(),
        transfer_no=transfer_no.strip(),
        ship_note=ship_note.strip(),
        created_by=operator,
    )
    batch.batch_no = _build_shipping_batch_no(batch.id)
    batch.save(update_fields=["batch_no", "updated_at"])
    if waybill_ids:
        batch = add_waybills_to_shipping_batch(batch=batch, waybill_ids=waybill_ids)
    return _get_batch_for_output(batch.id)


@transaction.atomic
def update_shipping_batch(
    *,
    batch: ShippingBatch,
    name: str = "",
    carrier_batch_no: str = "",
    transfer_no: str = "",
    ship_note: str = "",
) -> ShippingBatch:
    locked = ShippingBatch.objects.select_for_update().get(id=batch.id)
    if locked.status == ShippingBatchStatus.SHIPPED:
        raise StateConflictError("已发货批次不允许修改基础信息")
    locked.name = name.strip()
    locked.carrier_batch_no = carrier_batch_no.strip()
    locked.transfer_no = transfer_no.strip()
    locked.ship_note = ship_note.strip()
    locked.save(update_fields=["name", "carrier_batch_no", "transfer_no", "ship_note", "updated_at"])
    Waybill.objects.filter(shipping_batch=locked, status=WaybillStatus.PENDING_SHIPMENT).update(
        transfer_no=locked.transfer_no,
        updated_at=timezone.now(),
    )
    return _get_batch_for_output(locked.id)


@transaction.atomic
def add_waybills_to_shipping_batch(*, batch: ShippingBatch, waybill_ids: list[int]) -> ShippingBatch:
    locked = ShippingBatch.objects.select_for_update().get(id=batch.id)
    _validate_batch_mutable(locked)
    waybills = _validate_waybills_can_join_batch(batch=locked, waybill_ids=waybill_ids)
    if not waybills:
        return _get_batch_for_output(locked.id)

    warehouse = waybills[0].warehouse
    channel = waybills[0].channel
    if not locked.warehouse_id:
        locked.warehouse = warehouse
        locked.channel = channel
        locked.save(update_fields=["warehouse", "channel", "updated_at"])

    Waybill.objects.filter(id__in=[waybill.id for waybill in waybills]).update(
        shipping_batch=locked,
        transfer_no=locked.transfer_no,
        updated_at=timezone.now(),
    )
    return _get_batch_for_output(locked.id)


@transaction.atomic
def remove_waybill_from_shipping_batch(*, batch: ShippingBatch, waybill_id: int) -> ShippingBatch:
    locked = ShippingBatch.objects.select_for_update().get(id=batch.id)
    _validate_batch_mutable(locked)
    updated = Waybill.objects.filter(id=waybill_id, shipping_batch=locked).update(
        shipping_batch=None,
        transfer_no="",
        updated_at=timezone.now(),
    )
    if not updated:
        raise exceptions.ValidationError({"waybill_id": ["运单不在当前发货批次中"]})
    if not Waybill.objects.filter(shipping_batch=locked).exists():
        locked.warehouse = None
        locked.channel = None
        locked.save(update_fields=["warehouse", "channel", "updated_at"])
    return _get_batch_for_output(locked.id)


@transaction.atomic
def lock_shipping_batch(*, batch: ShippingBatch, operator: AdminUser | None) -> ShippingBatch:
    locked = ShippingBatch.objects.select_for_update().get(id=batch.id)
    if locked.status == ShippingBatchStatus.LOCKED:
        return _get_batch_for_output(locked.id)
    if locked.status != ShippingBatchStatus.DRAFT:
        raise StateConflictError("发货批次当前状态不允许锁定")
    if not Waybill.objects.filter(shipping_batch=locked).exists():
        raise StateConflictError("空发货批次不允许锁定")
    invalid = list(
        Waybill.objects.filter(shipping_batch=locked)
        .exclude(status=WaybillStatus.PENDING_SHIPMENT)
        .values_list("waybill_no", flat=True)
    )
    if invalid:
        raise StateConflictError(f"发货批次包含不可发货运单: {', '.join(invalid)}")

    locked.status = ShippingBatchStatus.LOCKED
    locked.locked_by = operator
    locked.locked_at = timezone.now()
    locked.save(update_fields=["status", "locked_by", "locked_at", "updated_at"])
    return _get_batch_for_output(locked.id)


@transaction.atomic
def ship_shipping_batch(
    *,
    batch: ShippingBatch,
    operator: AdminUser | None,
    status_text: str = "批次已发货",
    location: str = "",
    description: str = "",
    event_time=None,
) -> ShippingBatch:
    if not status_text.strip():
        raise exceptions.ValidationError({"status_text": ["轨迹状态不能为空"]})
    locked = ShippingBatch.objects.select_for_update().get(id=batch.id)
    if locked.status == ShippingBatchStatus.SHIPPED:
        return _get_batch_for_output(locked.id)
    if locked.status != ShippingBatchStatus.LOCKED:
        raise StateConflictError("发货批次需要先锁定后才能发货")

    waybills = list(
        Waybill.objects.select_for_update()
        .prefetch_related("parcel_links__parcel")
        .filter(shipping_batch=locked)
        .order_by("id")
    )
    if not waybills:
        raise StateConflictError("空发货批次不允许发货")
    invalid = [waybill.waybill_no for waybill in waybills if waybill.status != WaybillStatus.PENDING_SHIPMENT]
    if invalid:
        raise StateConflictError(f"发货批次包含不可发货运单: {', '.join(invalid)}")

    shipped_at = timezone.now()
    event_at = event_time or shipped_at
    waybill_ids = [waybill.id for waybill in waybills]
    Waybill.objects.filter(id__in=waybill_ids).update(
        status=WaybillStatus.SHIPPED,
        shipped_at=shipped_at,
        transfer_no=locked.transfer_no,
        updated_at=timezone.now(),
    )
    parcel_ids = [link.parcel_id for waybill in waybills for link in waybill.parcel_links.all()]
    Parcel.objects.filter(id__in=parcel_ids).update(status=ParcelStatus.OUTBOUND, updated_at=timezone.now())
    TrackingEvent.objects.bulk_create(
        [
            TrackingEvent(
                waybill=waybill,
                event_time=event_at,
                location=location.strip(),
                status_text=status_text.strip(),
                description=description.strip(),
                source=TrackingEventSource.MANUAL,
                operator=operator,
            )
            for waybill in waybills
        ]
    )
    locked.status = ShippingBatchStatus.SHIPPED
    locked.shipped_by = operator
    locked.shipped_at = shipped_at
    locked.save(update_fields=["status", "shipped_by", "shipped_at", "updated_at"])
    return _get_batch_for_output(locked.id)


@transaction.atomic
def add_shipping_batch_tracking_event(
    *,
    batch: ShippingBatch,
    operator: AdminUser | None,
    status_text: str,
    location: str = "",
    description: str = "",
    event_time=None,
) -> list[TrackingEvent]:
    if not status_text.strip():
        raise exceptions.ValidationError({"status_text": ["轨迹状态不能为空"]})
    locked = ShippingBatch.objects.select_for_update().get(id=batch.id)
    if locked.status not in {ShippingBatchStatus.LOCKED, ShippingBatchStatus.SHIPPED}:
        raise StateConflictError("发货批次当前状态不允许批量追加轨迹")
    waybills = list(Waybill.objects.filter(shipping_batch=locked).order_by("id"))
    if not waybills:
        raise StateConflictError("空发货批次不允许追加轨迹")
    event_at = event_time or timezone.now()
    return TrackingEvent.objects.bulk_create(
        [
            TrackingEvent(
                waybill=waybill,
                event_time=event_at,
                location=location.strip(),
                status_text=status_text.strip(),
                description=description.strip(),
                source=TrackingEventSource.MANUAL,
                operator=operator,
            )
            for waybill in waybills
        ]
    )


def build_shipping_batch_print_preview(*, batch: ShippingBatch, template: str = "label") -> dict:
    allowed_templates = {"label", "picking", "handover"}
    if template not in allowed_templates:
        raise exceptions.ValidationError({"template": ["template 仅支持 label、picking、handover"]})
    loaded = _get_batch_for_output(batch.id)
    waybills = list(loaded.waybills.all())
    total_weight = Decimal("0.000")
    rows = []
    for waybill in waybills:
        parcels = []
        for link in waybill.parcel_links.all():
            weight = link.parcel.weight_kg or Decimal("0.000")
            total_weight += weight
            parcels.append(
                {
                    "parcel_no": link.parcel.parcel_no,
                    "tracking_no": link.parcel.tracking_no,
                    "weight_kg": str(link.parcel.weight_kg) if link.parcel.weight_kg is not None else None,
                    "status": link.parcel.status,
                }
            )
        rows.append(
            {
                "waybill_no": waybill.waybill_no,
                "transfer_no": waybill.transfer_no or loaded.transfer_no,
                "status": waybill.status,
                "user_email": waybill.user.email,
                "warehouse_name": waybill.warehouse.name,
                "channel_name": waybill.channel.name if waybill.channel else "",
                "destination_country": waybill.destination_country,
                "recipient": waybill.recipient_snapshot,
                "parcels": parcels,
                "parcel_count": len(parcels),
            }
        )
    return {
        "template": template,
        "batch": {
            "id": loaded.id,
            "batch_no": loaded.batch_no,
            "name": loaded.name,
            "status": loaded.status,
            "warehouse_name": loaded.warehouse.name if loaded.warehouse else "",
            "channel_name": loaded.channel.name if loaded.channel else "",
            "carrier_batch_no": loaded.carrier_batch_no,
            "transfer_no": loaded.transfer_no,
            "ship_note": loaded.ship_note,
            "waybill_count": len(rows),
            "parcel_count": sum(row["parcel_count"] for row in rows),
            "total_weight_kg": str(total_weight),
            "generated_at": timezone.now().isoformat(),
        },
        "items": rows,
    }


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
