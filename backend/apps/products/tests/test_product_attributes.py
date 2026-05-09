import pytest
from django.urls import reverse
from rest_framework.test import APIClient

from apps.iam.services import seed_iam_demo_data
from apps.products.models import AttributeType, Product, ProductAttribute, ProductAttributeValue, ProductCategory
from apps.products.services import seed_product_demo_data


pytestmark = pytest.mark.django_db


@pytest.fixture
def api_client():
    return APIClient()


@pytest.fixture
def seeded_products():
    seed_iam_demo_data()
    seed_product_demo_data()


def admin_token(client):
    response = client.post(
        reverse("admin-login"),
        {"email": "buyer@example.com", "password": "password123"},
        format="json",
    )
    return response.json()["data"]["access_token"]


def auth_headers(client):
    return {"HTTP_AUTHORIZATION": f"Bearer {admin_token(client)}"}


def test_create_product_attribute(api_client, seeded_products):
    category = ProductCategory.objects.first()

    response = api_client.post(
        reverse("admin-product-attribute-list"),
        {
            "category_id": category.id,
            "name": "材质",
            "attr_type": AttributeType.TEXT,
            "is_filterable": True,
            "sort_order": 5,
        },
        format="json",
        **auth_headers(api_client),
    )

    assert response.status_code == 201
    data = response.json()["data"]
    assert data["name"] == "材质"
    assert data["category"] == category.id
    assert data["is_filterable"] is True


def test_list_product_attributes(api_client, seeded_products):
    ProductAttribute.objects.create(name="颜色", attr_type=AttributeType.ENUM, sort_order=2)
    ProductAttribute.objects.create(name="重量", attr_type=AttributeType.NUMBER, sort_order=1)

    response = api_client.get(reverse("admin-product-attribute-list"), **auth_headers(api_client))

    assert response.status_code == 200
    names = [item["name"] for item in response.json()["data"]["items"]]
    assert names[:2] == ["重量", "颜色"]


def test_create_attribute_value_for_product(api_client, seeded_products):
    product = Product.objects.first()
    attribute = ProductAttribute.objects.create(name="颜色", attr_type=AttributeType.TEXT)

    response = api_client.post(
        reverse("admin-product-attrvalue-list", kwargs={"product_id": product.id}),
        {"attribute_id": attribute.id, "value": "蓝色", "sort_order": 3},
        format="json",
        **auth_headers(api_client),
    )

    assert response.status_code == 201
    data = response.json()["data"]
    assert data["product"] == product.id
    assert data["attribute"] == attribute.id
    assert data["value"] == "蓝色"
    assert ProductAttributeValue.objects.filter(product=product, attribute=attribute).exists()


def test_list_attribute_values(api_client, seeded_products):
    product = Product.objects.first()
    color = ProductAttribute.objects.create(name="颜色", attr_type=AttributeType.TEXT)
    size = ProductAttribute.objects.create(name="尺寸", attr_type=AttributeType.TEXT)
    ProductAttributeValue.objects.create(product=product, attribute=color, value="蓝色", sort_order=2)
    ProductAttributeValue.objects.create(product=product, attribute=size, value="中号", sort_order=1)

    response = api_client.get(
        reverse("admin-product-attrvalue-list", kwargs={"product_id": product.id}),
        **auth_headers(api_client),
    )

    assert response.status_code == 200
    items = response.json()["data"]["items"]
    assert [item["attribute_name"] for item in items] == ["尺寸", "颜色"]


def test_delete_product_attribute(api_client, seeded_products):
    attribute = ProductAttribute.objects.create(name="待删除属性", attr_type=AttributeType.TEXT)

    response = api_client.delete(
        reverse("admin-product-attribute-detail", kwargs={"attr_id": attribute.id}),
        **auth_headers(api_client),
    )

    assert response.status_code == 200
    assert response.json()["data"]["detail"] == "已删除"
    assert not ProductAttribute.objects.filter(id=attribute.id).exists()


def test_filter_product_attributes_by_category(api_client, seeded_products):
    category = ProductCategory.objects.first()
    other_category = ProductCategory.objects.exclude(id=category.id).first()
    ProductAttribute.objects.create(category=category, name="分类属性", attr_type=AttributeType.TEXT)
    ProductAttribute.objects.create(category=other_category, name="其他分类属性", attr_type=AttributeType.TEXT)
    ProductAttribute.objects.create(name="全局属性", attr_type=AttributeType.TEXT)

    response = api_client.get(
        reverse("admin-product-attribute-list"),
        {"category_id": category.id},
        **auth_headers(api_client),
    )

    assert response.status_code == 200
    names = {item["name"] for item in response.json()["data"]["items"]}
    assert names == {"分类属性", "全局属性"}
    assert "其他分类属性" not in names
