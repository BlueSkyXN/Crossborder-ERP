from __future__ import annotations

import hashlib
import mimetypes
import posixpath
import uuid
from dataclasses import dataclass
from pathlib import Path

from django.conf import settings
from django.db import transaction
from django.utils import timezone
from rest_framework import exceptions

from apps.iam.models import AdminUser
from apps.members.models import User

from .models import FileOwnerType, FileStatus, FileUsage, StoredFile


@dataclass(frozen=True)
class FilePolicy:
    max_size_bytes: int
    extensions: frozenset[str]
    content_types: frozenset[str]


MB = 1024 * 1024

IMAGE_CONTENT_TYPES = frozenset({"image/jpeg", "image/png", "image/webp", "image/gif"})
IMAGE_EXTENSIONS = frozenset({".jpg", ".jpeg", ".png", ".webp", ".gif"})
DOCUMENT_CONTENT_TYPES = frozenset({"application/pdf"})
DOCUMENT_EXTENSIONS = frozenset({".pdf"})
IMPORT_CONTENT_TYPES = frozenset(
    {
        "text/csv",
        "application/csv",
        "application/vnd.ms-excel",
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    }
)
IMPORT_EXTENSIONS = frozenset({".csv", ".xls", ".xlsx"})

FILE_POLICIES: dict[str, FilePolicy] = {
    FileUsage.PARCEL_PHOTO: FilePolicy(5 * MB, IMAGE_EXTENSIONS, IMAGE_CONTENT_TYPES),
    FileUsage.PRODUCT_IMAGE: FilePolicy(5 * MB, IMAGE_EXTENSIONS, IMAGE_CONTENT_TYPES),
    FileUsage.CONTENT_IMAGE: FilePolicy(5 * MB, IMAGE_EXTENSIONS, IMAGE_CONTENT_TYPES),
    FileUsage.PURCHASE_PROOF: FilePolicy(
        10 * MB,
        IMAGE_EXTENSIONS | DOCUMENT_EXTENSIONS,
        IMAGE_CONTENT_TYPES | DOCUMENT_CONTENT_TYPES,
    ),
    FileUsage.REMITTANCE_PROOF: FilePolicy(
        10 * MB,
        IMAGE_EXTENSIONS | DOCUMENT_EXTENSIONS,
        IMAGE_CONTENT_TYPES | DOCUMENT_CONTENT_TYPES,
    ),
    FileUsage.MESSAGE_ATTACHMENT: FilePolicy(
        10 * MB,
        IMAGE_EXTENSIONS | DOCUMENT_EXTENSIONS,
        IMAGE_CONTENT_TYPES | DOCUMENT_CONTENT_TYPES,
    ),
    FileUsage.IMPORT_FILE: FilePolicy(10 * MB, IMPORT_EXTENSIONS, IMPORT_CONTENT_TYPES),
    FileUsage.GENERAL: FilePolicy(5 * MB, IMAGE_EXTENSIONS | DOCUMENT_EXTENSIONS, IMAGE_CONTENT_TYPES | DOCUMENT_CONTENT_TYPES),
}


def _normalize_usage(usage: str) -> str:
    usage = (usage or "").strip().upper()
    if usage not in FileUsage.values:
        raise exceptions.ValidationError({"usage": ["文件用途无效"]})
    return usage


def _safe_original_name(name: str) -> str:
    normalized = posixpath.basename((name or "").replace("\\", "/")).strip()
    return normalized[:255] or "uploaded-file"


def _extension(original_name: str) -> str:
    return Path(original_name).suffix.lower()


def _content_type(uploaded_file, original_name: str) -> str:
    declared = (getattr(uploaded_file, "content_type", "") or "").split(";")[0].strip().lower()
    guessed = (mimetypes.guess_type(original_name)[0] or "").lower()
    return declared or guessed


def validate_uploaded_file(*, uploaded_file, usage: str) -> dict[str, object]:
    usage = _normalize_usage(usage)
    original_name = _safe_original_name(getattr(uploaded_file, "name", ""))
    extension = _extension(original_name)
    content_type = _content_type(uploaded_file, original_name)
    size_bytes = int(getattr(uploaded_file, "size", 0) or 0)
    policy = FILE_POLICIES[usage]

    errors: dict[str, list[str]] = {}
    if size_bytes <= 0:
        errors["file"] = ["文件不能为空"]
    if size_bytes > policy.max_size_bytes:
        errors["file_size"] = [f"文件不能超过 {policy.max_size_bytes // MB}MB"]
    if extension not in policy.extensions:
        errors["extension"] = ["文件扩展名不支持"]
    if content_type not in policy.content_types:
        errors["content_type"] = ["文件 MIME 类型不支持"]
    if errors:
        raise exceptions.ValidationError(errors)

    return {
        "usage": usage,
        "original_name": original_name,
        "extension": extension,
        "content_type": content_type,
        "size_bytes": size_bytes,
    }


def _build_file_id() -> str:
    return f"F{uuid.uuid4().hex}"


def _build_storage_key(*, extension: str) -> str:
    now = timezone.now()
    return f"uploads/{now:%Y/%m}/{uuid.uuid4().hex}{extension}"


