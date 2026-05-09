from __future__ import annotations

import csv
from dataclasses import dataclass
from decimal import Decimal, InvalidOperation
from io import StringIO
import uuid

from django.core.exceptions import ValidationError as DjangoValidationError
from django.core.validators import URLValidator
from django.db import transaction
from django.utils import timezone
from rest_framework import exceptions

from apps.files.models import FileOwnerType, FileUsage, StoredFile
from apps.files.services import get_member_file, get_storage_path
from apps.members.models import User
from apps.warehouses.models import ConfigStatus, Warehouse

from .models import Parcel, ParcelImportJob, ParcelImportStatus, ParcelItem, ParcelStatus
from .services import _build_parcel_no, _temporary_parcel_no


PARCEL_IMPORT_HEADERS = [
    "warehouse_code",
    "tracking_no",
    "carrier",
    "item_name",
    "quantity",
    "declared_value",
    "product_url",
    "remark",
]
PARCEL_IMPORT_MAX_ROWS = 500
PARCEL_TEMPLATE_SAMPLE = {
    "warehouse_code": "SZ",
    "tracking_no": "SF1234567890",
    "carrier": "SF",
    "item_name": "T-shirt",
    "quantity": "1",
    "declared_value": "19.99",
    "product_url": "https://example.com/item",
    "remark": "batch forecast demo",
}


@dataclass(frozen=True)
class ImportErrorItem:
    row: int
    field: str
    message: str
    value: str = ""

    def as_dict(self) -> dict[str, object]:
        return {
            "row": self.row,
            "field": self.field,
            "message": self.message,
            "value": self.value,
        }


@dataclass(frozen=True)
class ParsedImportRow:
    row_number: int
    warehouse: Warehouse
    tracking_no: str
    carrier: str
    item: dict | None
    remark: str


def _temporary_import_no() -> str:
    return f"TMPIMP{uuid.uuid4().hex[:18]}"


def _build_import_no(job_id: int) -> str:
    return f"IMP{job_id:08d}"


def _csv_with_bom(headers: list[str], rows: list[dict[str, object]]) -> str:
    buffer = StringIO()
    buffer.write("\ufeff")
    writer = csv.DictWriter(buffer, fieldnames=headers, extrasaction="ignore", lineterminator="\n")
    writer.writeheader()
    for row in rows:
        writer.writerow(row)
    return buffer.getvalue()


def build_parcel_import_template_csv() -> str:
    return _csv_with_bom(PARCEL_IMPORT_HEADERS, [PARCEL_TEMPLATE_SAMPLE])


def _create_job(
    *,
    user: User,
    stored_file: StoredFile,
    status: str,
    total_rows: int,
    success_count: int,
    errors: list[dict[str, object]],
) -> ParcelImportJob:
    job = ParcelImportJob.objects.create(
        job_no=_temporary_import_no(),
        user=user,
        file_id=stored_file.file_id,
        original_name=stored_file.original_name,
        status=status,
        total_rows=total_rows,
        success_count=success_count,
        error_count=len(errors),
        errors_json=errors,
    )
    job.job_no = _build_import_no(job.id)
    job.save(update_fields=["job_no", "updated_at"])
    return job


def _cell(row: dict[str, str], key: str) -> str:
    return (row.get(key) or "").strip()


def _blank_row(row: dict[str, str]) -> bool:
    return all(not (value or "").strip() for value in row.values())


def _decimal(value: str, *, row_number: int, field: str, errors: list[ImportErrorItem]) -> Decimal | None:
    if value == "":
        return Decimal("0.00")
    try:
        amount = Decimal(value)
    except (InvalidOperation, TypeError, ValueError):
        errors.append(ImportErrorItem(row_number, field, "必须是有效金额", value))
        return None
    if not amount.is_finite():
        errors.append(ImportErrorItem(row_number, field, "必须是有效金额", value))
        return None
    if amount < Decimal("0"):
        errors.append(ImportErrorItem(row_number, field, "不能小于 0", value))
        return None
    if amount > Decimal("99999999.99"):
        errors.append(ImportErrorItem(row_number, field, "金额超过上限", value))
        return None
    try:
        return amount.quantize(Decimal("0.01"))
    except InvalidOperation:
        errors.append(ImportErrorItem(row_number, field, "金额格式无效", value))
        return None


def _quantity(value: str, *, row_number: int, errors: list[ImportErrorItem]) -> int | None:
    if value == "":
        return 1
    try:
        quantity = int(value)
    except (TypeError, ValueError):
        errors.append(ImportErrorItem(row_number, "quantity", "必须是正整数", value))
        return None
    if quantity <= 0:
        errors.append(ImportErrorItem(row_number, "quantity", "必须大于 0", value))
        return None
    return quantity


