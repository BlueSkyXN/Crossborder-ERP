from django.db import transaction
from rest_framework import exceptions

from apps.members.models import User

from .models import Address, AddressType


def _normalize_address_data(data: dict) -> dict:
    normalized = data.copy()
    if "recipient_name" in normalized:
        normalized["contact_name"] = normalized.pop("recipient_name")
    if "country" in normalized:
        normalized["country_region"] = normalized.pop("country")
    region = normalized.pop("region", "")
    city = normalized.pop("city", "")
    if region or city:
        normalized["province_city"] = " ".join(part for part in [region, city] if part).strip()
    if "address_line" in normalized:
        normalized["detail_address"] = normalized.pop("address_line")
    normalized.setdefault("address_type", AddressType.RECIPIENT)
    return normalized


def list_addresses(*, user: User, address_type: str | None = None):
    addresses = Address.objects.filter(user=user, is_active=True)
    if address_type:
        if address_type not in AddressType.values:
            raise exceptions.ValidationError({"address_type": ["地址类型无效"]})
        addresses = addresses.filter(address_type=address_type)
    return addresses


def get_user_address(*, user: User, address_id: int, address_type: str | None = None) -> Address:
    addresses = Address.objects.filter(user=user, id=address_id, is_active=True)
    if address_type:
        addresses = addresses.filter(address_type=address_type)
    try:
        return addresses.get()
    except Address.DoesNotExist as exc:
        raise exceptions.NotFound("地址不存在") from exc


def get_active_address(*, user: User, address_id: int) -> Address:
    return get_user_address(user=user, address_id=address_id, address_type=AddressType.RECIPIENT)


def _full_address(address: Address) -> str:
    return " ".join(
        part for part in [address.country_region, address.province_city, address.detail_address] if part
    ).strip()


def build_recipient_snapshot(address: Address) -> dict[str, object]:
    return {
        "address_id": address.id,
        "name": address.contact_name,
        "phone": address.phone,
        "country": address.country_region,
        "region": address.province_city,
        "city": "",
        "address": address.detail_address,
        "address_line": address.detail_address,
        "full_address": _full_address(address),
        "postal_code": address.postal_code,
        "country_region": address.country_region,
        "province_city": address.province_city,
        "company": address.company,
    }


def manual_recipient_snapshot(
    *,
    recipient_name: str,
    recipient_phone: str,
    recipient_address: str,
    destination_country: str,
    postal_code: str = "",
) -> dict[str, object]:
    return {
        "name": recipient_name,
        "phone": recipient_phone,
        "country": destination_country,
        "address": recipient_address,
        "address_line": recipient_address,
        "full_address": recipient_address,
        "postal_code": postal_code,
    }


def _clear_default(user: User, address_type: str) -> None:
    Address.objects.filter(user=user, address_type=address_type, is_active=True, is_default=True).update(
        is_default=False
    )


def _ensure_type_has_default(user: User, address_type: str) -> None:
    active_addresses = Address.objects.filter(user=user, address_type=address_type, is_active=True)
    if active_addresses.exists() and not active_addresses.filter(is_default=True).exists():
        first_address = active_addresses.order_by("-id").first()
        Address.objects.filter(id=first_address.id).update(is_default=True)


@transaction.atomic
def create_address(*, user: User, **data) -> Address:
    data = _normalize_address_data(data)
    address_type = data.get("address_type", AddressType.RECIPIENT)
    is_default = data.pop("is_default", False) or not Address.objects.filter(
        user=user,
        address_type=address_type,
        is_active=True,
    ).exists()
    if is_default:
        _clear_default(user, address_type)
    return Address.objects.create(user=user, is_default=is_default, is_active=True, **data)


@transaction.atomic
def update_address(*, address: Address, **data) -> Address:
    data = _normalize_address_data(data)
    old_type = address.address_type
    is_default = data.pop("is_default", False)
    for field, value in data.items():
        setattr(address, field, value)
    if is_default:
        _clear_default(address.user, address.address_type)
    address.is_default = is_default
    address.is_active = True
    address.save()
    _ensure_type_has_default(address.user, old_type)
    _ensure_type_has_default(address.user, address.address_type)
    return address


@transaction.atomic
def deactivate_address(*, address: Address) -> Address:
    address.is_active = False
    address.is_default = False
    address.save(update_fields=["is_active", "is_default", "updated_at"])
    _ensure_type_has_default(address.user, address.address_type)
    return address


@transaction.atomic
def set_default_address(*, address: Address) -> Address:
    if not address.is_active:
        raise exceptions.ValidationError({"address_id": ["停用地址不能设为默认"]})
    _clear_default(address.user, address.address_type)
    address.is_default = True
    address.save(update_fields=["is_default", "updated_at"])
    return address
