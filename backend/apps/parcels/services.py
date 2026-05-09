from dataclasses import dataclass
from decimal import Decimal, InvalidOperation
import uuid

from django.db import transaction
from django.db.models import Q
from django.utils import timezone
from rest_framework import exceptions

from apps.files.models import FileUsage
from apps.files.services import assert_admin_files_usable
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


def _temporary_parcel_no() -> str:
    return f"TMP{uuid.uuid4().hex[:20]}"


def mask_tracking_no(tracking_no: str) -> str:
    normalized = (tracking_no or "").strip()
    if len(normalized) <= 6:
        return f"{normalized[:1]}***{normalized[-1:]}" if normalized else ""
    return f"{normalized[:3]}***{normalized[-3:]}"


def _dimensions_json(length_cm: Decimal | None, width_cm: Decimal | None, height_cm: Decimal | None) -> dict:
    return {
        "length_cm": str(length_cm) if length_cm is not None else "",
        "width_cm": str(width_cm) if width_cm is not None else "",
        "height_cm": str(height_cm) if height_cm is not None else "",
    }


def _dimension_value(dimensions_json: dict, key: str) -> Decimal | None:
    value = (dimensions_json or {}).get(key)
    if value in (None, ""):
        return None
    try:
        return Decimal(str(value))
    except (InvalidOperation, TypeError, ValueError):
        return None


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
        parcel_no=_temporary_parcel_no(),
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
    normalized_photo_file_ids = assert_admin_files_usable(
        file_ids=photo_file_ids,
        allowed_usages={FileUsage.PARCEL_PHOTO},
        field_name="photo_file_ids",
    )

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
    for file_id in normalized_photo_file_ids:
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
def submit_unclaimed_claim(
    *,
    unclaimed_parcel: UnclaimedParcel,
    user: User,
    claim_note: str = "",
    claim_contact: str = "",
) -> UnclaimedParcel:
    locked = UnclaimedParcel.objects.select_for_update().select_related("warehouse").get(id=unclaimed_parcel.id)
    if locked.status != UnclaimedParcelStatus.UNCLAIMED:
        raise StateConflictError("无主包裹当前状态不允许认领")
    locked.status = UnclaimedParcelStatus.CLAIM_PENDING
    locked.claimed_by_user = user
    locked.claim_note = (claim_note or "").strip()
    locked.claim_contact = (claim_contact or "").strip()
    locked.claimed_at = timezone.now()
    locked.review_note = ""
    locked.reviewed_at = None
    locked.reviewed_by_admin = None
    locked.save(
        update_fields=[
            "status",
            "claimed_by_user",
            "claim_note",
            "claim_contact",
            "claimed_at",
            "review_note",
            "reviewed_at",
            "reviewed_by_admin",
            "updated_at",
        ]
    )
    return locked


def user_visible_unclaimed_queryset(*, user: User):
    return (
        UnclaimedParcel.objects.select_related("warehouse", "claimed_by_user")
        .filter(Q(status=UnclaimedParcelStatus.UNCLAIMED) | Q(claimed_by_user=user))
    ).order_by("-id")


@transaction.atomic
def approve_unclaimed_claim(
    *,
    unclaimed_parcel: UnclaimedParcel,
    operator: AdminUser,
    review_note: str = "",
) -> Parcel:
    locked = UnclaimedParcel.objects.select_for_update().select_related("warehouse", "claimed_by_user").get(
        id=unclaimed_parcel.id
    )
    if locked.status != UnclaimedParcelStatus.CLAIM_PENDING or not locked.claimed_by_user_id:
        raise StateConflictError("无主包裹当前状态不允许审核通过")
    if Parcel.objects.filter(tracking_no=locked.tracking_no).exists():
        raise StateConflictError("已有同追踪号包裹，不能重复转入")

    parcel = Parcel.objects.create(
        parcel_no=_temporary_parcel_no(),
        user=locked.claimed_by_user,
        warehouse=locked.warehouse,
        tracking_no=locked.tracking_no,
        status=ParcelStatus.IN_STOCK,
        weight_kg=locked.weight_kg,
        length_cm=_dimension_value(locked.dimensions_json, "length_cm"),
        width_cm=_dimension_value(locked.dimensions_json, "width_cm"),
        height_cm=_dimension_value(locked.dimensions_json, "height_cm"),
        inbound_at=timezone.now(),
        remark=locked.description,
    )
    parcel.parcel_no = _build_parcel_no(parcel.id)
    parcel.save(update_fields=["parcel_no", "updated_at"])
    InboundRecord.objects.create(
        parcel=parcel,
        operator=operator,
        weight_kg=locked.weight_kg or Decimal("0.000"),
        dimensions_json=locked.dimensions_json,
        remark=locked.description,
    )
    locked.status = UnclaimedParcelStatus.CLAIMED
    locked.reviewed_by_admin = operator
    locked.review_note = (review_note or "").strip()
    locked.reviewed_at = timezone.now()
    locked.save(update_fields=["status", "reviewed_by_admin", "review_note", "reviewed_at", "updated_at"])
    return parcel


@transaction.atomic
def reject_unclaimed_claim(
    *,
    unclaimed_parcel: UnclaimedParcel,
    operator: AdminUser,
    review_note: str = "",
) -> UnclaimedParcel:
    locked = UnclaimedParcel.objects.select_for_update().select_related("warehouse", "claimed_by_user").get(
        id=unclaimed_parcel.id
    )
    if locked.status != UnclaimedParcelStatus.CLAIM_PENDING:
        raise StateConflictError("无主包裹当前状态不允许驳回")
    locked.status = UnclaimedParcelStatus.UNCLAIMED
    locked.reviewed_by_admin = operator
    locked.review_note = (review_note or "").strip()
    locked.reviewed_at = timezone.now()
    locked.claimed_by_user = None
    locked.claim_note = ""
    locked.claim_contact = ""
    locked.claimed_at = None
    locked.save(
        update_fields=[
            "status",
            "reviewed_by_admin",
            "review_note",
            "reviewed_at",
            "claimed_by_user",
            "claim_note",
            "claim_contact",
            "claimed_at",
            "updated_at",
        ]
    )
    return locked
