from dataclasses import dataclass
from decimal import Decimal

from django.db import transaction
from django.utils import timezone
from rest_framework import exceptions

from apps.iam.models import AdminUser
from apps.members.models import User
from apps.warehouses.models import ConfigStatus, Warehouse

from .models import (
    InboundRecord,
    Parcel,
    ParcelItem,
    ParcelPhoto,
    ParcelStatus,
    PhotoType,
    UnclaimedParcel,
    UnclaimedParcelStatus,
)


class StateConflictError(Exception):
    pass


@dataclass(frozen=True)
class InboundResult:
    parcel: Parcel | None
    unclaimed_parcel: UnclaimedParcel | None = None
    created_unclaimed: bool = False


def _build_parcel_no(parcel_id: int) -> str:
    return f"P{parcel_id:08d}"


def _dimensions_json(length_cm: Decimal | None, width_cm: Decimal | None, height_cm: Decimal | None) -> dict:
    return {
        "length_cm": str(length_cm) if length_cm is not None else "",
        "width_cm": str(width_cm) if width_cm is not None else "",
        "height_cm": str(height_cm) if height_cm is not None else "",
    }


def _assert_active_warehouse(warehouse: Warehouse) -> None:
    if warehouse.status != ConfigStatus.ACTIVE:
        raise exceptions.ValidationError({"warehouse_id": ["仓库已停用"]})


@transaction.atomic
def forecast_parcel(
    *,
    user: User,
    warehouse: Warehouse,
    tracking_no: str,
    carrier: str = "",
    items: list[dict] | None = None,
    remark: str = "",
) -> Parcel:
    _assert_active_warehouse(warehouse)
    parcel = Parcel.objects.create(
        parcel_no="PENDING",
        user=user,
        warehouse=warehouse,
        tracking_no=tracking_no,
        carrier=carrier,
        status=ParcelStatus.PENDING_INBOUND,
        remark=remark,
    )
    parcel.parcel_no = _build_parcel_no(parcel.id)
    parcel.save(update_fields=["parcel_no", "updated_at"])

    for item in items or []:
        ParcelItem.objects.create(parcel=parcel, **item)

    return Parcel.objects.select_related("user", "warehouse").prefetch_related("items", "photos").get(id=parcel.id)


def _inbound_pending_parcel(
    *,
    parcel: Parcel,
    operator: AdminUser | None,
    weight_kg: Decimal,
    length_cm: Decimal | None = None,
    width_cm: Decimal | None = None,
    height_cm: Decimal | None = None,
    photo_file_ids: list[str] | None = None,
    remark: str = "",
) -> Parcel:
    if parcel.status != ParcelStatus.PENDING_INBOUND:
        raise StateConflictError("包裹当前状态不允许入库")

    parcel.status = ParcelStatus.IN_STOCK
    parcel.weight_kg = weight_kg
    parcel.length_cm = length_cm
    parcel.width_cm = width_cm
    parcel.height_cm = height_cm
    parcel.inbound_at = timezone.now()
    parcel.save(
        update_fields=[
            "status",
            "weight_kg",
            "length_cm",
            "width_cm",
            "height_cm",
            "inbound_at",
            "updated_at",
        ]
    )
    InboundRecord.objects.create(
        parcel=parcel,
        operator=operator,
        weight_kg=weight_kg,
        dimensions_json=_dimensions_json(length_cm, width_cm, height_cm),
        remark=remark,
    )
    for file_id in dict.fromkeys(file_id.strip() for file_id in photo_file_ids or [] if file_id.strip()):
        ParcelPhoto.objects.create(parcel=parcel, file_id=file_id, photo_type=PhotoType.INBOUND)
    return parcel


@transaction.atomic
def inbound_parcel(
    *,
    parcel: Parcel,
    operator: AdminUser | None,
    weight_kg: Decimal,
    length_cm: Decimal | None = None,
    width_cm: Decimal | None = None,
    height_cm: Decimal | None = None,
    photo_file_ids: list[str] | None = None,
    remark: str = "",
) -> Parcel:
    locked = Parcel.objects.select_for_update().select_related("warehouse", "user").get(id=parcel.id)
    return _inbound_pending_parcel(
        parcel=locked,
        operator=operator,
        weight_kg=weight_kg,
        length_cm=length_cm,
        width_cm=width_cm,
        height_cm=height_cm,
        photo_file_ids=photo_file_ids,
        remark=remark,
    )


@transaction.atomic
def scan_inbound(
    *,
    tracking_no: str,
    warehouse: Warehouse,
    operator: AdminUser | None,
    weight_kg: Decimal,
    length_cm: Decimal | None = None,
    width_cm: Decimal | None = None,
    height_cm: Decimal | None = None,
    photo_file_ids: list[str] | None = None,
    remark: str = "",
) -> InboundResult:
    _assert_active_warehouse(warehouse)
    parcel = (
        Parcel.objects.select_for_update()
        .select_related("warehouse", "user")
        .filter(tracking_no=tracking_no, warehouse=warehouse)
        .first()
    )
    if parcel:
        return InboundResult(
            parcel=_inbound_pending_parcel(
                parcel=parcel,
                operator=operator,
                weight_kg=weight_kg,
                length_cm=length_cm,
                width_cm=width_cm,
                height_cm=height_cm,
                photo_file_ids=photo_file_ids,
                remark=remark,
            )
        )

    unclaimed, created = UnclaimedParcel.objects.get_or_create(
        tracking_no=tracking_no,
        defaults={
            "warehouse": warehouse,
            "status": UnclaimedParcelStatus.UNCLAIMED,
            "description": remark,
            "weight_kg": weight_kg,
            "dimensions_json": _dimensions_json(length_cm, width_cm, height_cm),
        },
    )
    return InboundResult(parcel=None, unclaimed_parcel=unclaimed, created_unclaimed=created)


@transaction.atomic
def claim_unclaimed_parcel(*, unclaimed_parcel: UnclaimedParcel, user: User) -> Parcel:
    locked = UnclaimedParcel.objects.select_for_update().select_related("warehouse").get(id=unclaimed_parcel.id)
    if locked.status == UnclaimedParcelStatus.CLAIMED:
        raise StateConflictError("无主包裹已被认领")

    parcel = Parcel.objects.create(
        parcel_no="PENDING",
        user=user,
        warehouse=locked.warehouse,
        tracking_no=locked.tracking_no,
        status=ParcelStatus.IN_STOCK,
        weight_kg=locked.weight_kg,
        inbound_at=timezone.now(),
        remark=locked.description,
    )
    parcel.parcel_no = _build_parcel_no(parcel.id)
    parcel.save(update_fields=["parcel_no", "updated_at"])
    locked.status = UnclaimedParcelStatus.CLAIMED
    locked.claimed_by_user = user
    locked.save(update_fields=["status", "claimed_by_user", "updated_at"])
    return parcel