def get_storage_path(stored_file: StoredFile) -> Path:
    media_root = Path(settings.MEDIA_ROOT).resolve()
    path = (media_root / stored_file.storage_key).resolve()
    if media_root != path and media_root not in path.parents:
        raise exceptions.PermissionDenied("文件路径无效")
    return path


@transaction.atomic
def create_stored_file(
    *,
    uploaded_file,
    usage: str,
    owner_type: str,
    member: User | None = None,
    admin_user: AdminUser | None = None,
) -> StoredFile:
    metadata = validate_uploaded_file(uploaded_file=uploaded_file, usage=usage)
    storage_key = _build_storage_key(extension=str(metadata["extension"]))
    stored_file = StoredFile(
        file_id=_build_file_id(),
        usage=str(metadata["usage"]),
        owner_type=owner_type,
        uploaded_by_member=member,
        uploaded_by_admin=admin_user,
        original_name=str(metadata["original_name"]),
        storage_key=storage_key,
        content_type=str(metadata["content_type"]),
        size_bytes=int(metadata["size_bytes"]),
        extension=str(metadata["extension"]),
        checksum_sha256="",
        status=FileStatus.ACTIVE,
    )

    storage_path = get_storage_path(stored_file)
    storage_path.parent.mkdir(parents=True, exist_ok=True)
    digest = hashlib.sha256()
    with storage_path.open("wb") as destination:
        for chunk in uploaded_file.chunks():
            digest.update(chunk)
            destination.write(chunk)

    stored_file.checksum_sha256 = digest.hexdigest()
    stored_file.save()
    return stored_file


def create_member_file(*, member: User, uploaded_file, usage: str) -> StoredFile:
    return create_stored_file(
        uploaded_file=uploaded_file,
        usage=usage,
        owner_type=FileOwnerType.MEMBER,
        member=member,
    )


def create_admin_file(*, admin_user: AdminUser, uploaded_file, usage: str) -> StoredFile:
    return create_stored_file(
        uploaded_file=uploaded_file,
        usage=usage,
        owner_type=FileOwnerType.ADMIN,
        admin_user=admin_user,
    )


def _active_file(file_id: str) -> StoredFile:
    try:
        return StoredFile.objects.get(file_id=file_id, status=FileStatus.ACTIVE)
    except StoredFile.DoesNotExist as exc:
        raise exceptions.NotFound("文件不存在") from exc


def member_can_access_file(*, stored_file: StoredFile, member: User) -> bool:
    if stored_file.owner_type == FileOwnerType.MEMBER and stored_file.uploaded_by_member_id == member.id:
        return True

    from apps.parcels.models import ParcelPhoto

    if ParcelPhoto.objects.filter(file_id=stored_file.file_id, parcel__user=member).exists():
        return True

    from apps.tickets.models import TicketMessage

    return TicketMessage.objects.filter(file_id=stored_file.file_id, ticket__user=member).exists()


def get_member_file(*, member: User, file_id: str) -> StoredFile:
    stored_file = _active_file(file_id)
    if not member_can_access_file(stored_file=stored_file, member=member):
        raise exceptions.NotFound("文件不存在")
    return stored_file


def get_admin_file(*, file_id: str) -> StoredFile:
    return _active_file(file_id)


def list_member_files(*, member: User):
    return StoredFile.objects.filter(
        owner_type=FileOwnerType.MEMBER,
        uploaded_by_member=member,
        status=FileStatus.ACTIVE,
    )


def list_admin_files():
    return StoredFile.objects.filter(status=FileStatus.ACTIVE)


@transaction.atomic
def delete_member_file(*, member: User, file_id: str) -> StoredFile:
    stored_file = _active_file(file_id)
    if stored_file.owner_type != FileOwnerType.MEMBER or stored_file.uploaded_by_member_id != member.id:
        raise exceptions.NotFound("文件不存在")
    stored_file.status = FileStatus.DELETED
    stored_file.save(update_fields=["status", "updated_at"])
    return stored_file


@transaction.atomic
def delete_admin_file(*, file_id: str) -> StoredFile:
    stored_file = _active_file(file_id)
    stored_file.status = FileStatus.DELETED
    stored_file.save(update_fields=["status", "updated_at"])
    return stored_file


def assert_admin_files_usable(*, file_ids: list[str] | None, allowed_usages: set[str], field_name: str) -> list[str]:
    normalized = list(dict.fromkeys(file_id.strip() for file_id in file_ids or [] if file_id.strip()))
    if not normalized:
        return []

    files = {
        stored_file.file_id: stored_file
        for stored_file in StoredFile.objects.filter(file_id__in=normalized, status=FileStatus.ACTIVE)
    }
    missing = [file_id for file_id in normalized if file_id not in files]
    invalid_usage = [
        file_id
        for file_id in normalized
        if file_id in files and files[file_id].usage not in allowed_usages
    ]
    if missing or invalid_usage:
        messages = []
        if missing:
            messages.append(f"文件不存在或已删除: {', '.join(missing)}")
        if invalid_usage:
            messages.append(f"文件用途不允许: {', '.join(invalid_usage)}")
        raise exceptions.ValidationError({field_name: messages})
    return normalized
