from __future__ import annotations

from django.db.models import Count, QuerySet

from .models import CountryRegion


def get_regions(
    *, parent_id: int | None = None, level: str | None = None,
    is_active: bool | None = None, keyword: str | None = None,
) -> QuerySet[CountryRegion]:
    qs = CountryRegion.objects.select_related("parent").annotate(
        _children_count=Count("children"),
    )
    if parent_id is not None:
        qs = qs.filter(parent_id=parent_id)
    elif level is None and keyword is None:
        qs = qs.filter(parent__isnull=True)
    if level:
        qs = qs.filter(level=level)
    if is_active is not None:
        qs = qs.filter(is_active=is_active)
    if keyword:
        qs = qs.filter(name__icontains=keyword)
    return qs.order_by("sort_order", "id")


def get_region_tree() -> QuerySet[CountryRegion]:
    return CountryRegion.objects.filter(
        parent__isnull=True, is_active=True,
    ).order_by("sort_order", "id")


def create_region(data: dict) -> CountryRegion:
    return CountryRegion.objects.create(**data)


def update_region(region: CountryRegion, data: dict) -> CountryRegion:
    for key, value in data.items():
        setattr(region, key, value)
    region.save()
    return region


def delete_region(region: CountryRegion) -> None:
    if region.children.exists():
        raise ValueError("请先删除下级地区")
    region.delete()
