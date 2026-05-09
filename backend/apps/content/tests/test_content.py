import pytest
from django.urls import reverse

from apps.content.models import ContentCategory, ContentCategoryStatus, ContentPage, ContentStatus
from apps.content.services import seed_content_demo_data
from apps.iam.services import seed_iam_demo_data


@pytest.fixture
def seeded_content(db):
    seed_iam_demo_data()
    seed_content_demo_data()


def admin_token(client, email="admin@example.com"):
    response = client.post(
        reverse("admin-login"),
        {"email": email, "password": "password123"},
        content_type="application/json",
    )
    return response.json()["data"]["access_token"]


def test_public_content_lists_only_published_pages(client, seeded_content):
    category = ContentCategory.objects.get(slug="getting-started")
    ContentPage.objects.create(
        category=category,
        type="HELP",
        slug="draft-help-page",
        title="草稿帮助",
        summary="不应展示",
        body="草稿内容",
        status=ContentStatus.DRAFT,
    )

    response = client.get(reverse("content-page-list"), {"type": "HELP"})

    assert response.status_code == 200
    slugs = {item["slug"] for item in response.json()["data"]["items"]}
    assert "how-to-forecast-parcel" in slugs
    assert "draft-help-page" not in slugs
    item = next(row for row in response.json()["data"]["items"] if row["slug"] == "how-to-forecast-parcel")
    assert "body" not in item
    assert "status" not in item


def test_public_content_detail_hides_hidden_or_draft_pages(client, seeded_content):
    page = ContentPage.objects.get(slug="how-to-forecast-parcel")
    page.status = ContentStatus.HIDDEN
    page.save(update_fields=["status", "updated_at"])

    response = client.get(reverse("content-page-detail", kwargs={"slug": page.slug}))

    assert response.status_code == 404


def test_admin_creates_publishes_and_hides_content_page(client, seeded_content):
    category = ContentCategory.objects.get(slug="getting-started")
    token = admin_token(client)

    created = client.post(
        reverse("admin-content-page-list"),
        {
            "category_id": category.id,
            "type": "HELP",
            "slug": "customs-clearance-help",
            "title": "清关说明",
            "summary": "清关材料准备",
            "body": "请提前准备收件人信息和商品申报资料。",
            "status": "DRAFT",
            "sort_order": 15,
        },
        content_type="application/json",
        HTTP_AUTHORIZATION=f"Bearer {token}",
    )

    assert created.status_code == 201
    page_id = created.json()["data"]["id"]
    assert created.json()["data"]["created_by_name"] == "超级管理员"

    public_before = client.get(reverse("content-page-detail", kwargs={"slug": "customs-clearance-help"}))
    assert public_before.status_code == 404

    published = client.post(
        reverse("admin-content-page-publish", kwargs={"page_id": page_id}),
        HTTP_AUTHORIZATION=f"Bearer {token}",
    )
    assert published.status_code == 200
    assert published.json()["data"]["status"] == ContentStatus.PUBLISHED
    assert published.json()["data"]["published_at"]

    public_after = client.get(reverse("content-page-detail", kwargs={"slug": "customs-clearance-help"}))
    assert public_after.status_code == 200
    assert public_after.json()["data"]["body"] == "请提前准备收件人信息和商品申报资料。"
    assert "created_by_name" not in public_after.json()["data"]

    hidden = client.post(
        reverse("admin-content-page-hide", kwargs={"page_id": page_id}),
        HTTP_AUTHORIZATION=f"Bearer {token}",
    )
    assert hidden.status_code == 200
    assert hidden.json()["data"]["status"] == ContentStatus.HIDDEN
    assert client.get(reverse("content-page-detail", kwargs={"slug": "customs-clearance-help"})).status_code == 404


def test_content_slug_must_be_unique(client, seeded_content):
    token = admin_token(client)

    response = client.post(
        reverse("admin-content-page-list"),
        {
            "type": "HELP",
            "slug": "how-to-forecast-parcel",
            "title": "重复 slug",
            "body": "重复内容",
        },
        content_type="application/json",
        HTTP_AUTHORIZATION=f"Bearer {token}",
    )

    assert response.status_code == 400
    assert response.json()["code"] == "VALIDATION_ERROR"
    assert "slug" in response.json()["data"]["field_errors"]


def test_content_admin_requires_content_permission(client, seeded_content):
    token = admin_token(client, email="finance@example.com")

    response = client.get(reverse("admin-content-page-list"), HTTP_AUTHORIZATION=f"Bearer {token}")

    assert response.status_code == 403
    assert response.json()["code"] == "FORBIDDEN"


def test_public_categories_hide_disabled_categories(client, seeded_content):
    disabled = ContentCategory.objects.create(
        type="HELP",
        slug="disabled-category",
        name="停用分类",
        status=ContentCategoryStatus.DISABLED,
    )

    response = client.get(reverse("content-category-list"), {"type": "HELP"})

    assert response.status_code == 200
    slugs = {item["slug"] for item in response.json()["data"]["items"]}
    assert "getting-started" in slugs
    assert disabled.slug not in slugs


def test_public_pages_hide_pages_under_disabled_categories(client, seeded_content):
    category = ContentCategory.objects.get(slug="getting-started")
    category.status = ContentCategoryStatus.DISABLED
    category.save(update_fields=["status", "updated_at"])
    page = ContentPage.objects.get(slug="how-to-forecast-parcel")

    list_response = client.get(reverse("content-page-list"), {"type": "HELP"})
    detail_response = client.get(reverse("content-page-detail", kwargs={"slug": page.slug}))

    assert list_response.status_code == 200
    assert page.slug not in {item["slug"] for item in list_response.json()["data"]["items"]}
    assert detail_response.status_code == 404
