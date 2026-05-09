import csv
from io import BytesIO, StringIO
from zipfile import ZipFile

import pytest
from django.core.files.uploadedfile import SimpleUploadedFile
from django.test import override_settings
from django.urls import reverse

from apps.files.models import FileUsage
from apps.iam.services import seed_iam_demo_data
from apps.members.services import issue_member_access_token, register_user, seed_member_demo_data
from apps.parcels.import_export import XLSX_CONTENT_TYPE, build_parcel_import_template_xlsx
from apps.parcels.models import Parcel, ParcelImportJob, ParcelImportStatus
from apps.parcels.services import forecast_parcel
from apps.warehouses.models import Warehouse
from apps.warehouses.services import seed_warehouse_demo_data


@pytest.fixture
def seeded_imports(db):
    seed_iam_demo_data()
    seed_member_demo_data()
    seed_warehouse_demo_data()


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


def upload_member_import_file(client, token, name: str, content: bytes, content_type: str = "text/csv") -> dict:
    response = client.post(
        reverse("file-list"),
        {
            "usage": FileUsage.IMPORT_FILE,
            "file": SimpleUploadedFile(name, content, content_type=content_type),
        },
        HTTP_AUTHORIZATION=f"Bearer {token}",
    )
    assert response.status_code == 201, response.json()
    return response.json()["data"]


def import_csv_text(rows: list[str]) -> bytes:
    header = "warehouse_code,tracking_no,carrier,item_name,quantity,declared_value,product_url,remark"
    return ("\n".join([header, *rows]) + "\n").encode("utf-8")


def invalid_xlsx_like_zip() -> bytes:
    buffer = BytesIO()
    with ZipFile(buffer, "w") as workbook:
        workbook.writestr("not-workbook.txt", "not a standard xlsx workbook")
    return buffer.getvalue()


@override_settings(MEDIA_ROOT="/tmp/crossborder-erp-test-media")
def test_member_imports_parcel_forecast_csv_and_exports_own_rows(client, seeded_imports):
    token = member_token(client)
    file_data = upload_member_import_file(
        client,
        token,
        "forecast.csv",
        import_csv_text(
            [
                "SZ,IMPORT-TRACK-001,SF,T-shirt,2,19.99,https://example.com/item,first row",
                "SZ,IMPORT-TRACK-002,YTO,Keyboard,1,89.50,,second row",
            ]
        ),
    )

    response = client.post(
        reverse("parcel-import-list"),
        {"file_id": file_data["file_id"]},
        content_type="application/json",
        HTTP_AUTHORIZATION=f"Bearer {token}",
    )

    assert response.status_code == 201
    job = response.json()["data"]
    assert job["job_no"].startswith("IMP")
    assert job["status"] == ParcelImportStatus.COMPLETED
    assert job["total_rows"] == 2
    assert job["success_count"] == 2
    assert job["error_count"] == 0
    assert Parcel.objects.filter(tracking_no="IMPORT-TRACK-001", user__email="user@example.com").exists()
    imported = Parcel.objects.get(tracking_no="IMPORT-TRACK-002")
    assert imported.items.get().name == "Keyboard"

    jobs = client.get(reverse("parcel-import-list"), HTTP_AUTHORIZATION=f"Bearer {token}")
    assert jobs.status_code == 200
    assert jobs.json()["data"]["items"][0]["id"] == job["id"]

    other_user = register_user("import-export-other@example.com", "password123")
    warehouse = Warehouse.objects.get(code="SZ")
    forecast_parcel(user=other_user, warehouse=warehouse, tracking_no="OTHER-EXPORT-TRACK")
    export = client.get(reverse("parcel-export"), HTTP_AUTHORIZATION=f"Bearer {token}")
    csv_body = export.content.decode("utf-8-sig")
    assert export.status_code == 200
    assert "IMPORT-TRACK-001" in csv_body
    assert "OTHER-EXPORT-TRACK" not in csv_body


