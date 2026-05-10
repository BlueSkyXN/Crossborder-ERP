"""Content selectors — read-only database queries (NFR-AI-001).

Selectors are pure query functions that return QuerySets or model instances.
They contain no side effects and no business logic beyond filtering/ordering.

This module demonstrates the selectors/services/providers layering pattern
described in ADR-0004 and the next-phase architecture sample (ARCH-BACKEND-001).

Architecture layers for the content app:
    selectors.py  — read queries (this file)
    services.py   — write commands (create, update, publish, hide)
    views.py      — HTTP interface, delegates to selectors + services
    models.py     — Django ORM models
"""
from __future__ import annotations

from django.db.models import Q, QuerySet

from .models import (
    ContentCategory,
    ContentCategoryStatus,
    ContentPage,
    ContentStatus,
    ContentType,
)


# ---------------------------------------------------------------------------
# Category selectors
# ---------------------------------------------------------------------------

def get_public_categories(*, content_type: str = "") -> QuerySet[ContentCategory]:
    """Active categories visible to public users."""
    qs = ContentCategory.objects.filter(status=ContentCategoryStatus.ACTIVE).order_by("sort_order", "id")
    if content_type:
        qs = qs.filter(type=content_type)
    return qs


def get_admin_categories() -> QuerySet[ContentCategory]:
    """All categories for admin listing."""
    return ContentCategory.objects.all().order_by("sort_order", "id")


def get_category_by_id(category_id: int) -> ContentCategory:
    """Get a single category by primary key. Raises DoesNotExist if not found."""
    return ContentCategory.objects.get(id=category_id)


# ---------------------------------------------------------------------------
# Page selectors
# ---------------------------------------------------------------------------

def get_public_pages(
    *,
    content_type: str = "",
    category_slug: str = "",
    keyword: str = "",
) -> QuerySet[ContentPage]:
    """Published pages visible to public users, with optional filters."""
    qs = (
        ContentPage.objects.filter(status=ContentStatus.PUBLISHED)
        .filter(Q(category__isnull=True) | Q(category__status=ContentCategoryStatus.ACTIVE))
        .select_related("category")
        .order_by("type", "sort_order", "-published_at", "-id")
    )
    if content_type:
        qs = qs.filter(type=content_type)
    if category_slug:
        qs = qs.filter(category__slug=category_slug)
    if keyword:
        qs = qs.filter(title__icontains=keyword)
    return qs


def get_public_page_by_slug(slug: str) -> ContentPage:
    """Get a single published page by slug. Raises DoesNotExist if not found."""
    return (
        ContentPage.objects.filter(status=ContentStatus.PUBLISHED)
        .filter(Q(category__isnull=True) | Q(category__status=ContentCategoryStatus.ACTIVE))
        .select_related("category")
        .get(slug=slug)
    )


def get_admin_pages() -> QuerySet[ContentPage]:
    """All pages for admin listing."""
    return (
        ContentPage.objects.select_related("category", "created_by_admin", "updated_by_admin")
        .all()
        .order_by("type", "sort_order", "-id")
    )


def get_admin_page_by_id(page_id: int) -> ContentPage:
    """Get a single page by primary key for admin operations."""
    return ContentPage.objects.get(id=page_id)
