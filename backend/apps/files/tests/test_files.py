import pytest
from django.core.files.uploadedfile import SimpleUploadedFile
from django.urls import reverse

from apps.files.models import FileStatus, FileUsage, StoredFile
from apps.iam.services import seed_iam_demo_data
from apps.members.services import issue_member_access_token, register_user, seed_member_demo_data


JPEG_BYTES = b"\xff\xd8\xff\xe0\x00\x10JFIF\x00\x01\x01\x01\x00\x48\x00\x48\x00\x00\xff\xd9"
PNG_BYTES = b"\x89PNG\r\n\x1a\n\x00\x00\x00\rIHDR\x00\x00\x00\x01"
WEBP_BYTES = b"RIFF\x1a\x00\x00\x00WEBPVP8 \x0e\x00\x00\x00"
PDF_BYTES = b"%PDF-1.4\n1 0 obj\n<<>>\nendobj\n%%EOF\n"


@pytest.fixture
def seeded_files(db):
    seed_iam_demo_data()
    seed_member_demo_data()


def member_token(client, email="user@example.com", password="password123"):
    response = client.post(
        reverse("member-login"),
        {"email": email, "password": password},
        content_type="application/json",
    )
    return response.json()["data"]["access_token"]


def admin_token(client, email="admin@example.com"):
    response = client.post(
        reverse("admin-login"),
        {"email": email, "password": "password123"},
        content_type="application/json",
    )
    return response.json()["data"]["access_token"]


def image_upload(name="parcel.jpg", content=None, content_type="image/jpeg"):
    if content is None:
        if name.endswith(".png"):
            content = PNG_BYTES
        elif name.endswith(".webp"):
            content = WEBP_BYTES
        elif name.endswith(".pdf"):
            content = PDF_BYTES
        else:
            content = JPEG_BYTES
    return SimpleUploadedFile(name, content, content_type=content_type)


def test_member_upload_download_and_delete_own_file(client, seeded_files):
    token = member_token(client)
    response = client.post(
        reverse("file-list"),
        {"usage": FileUsage.REMITTANCE_PROOF, "file": image_upload()},
        HTTP_AUTHORIZATION=f"Bearer {token}",
    )

    assert response.status_code == 201
    data = response.json()["data"]
    assert data["file_id"].startswith("F")
    assert data["download_url"] == f"/api/v1/files/{data['file_id']}/download"
    assert "storage_key" not in data

    download = client.get(
        reverse("file-download", kwargs={"file_id": data["file_id"]}),
        HTTP_AUTHORIZATION=f"Bearer {token}",
    )
    assert download.status_code == 200
    assert download["Content-Type"] == "image/jpeg"

    delete_response = client.delete(
        reverse("file-detail", kwargs={"file_id": data["file_id"]}),
        HTTP_AUTHORIZATION=f"Bearer {token}",
    )
    assert delete_response.status_code == 200
    assert StoredFile.objects.get(file_id=data["file_id"]).status == FileStatus.DELETED


def test_member_cannot_read_or_delete_other_member_file(client, seeded_files):
    owner = register_user("file-owner@example.com", "password123")
    other = register_user("file-other@example.com", "password123")
    owner_token = issue_member_access_token(owner)
    other_token = issue_member_access_token(other)

    upload = client.post(
        reverse("file-list"),
        {
            "usage": FileUsage.MESSAGE_ATTACHMENT,
            "file": image_upload("message.png", PNG_BYTES, "image/png"),
        },
        HTTP_AUTHORIZATION=f"Bearer {owner_token}",
    )
    file_id = upload.json()["data"]["file_id"]

    detail = client.get(
        reverse("file-detail", kwargs={"file_id": file_id}),
        HTTP_AUTHORIZATION=f"Bearer {other_token}",
    )
    delete_response = client.delete(
        reverse("file-detail", kwargs={"file_id": file_id}),
        HTTP_AUTHORIZATION=f"Bearer {other_token}",
    )

    assert detail.status_code == 404
    assert delete_response.status_code == 404
    assert StoredFile.objects.get(file_id=file_id).status == FileStatus.ACTIVE


def test_upload_rejects_invalid_type_and_oversized_file(client, seeded_files):
    token = member_token(client)
    invalid = client.post(
        reverse("file-list"),
        {"usage": FileUsage.PARCEL_PHOTO, "file": image_upload("bad.txt", b"bad", "text/plain")},
        HTTP_AUTHORIZATION=f"Bearer {token}",
    )
    oversized = client.post(
        reverse("file-list"),
        {
            "usage": FileUsage.PARCEL_PHOTO,
            "file": image_upload("large.jpg", b"x" * (5 * 1024 * 1024 + 1), "image/jpeg"),
        },
        HTTP_AUTHORIZATION=f"Bearer {token}",
    )

    assert invalid.status_code == 400
    assert invalid.json()["code"] == "VALIDATION_ERROR"
    assert oversized.status_code == 400
    assert oversized.json()["code"] == "VALIDATION_ERROR"


def test_upload_rejects_extension_mime_or_signature_mismatch(client, seeded_files):
    token = member_token(client)
    wrong_signature = client.post(
        reverse("file-list"),
        {"usage": FileUsage.PARCEL_PHOTO, "file": image_upload("parcel.jpg", b"not-a-jpeg", "image/jpeg")},
        HTTP_AUTHORIZATION=f"Bearer {token}",
    )
    wrong_mime = client.post(
        reverse("file-list"),
        {"usage": FileUsage.PARCEL_PHOTO, "file": image_upload("parcel.jpg", JPEG_BYTES, "image/png")},
        HTTP_AUTHORIZATION=f"Bearer {token}",
    )

    assert wrong_signature.status_code == 400
    assert wrong_signature.json()["data"]["field_errors"]["file_signature"] == ["文件内容与扩展名不匹配"]
    assert wrong_mime.status_code == 400
    assert "content_type" in wrong_mime.json()["data"]["field_errors"]


def test_member_upload_accepts_pdf_for_document_allowed_usage(client, seeded_files):
    token = member_token(client)

    response = client.post(
        reverse("file-list"),
        {"usage": FileUsage.REMITTANCE_PROOF, "file": image_upload("proof.pdf", PDF_BYTES, "application/pdf")},
        HTTP_AUTHORIZATION=f"Bearer {token}",
    )

    assert response.status_code == 201
    data = response.json()["data"]
    assert data["original_name"] == "proof.pdf"
    assert data["content_type"] == "application/pdf"


def test_admin_file_api_uses_admin_download_url(client, seeded_files):
    token = admin_token(client)
    response = client.post(
        reverse("admin-file-list"),
        {"usage": FileUsage.PARCEL_PHOTO, "file": image_upload("parcel.webp", WEBP_BYTES, "image/webp")},
        HTTP_AUTHORIZATION=f"Bearer {token}",
    )

    assert response.status_code == 201
    data = response.json()["data"]
    assert data["download_url"] == f"/api/v1/admin/files/{data['file_id']}/download"
    assert data["owner_type"] == "ADMIN"


def test_admin_file_api_requires_file_manage_permission(client, seeded_files):
    token = admin_token(client, email="buyer@example.com")

    response = client.post(
        reverse("admin-file-list"),
        {"usage": FileUsage.PRODUCT_IMAGE, "file": image_upload("product.jpg", JPEG_BYTES, "image/jpeg")},
        HTTP_AUTHORIZATION=f"Bearer {token}",
    )

    assert response.status_code == 403
    assert response.json()["code"] == "FORBIDDEN"