@override_settings(MEDIA_ROOT="/tmp/crossborder-erp-test-media")
def test_parcel_csv_export_escapes_formula_like_cells(client, seeded_imports):
    user = register_user("formula-export@example.com", "password123")
    warehouse = Warehouse.objects.get(code="SZ")
    forecast_parcel(
        user=user,
        warehouse=warehouse,
        tracking_no="FORMULA-EXPORT-TRACK",
        carrier="@carrier",
        remark="+SUM(1,1)",
        items=[
            {
                "name": '=HYPERLINK("https://example.com")',
                "quantity": 1,
                "declared_value": "9.90",
                "product_url": "",
                "remark": "",
            }
        ],
    )
    token = issue_member_access_token(user)

    export = client.get(reverse("parcel-export"), HTTP_AUTHORIZATION=f"Bearer {token}")
    rows = list(csv.DictReader(StringIO(export.content.decode("utf-8-sig"))))

    assert export.status_code == 200
    assert rows[0]["carrier"] == "'@carrier"
    assert rows[0]["items"].startswith("'=HYPERLINK")
    assert rows[0]["remark"] == "'+SUM(1,1)"


@override_settings(MEDIA_ROOT="/tmp/crossborder-erp-test-media")
def test_member_imports_parcel_forecast_xlsx(client, seeded_imports):
    token = member_token(client)
    file_data = upload_member_import_file(
        client,
        token,
        "forecast.xlsx",
        build_parcel_import_template_xlsx(),
        XLSX_CONTENT_TYPE,
    )

    response = client.post(
        reverse("parcel-import-list"),
        {"file_id": file_data["file_id"]},
        content_type="application/json",
        HTTP_AUTHORIZATION=f"Bearer {token}",
    )

    assert response.status_code == 201
    job = response.json()["data"]
    assert job["status"] == ParcelImportStatus.COMPLETED
    assert job["total_rows"] == 1
    assert job["success_count"] == 1
    parcel = Parcel.objects.get(tracking_no="SF1234567890")
    assert parcel.warehouse.code == "SZ"
    assert parcel.items.get().name == "T-shirt"


@override_settings(MEDIA_ROOT="/tmp/crossborder-erp-test-media")
def test_import_validation_records_row_errors_and_keeps_all_or_none(client, seeded_imports):
    token = member_token(client)
    warehouse = Warehouse.objects.get(code="SZ")
    owner = register_user("existing-import@example.com", "password123")
    forecast_parcel(user=owner, warehouse=warehouse, tracking_no="IMPORT-DUP-EXISTS")
    file_data = upload_member_import_file(
        client,
        token,
        "bad-forecast.csv",
        import_csv_text(
            [
                "SZ,IMPORT-VALID-ROLLBACK,SF,T-shirt,1,10.00,,should not be created",
                "SZ,IMPORT-DUP-EXISTS,SF,T-shirt,1,10.00,,existing duplicate",
                "SZ,IMPORT-VALID-ROLLBACK,YTO,Keyboard,1,12.00,,csv duplicate",
                "UNKNOWN,IMPORT-UNKNOWN,SF,T-shirt,0,abc,,bad warehouse quantity value",
                "SZ,IMPORT-BAD-URL,SF,T-shirt,1,NaN,not-a-url,bad url and value",
            ]
        ),
    )

    response = client.post(
        reverse("parcel-import-list"),
        {"file_id": file_data["file_id"]},
        content_type="application/json",
        HTTP_AUTHORIZATION=f"Bearer {token}",
    )

    assert response.status_code == 201
    job = response.json()["data"]
    assert job["status"] == ParcelImportStatus.FAILED
    assert job["total_rows"] == 5
    assert job["success_count"] == 0
    assert job["error_count"] >= 4
    assert {error["field"] for error in job["errors_json"]} >= {
        "warehouse_code",
        "tracking_no",
        "quantity",
        "declared_value",
        "product_url",
    }
    assert not Parcel.objects.filter(tracking_no="IMPORT-VALID-ROLLBACK").exists()
    assert ParcelImportJob.objects.filter(id=job["id"], errors_json__0__row__gte=2).exists()


