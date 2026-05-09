from django.db import models


class ContentStatus(models.TextChoices):
    DRAFT = "DRAFT", "草稿"
    PUBLISHED = "PUBLISHED", "已发布"
    HIDDEN = "HIDDEN", "已隐藏"


class ContentType(models.TextChoices):
    ANNOUNCEMENT = "ANNOUNCEMENT", "公告"
    HELP = "HELP", "帮助"
    TERMS = "TERMS", "服务条款"
    PRIVACY = "PRIVACY", "隐私政策"
    ABOUT = "ABOUT", "关于我们"


class ContentCategoryStatus(models.TextChoices):
    ACTIVE = "ACTIVE", "启用"
    DISABLED = "DISABLED", "停用"


class ContentCategory(models.Model):
    type = models.CharField(max_length=30, choices=ContentType.choices, default=ContentType.HELP)
    slug = models.SlugField(max_length=120, unique=True)
    name = models.CharField(max_length=120)
    description = models.TextField(blank=True)
    sort_order = models.PositiveIntegerField(default=0)
    status = models.CharField(
        max_length=30,
        choices=ContentCategoryStatus.choices,
        default=ContentCategoryStatus.ACTIVE,
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "content_categories"
        ordering = ["sort_order", "id"]
        indexes = [
            models.Index(fields=["type", "status", "sort_order"], name="idx_content_cat_type_status"),
        ]

    def __str__(self) -> str:
        return f"{self.slug} ({self.name})"


class ContentPage(models.Model):
    category = models.ForeignKey(
        ContentCategory,
        on_delete=models.PROTECT,
        related_name="pages",
        null=True,
        blank=True,
    )
    type = models.CharField(max_length=30, choices=ContentType.choices, default=ContentType.HELP)
    slug = models.SlugField(max_length=120, unique=True)
    title = models.CharField(max_length=180)
    summary = models.CharField(max_length=300, blank=True)
    body = models.TextField()
    status = models.CharField(max_length=30, choices=ContentStatus.choices, default=ContentStatus.DRAFT)
    sort_order = models.PositiveIntegerField(default=0)
    published_at = models.DateTimeField(null=True, blank=True)
    created_by_admin = models.ForeignKey(
        "iam.AdminUser",
        on_delete=models.PROTECT,
        related_name="created_content_pages",
        null=True,
        blank=True,
    )
    updated_by_admin = models.ForeignKey(
        "iam.AdminUser",
        on_delete=models.PROTECT,
        related_name="updated_content_pages",
        null=True,
        blank=True,
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "content_pages"
        ordering = ["type", "sort_order", "-published_at", "-id"]
        indexes = [
            models.Index(fields=["type", "status", "sort_order"], name="idx_content_pg_type_status"),
            models.Index(fields=["category", "status"], name="idx_content_pg_cat_status"),
        ]

    def __str__(self) -> str:
        return f"{self.slug} ({self.title})"
