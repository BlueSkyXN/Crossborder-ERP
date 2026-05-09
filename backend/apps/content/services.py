from django.db import transaction
from django.db.models import Q
from django.utils import timezone

from apps.iam.models import AdminUser

from .models import ContentCategory, ContentCategoryStatus, ContentPage, ContentStatus


def public_categories_queryset():
    return ContentCategory.objects.filter(status=ContentCategoryStatus.ACTIVE).order_by("sort_order", "id")


def public_pages_queryset():
    return (
        ContentPage.objects.filter(status=ContentStatus.PUBLISHED)
        .filter(Q(category__isnull=True) | Q(category__status=ContentCategoryStatus.ACTIVE))
        .select_related("category")
        .order_by("type", "sort_order", "-published_at", "-id")
    )


def admin_categories_queryset():
    return ContentCategory.objects.all().order_by("sort_order", "id")


def admin_pages_queryset():
    return (
        ContentPage.objects.select_related("category", "created_by_admin", "updated_by_admin")
        .all()
        .order_by("type", "sort_order", "-id")
    )


@transaction.atomic
def create_content_page(*, operator: AdminUser, **data) -> ContentPage:
    if data.get("status") == ContentStatus.PUBLISHED and data.get("published_at") is None:
        data["published_at"] = timezone.now()
    page = ContentPage.objects.create(created_by_admin=operator, updated_by_admin=operator, **data)
    return ContentPage.objects.select_related("category", "created_by_admin", "updated_by_admin").get(id=page.id)


@transaction.atomic
def update_content_page(*, page: ContentPage, operator: AdminUser, **data) -> ContentPage:
    if data.get("status") == ContentStatus.PUBLISHED and data.get("published_at") is None and page.published_at is None:
        data["published_at"] = timezone.now()
    for field, value in data.items():
        setattr(page, field, value)
    page.updated_by_admin = operator
    page.save(update_fields=[*data.keys(), "updated_by_admin", "updated_at"])
    return ContentPage.objects.select_related("category", "created_by_admin", "updated_by_admin").get(id=page.id)


@transaction.atomic
def publish_content_page(*, page: ContentPage, operator: AdminUser) -> ContentPage:
    page.status = ContentStatus.PUBLISHED
    if page.published_at is None:
        page.published_at = timezone.now()
    page.updated_by_admin = operator
    page.save(update_fields=["status", "published_at", "updated_by_admin", "updated_at"])
    return ContentPage.objects.select_related("category", "created_by_admin", "updated_by_admin").get(id=page.id)


@transaction.atomic
def hide_content_page(*, page: ContentPage, operator: AdminUser) -> ContentPage:
    page.status = ContentStatus.HIDDEN
    page.updated_by_admin = operator
    page.save(update_fields=["status", "updated_by_admin", "updated_at"])
    return ContentPage.objects.select_related("category", "created_by_admin", "updated_by_admin").get(id=page.id)


def seed_content_demo_data() -> None:
    help_category, _ = ContentCategory.objects.update_or_create(
        slug="getting-started",
        defaults={
            "type": "HELP",
            "name": "新手入门",
            "description": "仓库地址、包裹预报和集运流程说明。",
            "sort_order": 10,
            "status": ContentCategoryStatus.ACTIVE,
        },
    )
    announcement_category, _ = ContentCategory.objects.update_or_create(
        slug="service-updates",
        defaults={
            "type": "ANNOUNCEMENT",
            "name": "服务公告",
            "description": "仓库、线路和系统维护通知。",
            "sort_order": 20,
            "status": ContentCategoryStatus.ACTIVE,
        },
    )
    demo_pages = [
        {
            "category": announcement_category,
            "type": "ANNOUNCEMENT",
            "slug": "warehouse-service-notice",
            "title": "仓库服务公告",
            "summary": "深圳仓当前正常收货，入库后可在包裹中心查看状态。",
            "body": "深圳仓当前正常收货。请在下单时填写会员专属仓库标识，便于系统自动匹配包裹。",
            "sort_order": 10,
        },
        {
            "category": help_category,
            "type": "HELP",
            "slug": "how-to-forecast-parcel",
            "title": "如何提交包裹预报",
            "summary": "复制仓库地址后，在包裹中心提交国内快递单号。",
            "body": "复制专属仓库地址并下单后，在包裹中心填写快递单号。仓库扫描入库时会自动匹配到你的账户。",
            "sort_order": 20,
        },
        {
            "category": None,
            "type": "TERMS",
            "slug": "terms-of-service",
            "title": "服务条款",
            "summary": "本地演示环境服务条款占位内容。",
            "body": "本条款用于 SQLite-first 演示环境。正式业务条款、禁运品规则和赔付标准需业务确认后更新。",
            "sort_order": 30,
        },
        {
            "category": None,
            "type": "PRIVACY",
            "slug": "privacy-policy",
            "title": "隐私政策",
            "summary": "本地演示环境隐私政策占位内容。",
            "body": "本政策说明会员资料、包裹和财务数据的基础使用边界。正式隐私政策需法务确认。",
            "sort_order": 40,
        },
        {
            "category": None,
            "type": "ABOUT",
            "slug": "about-us",
            "title": "关于我们",
            "summary": "CrossBorder ERP 集运与代购演示系统。",
            "body": "CrossBorder ERP 当前用于验证 AI Agent 驱动的跨境集运、代购、财务和客服全栈系统开发闭环。",
            "sort_order": 50,
        },
    ]
    for page_data in demo_pages:
        ContentPage.objects.update_or_create(
            slug=page_data["slug"],
            defaults={
                **page_data,
                "status": ContentStatus.PUBLISHED,
                "published_at": timezone.now(),
            },
        )
