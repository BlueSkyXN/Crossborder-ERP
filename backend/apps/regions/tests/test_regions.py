import pytest
from django.test import TestCase

from apps.regions.models import CountryRegion, RegionLevel
from apps.regions.services import create_region, delete_region, get_regions, update_region


class RegionModelTests(TestCase):
    def test_create_country(self):
        region = CountryRegion.objects.create(
            name="中国", code="CN", iso_code="CN", phone_code="86",
            currency_code="CNY", level=RegionLevel.COUNTRY,
        )
        assert region.pk is not None
        assert str(region) == "CN - 中国"
        assert region.full_path == "中国"

    def test_hierarchical_regions(self):
        china = CountryRegion.objects.create(name="中国", code="CN", level=RegionLevel.COUNTRY)
        guangdong = CountryRegion.objects.create(
            name="广东省", code="GD", level=RegionLevel.PROVINCE, parent=china,
        )
        shenzhen = CountryRegion.objects.create(
            name="深圳市", code="SZ", level=RegionLevel.CITY, parent=guangdong,
        )
        assert shenzhen.full_path == "中国 / 广东省 / 深圳市"
        assert china.children.count() == 1
        assert guangdong.children.count() == 1


class RegionServiceTests(TestCase):
    def test_create_and_get(self):
        region = create_region({"name": "日本", "code": "JP", "level": RegionLevel.COUNTRY})
        results = list(get_regions())
        assert len(results) == 1
        assert results[0].pk == region.pk

    def test_get_by_parent(self):
        china = create_region({"name": "中国", "code": "CN"})
        create_region({"name": "北京", "code": "BJ", "parent": china, "level": RegionLevel.PROVINCE})
        create_region({"name": "日本", "code": "JP"})
        children = list(get_regions(parent_id=china.pk))
        assert len(children) == 1
        assert children[0].code == "BJ"

    def test_update_region(self):
        region = create_region({"name": "中国", "code": "CN"})
        updated = update_region(region, {"name": "中华人民共和国"})
        assert updated.name == "中华人民共和国"

    def test_delete_region_no_children(self):
        region = create_region({"name": "测试", "code": "TEST"})
        delete_region(region)
        assert not CountryRegion.objects.filter(pk=region.pk).exists()

    def test_delete_region_with_children_fails(self):
        parent = create_region({"name": "中国", "code": "CN"})
        create_region({"name": "北京", "code": "BJ", "parent": parent})
        with pytest.raises(ValueError, match="下级地区"):
            delete_region(parent)

    def test_keyword_search(self):
        create_region({"name": "中国", "code": "CN"})
        create_region({"name": "日本", "code": "JP"})
        results = list(get_regions(keyword="中"))
        assert len(results) == 1


class RegionAPITests(TestCase):
    def setUp(self):
        self.china = CountryRegion.objects.create(
            name="中国", code="CN", iso_code="CN",
            phone_code="86", currency_code="CNY",
            level=RegionLevel.COUNTRY,
        )
        CountryRegion.objects.create(
            name="广东省", code="GD", parent=self.china,
            level=RegionLevel.PROVINCE,
        )

    def test_public_region_list(self):
        resp = self.client.get("/api/v1/regions")
        assert resp.status_code == 200
        data = resp.json()["data"]
        assert len(data) == 1
        assert data[0]["code"] == "CN"

    def test_public_region_list_by_parent(self):
        resp = self.client.get(f"/api/v1/regions?parent_id={self.china.pk}")
        assert resp.status_code == 200
        data = resp.json()["data"]
        assert len(data) == 1
        assert data[0]["code"] == "GD"

    def test_public_region_tree(self):
        resp = self.client.get("/api/v1/regions/tree")
        assert resp.status_code == 200
        data = resp.json()["data"]
        assert len(data) == 1
        assert len(data[0]["children"]) == 1