def _validate_csv_headers(fieldnames: list[str] | None) -> list[ImportErrorItem]:
    if not fieldnames:
        return [ImportErrorItem(1, "file", "CSV 文件缺少表头")]
    normalized = [field.strip().lstrip("\ufeff") for field in fieldnames]
    missing = [header for header in PARCEL_IMPORT_HEADERS if header not in normalized]
    if not missing:
        return []
    return [ImportErrorItem(1, "header", f"缺少模板列: {', '.join(missing)}")]


def _read_csv_rows(stored_file: StoredFile) -> tuple[list[dict[str, str]], list[ImportErrorItem]]:
    try:
        content = get_storage_path(stored_file).read_bytes().decode("utf-8-sig")
    except UnicodeDecodeError:
        return [], [ImportErrorItem(1, "file", "CSV 必须使用 UTF-8 编码")]

    reader = csv.DictReader(StringIO(content))
    header_errors = _validate_csv_headers(reader.fieldnames)
    if header_errors:
        return [], header_errors

    rows = []
    for index, row in enumerate(reader, start=2):
        normalized = {key.strip().lstrip("\ufeff"): (value or "") for key, value in row.items() if key is not None}
        if _blank_row(normalized):
            continue
        normalized["_row_number"] = str(index)
        rows.append(normalized)

    if not rows:
        return [], [ImportErrorItem(1, "file", "CSV 文件没有可导入数据")]
    if len(rows) > PARCEL_IMPORT_MAX_ROWS:
        return [], [ImportErrorItem(1, "file", f"单次最多导入 {PARCEL_IMPORT_MAX_ROWS} 行")]
    return rows, []


def _parse_rows(rows: list[dict[str, str]]) -> tuple[list[ParsedImportRow], list[ImportErrorItem]]:
    errors: list[ImportErrorItem] = []
    parsed: list[ParsedImportRow] = []
    tracking_by_row: dict[str, int] = {}
    warehouses = {
        warehouse.code.upper(): warehouse
        for warehouse in Warehouse.objects.filter(status=ConfigStatus.ACTIVE)
    }
    existing_tracking = set(
        Parcel.objects.filter(
            tracking_no__in=[_cell(row, "tracking_no") for row in rows if _cell(row, "tracking_no")]
        ).values_list("tracking_no", flat=True)
    )
    validate_url = URLValidator()

    for row in rows:
        row_number = int(row["_row_number"])
        warehouse_code = _cell(row, "warehouse_code").upper()
        tracking_no = _cell(row, "tracking_no")
        carrier = _cell(row, "carrier")
        item_name = _cell(row, "item_name")
        product_url = _cell(row, "product_url")
        remark = _cell(row, "remark")

        warehouse = warehouses.get(warehouse_code)
        if not warehouse_code:
            errors.append(ImportErrorItem(row_number, "warehouse_code", "仓库代码必填"))
        elif not warehouse:
            errors.append(ImportErrorItem(row_number, "warehouse_code", "仓库不存在或已停用", warehouse_code))

        if not tracking_no:
            errors.append(ImportErrorItem(row_number, "tracking_no", "快递单号必填"))
        elif len(tracking_no) > 80:
            errors.append(ImportErrorItem(row_number, "tracking_no", "快递单号不能超过 80 个字符", tracking_no))
        elif tracking_no in tracking_by_row:
            errors.append(
                ImportErrorItem(
                    row_number,
                    "tracking_no",
                    f"CSV 内重复，首次出现在第 {tracking_by_row[tracking_no]} 行",
                    tracking_no,
                )
            )
        elif tracking_no in existing_tracking:
            errors.append(ImportErrorItem(row_number, "tracking_no", "系统中已存在相同快递单号", tracking_no))
        else:
            tracking_by_row[tracking_no] = row_number

        if len(carrier) > 80:
            errors.append(ImportErrorItem(row_number, "carrier", "承运商不能超过 80 个字符", carrier))
        if item_name and len(item_name) > 120:
            errors.append(ImportErrorItem(row_number, "item_name", "商品名称不能超过 120 个字符", item_name))
        if product_url and len(product_url) > 200:
            errors.append(ImportErrorItem(row_number, "product_url", "商品链接不能超过 200 个字符", product_url))
        elif product_url:
            try:
                validate_url(product_url)
            except DjangoValidationError:
                errors.append(ImportErrorItem(row_number, "product_url", "商品链接格式无效", product_url))
        if remark and len(remark) > 1000:
            errors.append(ImportErrorItem(row_number, "remark", "备注不能超过 1000 个字符"))

        quantity = _quantity(_cell(row, "quantity"), row_number=row_number, errors=errors)
        declared_value = _decimal(
            _cell(row, "declared_value"),
            row_number=row_number,
            field="declared_value",
            errors=errors,
        )
        item = None
        if item_name:
            item = {
                "name": item_name,
                "quantity": quantity or 1,
                "declared_value": declared_value or Decimal("0.00"),
                "product_url": product_url,
                "remark": "",
            }
        elif _cell(row, "quantity") or _cell(row, "declared_value") or product_url:
            errors.append(ImportErrorItem(row_number, "item_name", "填写商品信息时必须提供商品名称"))

        if warehouse and tracking_no and tracking_no not in existing_tracking and tracking_no in tracking_by_row:
            parsed.append(
                ParsedImportRow(
                    row_number=row_number,
                    warehouse=warehouse,
                    tracking_no=tracking_no,
                    carrier=carrier,
                    item=item,
                    remark=remark,
                )
            )

    return parsed, errors


