"""Seed demo regions (countries + key provinces/states)."""
from django.core.management.base import BaseCommand

from apps.regions.models import CountryRegion, RegionLevel

SEED_DATA = [
    {
        "code": "CN", "name": "中国", "iso_code": "CN", "phone_code": "86",
        "currency_code": "CNY", "level": RegionLevel.COUNTRY, "sort_order": 1,
        "children": [
            {"code": "CN-BJ", "name": "北京市", "level": RegionLevel.PROVINCE, "sort_order": 1},
            {"code": "CN-SH", "name": "上海市", "level": RegionLevel.PROVINCE, "sort_order": 2},
            {"code": "CN-GD", "name": "广东省", "level": RegionLevel.PROVINCE, "sort_order": 3,
             "children": [
                 {"code": "CN-GD-GZ", "name": "广州市", "level": RegionLevel.CITY, "sort_order": 1},
                 {"code": "CN-GD-SZ", "name": "深圳市", "level": RegionLevel.CITY, "sort_order": 2},
             ]},
            {"code": "CN-ZJ", "name": "浙江省", "level": RegionLevel.PROVINCE, "sort_order": 4},
            {"code": "CN-JS", "name": "江苏省", "level": RegionLevel.PROVINCE, "sort_order": 5},
            {"code": "CN-FJ", "name": "福建省", "level": RegionLevel.PROVINCE, "sort_order": 6},
        ],
    },
    {
        "code": "US", "name": "美国", "iso_code": "US", "phone_code": "1",
        "currency_code": "USD", "level": RegionLevel.COUNTRY, "sort_order": 2,
        "children": [
            {"code": "US-CA", "name": "California", "level": RegionLevel.PROVINCE, "sort_order": 1},
            {"code": "US-NY", "name": "New York", "level": RegionLevel.PROVINCE, "sort_order": 2},
            {"code": "US-TX", "name": "Texas", "level": RegionLevel.PROVINCE, "sort_order": 3},
            {"code": "US-FL", "name": "Florida", "level": RegionLevel.PROVINCE, "sort_order": 4},
        ],
    },
    {
        "code": "JP", "name": "日本", "iso_code": "JP", "phone_code": "81",
        "currency_code": "JPY", "level": RegionLevel.COUNTRY, "sort_order": 3,
        "children": [
            {"code": "JP-TK", "name": "東京都", "level": RegionLevel.PROVINCE, "sort_order": 1},
            {"code": "JP-OS", "name": "大阪府", "level": RegionLevel.PROVINCE, "sort_order": 2},
        ],
    },
    {
        "code": "KR", "name": "韩国", "iso_code": "KR", "phone_code": "82",
        "currency_code": "KRW", "level": RegionLevel.COUNTRY, "sort_order": 4,
        "children": [
            {"code": "KR-SEL", "name": "首尔", "level": RegionLevel.PROVINCE, "sort_order": 1},
        ],
    },
    {
        "code": "GB", "name": "英国", "iso_code": "GB", "phone_code": "44",
        "currency_code": "GBP", "level": RegionLevel.COUNTRY, "sort_order": 5,
    },
    {
        "code": "DE", "name": "德国", "iso_code": "DE", "phone_code": "49",
        "currency_code": "EUR", "level": RegionLevel.COUNTRY, "sort_order": 6,
    },
    {
        "code": "AU", "name": "澳大利亚", "iso_code": "AU", "phone_code": "61",
        "currency_code": "AUD", "level": RegionLevel.COUNTRY, "sort_order": 7,
    },
    {
        "code": "SG", "name": "新加坡", "iso_code": "SG", "phone_code": "65",
        "currency_code": "SGD", "level": RegionLevel.COUNTRY, "sort_order": 8,
    },
]


def _create_recursive(data_list, parent=None):
    created = 0
    for item in data_list:
        children_data = item.pop("children", [])
        item["parent"] = parent
        obj, was_created = CountryRegion.objects.get_or_create(
            code=item["code"], defaults=item,
        )
        if was_created:
            created += 1
        if children_data:
            created += _create_recursive(children_data, parent=obj)
    return created


class Command(BaseCommand):
    help = "Seed demo country & region data"

    def handle(self, *args, **options):
        created = _create_recursive(SEED_DATA)
        self.stdout.write(self.style.SUCCESS(f"Seeded {created} region(s)"))