@override_settings(MEDIA_ROOT="/tmp/crossborder-erp-test-media")
def test_member_cannot_import_another_members_file(client, seeded_imports):
    owner = register_user("import-owner@example.com", "password123")
    other = register_user("import-other@example.com", "password123")
    owner_token = issue_member_access_token(owner)
    other_token = issue_member_access_token(other)
    file_data = upload_member_import_file(
        client,
        owner_token,
        "owner-forecast.csv",
        import_csv_text(["SZ,IMPORT-OWNER-FILE,SF,T-shirt,1,9.90,,owner"]),
    )

    response = client.post(
        reverse("parcel-import-list"),
        {"file_id": file_data["file_id"]},
        content_type="application/json",
        HTTP_AUTHORIZATION=f"Bearer {other_token}",
    )

    assert response.status_code == 404
    assert response.json()["code"] == "NOT_FOUND"
    assert not ParcelImportJob.objects.filter(file_id=file_data["file_id"]).exists()
    assert not Parcel.objects.filter(tracking_no="IMPORT-OWNER-FILE").exists()


@override_settings(MEDIA_ROOT="/tmp/crossborder-erp-test-media")
def test_invalid_xlsx_import_file_returns_recorded_failure(client, seeded_imports):
    token = member_token(client)
    file_data = upload_member_import_file(
        client,
        token,
        "forecast.xlsx",
        invalid_xlsx_like_zip(),
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    )

    response = client.post(
        reverse("parcel-import-list"),
        {"file_id": file_data["file_id"]},
        content_type="application/json",
        HTTP_AUTHORIZATION=f"Bearer {token}",
    )

    assert response.status_code == 201
    job = response.json()["data"]
    assert job["status"] == ParcelImportStatus.FAILED
    assert job["success_count"] == 0
    assert job["errors_json"][0]["field"] == "file"
    assert "XLSX" in job["errors_json"][0]["message"]


def test_import_template_download_requires_member_and_has_expected_headers(client, seeded_imports):
    anonymous = client.get(reverse("parcel-import-template"))
    assert anonymous.status_code == 401

    response = client.get(reverse("parcel-import-template"), HTTP_AUTHORIZATION=f"Bearer {member_token(client)}")
    body = response.content.decode("utf-8-sig")
    assert response.status_code == 200
    assert response["Content-Type"] == "text/csv; charset=utf-8"
    assert body.startswith("warehouse_code,tracking_no,carrier,item_name,quantity,declared_value,product_url,remark")


def test_import_xlsx_template_download_requires_member_and_is_workbook(client, seeded_imports):
    anonymous = client.get(reverse("parcel-import-template-xlsx"))
    assert anonymous.status_code == 401

    response = client.get(reverse("parcel-import-template-xlsx"), HTTP_AUTHORIZATION=f"Bearer {member_token(client)}")

    assert response.status_code == 200
    assert response["Content-Type"] == XLSX_CONTENT_TYPE
    with ZipFile(BytesIO(response.content)) as workbook:
        assert "xl/workbook.xml" in workbook.namelist()
        assert "xl/worksheets/sheet1.xml" in workbook.namelist()


def test_admin_parcel_export_requires_parcel_permission(client, seeded_imports):
    warehouse = Warehouse.objects.get(code="SZ")
    user = register_user("admin-export-member@example.com", "password123")
    forecast_parcel(user=user, warehouse=warehouse, tracking_no="ADMIN-EXPORT-TRACK")

    blocked = client.get(
        reverse("admin-parcel-export"),
        HTTP_AUTHORIZATION=f"Bearer {admin_token(client, email='finance@example.com')}",
    )
    assert blocked.status_code == 403
    assert blocked.json()["code"] == "FORBIDDEN"

    response = client.get(
        reverse("admin-parcel-export"),
        HTTP_AUTHORIZATION=f"Bearer {admin_token(client, email='warehouse@example.com')}",
    )
    assert response.status_code == 200
    csv_body = response.content.decode("utf-8-sig")
    assert "user_email" in csv_body
    assert "ADMIN-EXPORT-TRACK" in csv_body