def _assert_member_import_file(*, user: User, stored_file: StoredFile) -> None:
    if stored_file.owner_type != FileOwnerType.MEMBER or stored_file.uploaded_by_member_id != user.id:
        raise exceptions.NotFound("文件不存在")
    if stored_file.usage != FileUsage.IMPORT_FILE:
        raise exceptions.ValidationError({"file_id": ["文件用途必须是导入文件"]})


@transaction.atomic
def import_parcel_forecasts(*, user: User, file_id: str) -> ParcelImportJob:
    stored_file = get_member_file(member=user, file_id=file_id)
    _assert_member_import_file(user=user, stored_file=stored_file)

    if stored_file.extension != ".csv":
        errors = [ImportErrorItem(1, "file", "当前批量预报仅支持 CSV 文件", stored_file.original_name).as_dict()]
        return _create_job(
            user=user,
            stored_file=stored_file,
            status=ParcelImportStatus.FAILED,
            total_rows=0,
            success_count=0,
            errors=errors,
        )

    raw_rows, read_errors = _read_csv_rows(stored_file)
    if read_errors:
        return _create_job(
            user=user,
            stored_file=stored_file,
            status=ParcelImportStatus.FAILED,
            total_rows=len(raw_rows),
            success_count=0,
            errors=[error.as_dict() for error in read_errors],
        )

    parsed_rows, validation_errors = _parse_rows(raw_rows)
    if validation_errors:
        return _create_job(
            user=user,
            stored_file=stored_file,
            status=ParcelImportStatus.FAILED,
            total_rows=len(raw_rows),
            success_count=0,
            errors=[error.as_dict() for error in validation_errors],
        )

    created_count = 0
    for parsed in parsed_rows:
        parcel = Parcel.objects.create(
            parcel_no=_temporary_parcel_no(),
            user=user,
            warehouse=parsed.warehouse,
            tracking_no=parsed.tracking_no,
            carrier=parsed.carrier,
            status=ParcelStatus.PENDING_INBOUND,
            remark=parsed.remark,
        )
        parcel.parcel_no = _build_parcel_no(parcel.id)
        parcel.save(update_fields=["parcel_no", "updated_at"])
        if parsed.item:
            ParcelItem.objects.create(parcel=parcel, **parsed.item)
        created_count += 1

    return _create_job(
        user=user,
        stored_file=stored_file,
        status=ParcelImportStatus.COMPLETED,
        total_rows=len(raw_rows),
        success_count=created_count,
        errors=[],
    )


def list_member_import_jobs(*, user: User):
    return ParcelImportJob.objects.filter(user=user)


def _format_datetime(value) -> str:
    if not value:
        return ""
    return timezone.localtime(value).strftime("%Y-%m-%d %H:%M:%S")


def _parcel_export_row(parcel: Parcel, *, include_member: bool) -> dict[str, object]:
    items = list(parcel.items.all())
    item_summary = "; ".join(
        f"{item.name} x{item.quantity} ({item.declared_value})" for item in items
    )
    row: dict[str, object] = {
        "parcel_no": parcel.parcel_no,
        "warehouse_code": parcel.warehouse.code,
        "warehouse_name": parcel.warehouse.name,
        "tracking_no": parcel.tracking_no,
        "carrier": parcel.carrier,
        "status": parcel.status,
        "weight_kg": parcel.weight_kg or "",
        "dimensions_cm": (
            f"{parcel.length_cm or '-'} x {parcel.width_cm or '-'} x {parcel.height_cm or '-'}"
            if parcel.length_cm or parcel.width_cm or parcel.height_cm
            else ""
        ),
        "items": item_summary,
        "remark": parcel.remark,
        "created_at": _format_datetime(parcel.created_at),
        "inbound_at": _format_datetime(parcel.inbound_at),
    }
    if include_member:
        row = {"user_email": parcel.user.email, **row}
    return row


def build_parcel_export_csv(*, user: User | None = None) -> str:
    queryset = Parcel.objects.select_related("warehouse", "user").prefetch_related("items")
    include_member = user is None
    if user is not None:
        queryset = queryset.filter(user=user)
    headers = [
        "parcel_no",
        "warehouse_code",
        "warehouse_name",
        "tracking_no",
        "carrier",
        "status",
        "weight_kg",
        "dimensions_cm",
        "items",
        "remark",
        "created_at",
        "inbound_at",
    ]
    if include_member:
        headers = ["user_email", *headers]
    return _csv_with_bom(headers, [_parcel_export_row(parcel, include_member=include_member) for parcel in queryset])
