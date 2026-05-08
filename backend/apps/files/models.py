from django.db import models


class FileUsage(models.TextChoices):
    PARCEL_PHOTO = "PARCEL_PHOTO", "包裹图片"
    REMITTANCE_PROOF = "REMITTANCE_PROOF", "汇款凭证"
    MESSAGE_ATTACHMENT = "MESSAGE_ATTACHMENT", "消息附件"
    PRODUCT_IMAGE = "PRODUCT_IMAGE", "商品图片"
    CONTENT_IMAGE = "CONTENT_IMAGE", "内容图片"
    PURCHASE_PROOF = "PURCHASE_PROOF", "采购凭证"
    IMPORT_FILE = "IMPORT_FILE", "导入文件"
    GENERAL = "GENERAL", "通用文件"


class FileOwnerType(models.TextChoices):
    MEMBER = "MEMBER", "会员"
    ADMIN = "ADMIN", "后台"


class FileStatus(models.TextChoices):
    ACTIVE = "ACTIVE", "启用"
    DELETED = "DELETED", "已删除"


class StoredFile(models.Model):
    file_id = models.CharField(max_length=40, unique=True)
    usage = models.CharField(max_length=40, choices=FileUsage.choices)
    owner_type = models.CharField(max_length=20, choices=FileOwnerType.choices)
    uploaded_by_member = models.ForeignKey(
        "members.User",
        on_delete=models.PROTECT,
        related_name="uploaded_files",
        null=True,
        blank=True,
    )
    uploaded_by_admin = models.ForeignKey(
        "iam.AdminUser",
        on_delete=models.PROTECT,
        related_name="uploaded_files",
        null=True,
        blank=True,
    )
    original_name = models.CharField(max_length=255)
    storage_key = models.CharField(max_length=255, unique=True)
    content_type = models.CharField(max_length=120)
    size_bytes = models.PositiveBigIntegerField()
    extension = models.CharField(max_length=20)
    checksum_sha256 = models.CharField(max_length=64)
    status = models.CharField(max_length=20, choices=FileStatus.choices, default=FileStatus.ACTIVE)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "files"
        ordering = ["-id"]
        indexes = [
            models.Index(fields=["owner_type", "status"], name="idx_files_owner_status"),
            models.Index(fields=["usage", "status"], name="idx_files_usage_status"),
        ]

    def __str__(self) -> str:
        return f"{self.file_id} {self.original_name}"
