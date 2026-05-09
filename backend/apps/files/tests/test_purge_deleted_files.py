from datetime import timedelta
from io import StringIO

import pytest
from django.core.management import call_command
from django.core.management.base import CommandError
from django.utils import timezone

from apps.files.models import FileOwnerType, FileStatus, FileUsage, StoredFile


def _stored_file(*, storage_key, status=FileStatus.DELETED, updated_days_ago=10):
    stored_file = StoredFile.objects.create(
        file_id=f"F{abs(hash(storage_key))}",
        usage=FileUsage.GENERAL,
        owner_type=FileOwnerType.ADMIN,
        original_name=storage_key.rsplit("/", 1)[-1] or "file.bin",
        storage_key=storage_key,
        content_type="application/pdf",
        size_bytes=4,
        extension=".pdf",
        checksum_sha256="0" * 64,
        status=status,
    )
    StoredFile.objects.filter(pk=stored_file.pk).update(
        updated_at=timezone.now() - timedelta(days=updated_days_ago)
    )
    stored_file.refresh_from_db()
    return stored_file


def _write_media_file(media_root, storage_key, content=b"data"):
    path = media_root / storage_key
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_bytes(content)
    return path


@pytest.mark.django_db
def test_purge_deleted_files_dry_run_keeps_file(tmp_path, settings):
    settings.MEDIA_ROOT = tmp_path
    path = _write_media_file(tmp_path, "uploads/deleted.pdf")
    _stored_file(storage_key="uploads/deleted.pdf")

    stdout = StringIO()
    call_command("purge_deleted_files", older_than_days=7, dry_run=True, stdout=stdout)

    assert path.exists()
    assert "would delete 1" in stdout.getvalue()
    assert "dry run only" in stdout.getvalue()


@pytest.mark.django_db
def test_purge_deleted_files_only_deletes_old_soft_deleted_files(tmp_path, settings):
    settings.MEDIA_ROOT = tmp_path
    old_deleted = _write_media_file(tmp_path, "uploads/old-deleted.pdf")
    active = _write_media_file(tmp_path, "uploads/active.pdf")
    recent_deleted = _write_media_file(tmp_path, "uploads/recent-deleted.pdf")
    _stored_file(storage_key="uploads/old-deleted.pdf")
    _stored_file(storage_key="uploads/active.pdf", status=FileStatus.ACTIVE)
    _stored_file(storage_key="uploads/recent-deleted.pdf", updated_days_ago=1)
    _stored_file(storage_key="uploads/missing.pdf")

    stdout = StringIO()
    call_command("purge_deleted_files", older_than_days=7, stdout=stdout)

    assert not old_deleted.exists()
    assert active.exists()
    assert recent_deleted.exists()
    assert StoredFile.objects.filter(status=FileStatus.DELETED).count() == 3
    assert "Deleted 1 local media files" in stdout.getvalue()
    assert "missing 1" in stdout.getvalue()


@pytest.mark.django_db
def test_purge_deleted_files_skips_unsafe_storage_key(tmp_path, settings):
    settings.MEDIA_ROOT = tmp_path / "media"
    settings.MEDIA_ROOT.mkdir()
    outside = tmp_path / "escape.pdf"
    outside.write_bytes(b"safe")
    _stored_file(storage_key="../escape.pdf")

    stdout = StringIO()
    call_command("purge_deleted_files", older_than_days=7, stdout=stdout)

    assert outside.exists()
    assert "unsafe 1" in stdout.getvalue()


@pytest.mark.django_db
def test_purge_deleted_files_skips_directory_path(tmp_path, settings):
    settings.MEDIA_ROOT = tmp_path
    directory = tmp_path / "uploads/directory.pdf"
    directory.mkdir(parents=True)
    _stored_file(storage_key="uploads/directory.pdf")

    stdout = StringIO()
    call_command("purge_deleted_files", older_than_days=7, stdout=stdout)

    assert directory.exists()
    assert directory.is_dir()
    assert "unsafe 1" in stdout.getvalue()


def test_purge_deleted_files_requires_positive_retention():
    with pytest.raises(CommandError, match="greater than 0"):
        call_command("purge_deleted_files", older_than_days=0)
