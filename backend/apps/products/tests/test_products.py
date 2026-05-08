import pytest
from django.urls import reverse

from apps.iam.services import seed_iam_demo_data
from apps.members.services import register_user, seed_member_demo_data
from apps.products.models import CartItem, CatalogStatus, Product, ProductSku
from apps.products.services import seed_product_demo_data


@pytest.fixture
def seeded_products(db):
    seed_iam_demo_data()
    seed_member_demo_data()
    seed_product_demo_data()


def member_token(client, email="user@example.com", password="password123"):
    response = client.post(
        reverse("member-login"),
        {"email": email, "password": password},
        content_type="application/json",
    )
    return response.json()["data"]["access_token"]


def admin_token(client, email="buyer@example.com"):
    response = client.post(
        reverse("admin-login"),
        {"email": email, "password": "password123"},
        content_type="application/json",
    )
    return response.json()["data"]["access_token"]


def first_sku():
    return ProductSku.objects.select_related("product").filter(status=CatalogStatus.ACTIVE).first()


def test_product_list_and_detail_only_show_active_catalog(client, seeded_products):
    disabled = Product.objects.create(title="停用测试商品", status=CatalogStatus.DISABLED)
    ProductSku.objects.create(
        product=disabled,
        sku_code="DISABLED-SKU",
        price="9.90",
        stock=10,
        status=CatalogStatus.ACTIVE,
    )
    active_product = Product.objects.filter(status=CatalogStatus.ACTIVE).first()

    list_response = client.get(reverse("product-list"))
    assert list_response.status_code == 200
    titles = [item["title"] for item in list_response.json()["data"]["items"]]
    assert active_product.title in titles
    assert "停用测试商品" not in titles

    detail_response = client.get(reverse("product-detail", kwargs={"product_id": active_product.id}))
    assert detail_response.status_code == 200
    detail = detail_response.json()["data"]
    assert detail["id"] == active_product.id
    assert detail["skus"]

    disabled_response = client.get(reverse("product-detail", kwargs={"product_id": disabled.id}))
    assert disabled_response.status_code == 404


def test_cart_add_list_update_delete_and_merge_quantity(client, seeded_products):
    sku = first_sku()
    token = member_token(client)

    first = client.post(
        reverse("cart-item-list"),
        {"sku_id": sku.id, "quantity": 2},
        content_type="application/json",
        HTTP_AUTHORIZATION=f"Bearer {token}",
    )
    assert first.status_code == 201
    cart_item_id = first.json()["data"]["id"]
    assert first.json()["data"]["quantity"] == 2

    second = client.post(
        reverse("cart-item-list"),
        {"sku_id": sku.id, "quantity": 1},
        content_type="application/json",
        HTTP_AUTHORIZATION=f"Bearer {token}",
    )
    assert second.status_code == 201
    assert second.json()["data"]["id"] == cart_item_id
    assert second.json()["data"]["quantity"] == 3

    list_response = client.get(reverse("cart-item-list"), HTTP_AUTHORIZATION=f"Bearer {token}")
    assert list_response.status_code == 200
    assert len(list_response.json()["data"]["items"]) == 1

    update_response = client.patch(
        reverse("cart-item-detail", kwargs={"cart_item_id": cart_item_id}),
        {"quantity": 4},
        content_type="application/json",
        HTTP_AUTHORIZATION=f"Bearer {token}",
    )
    assert update_response.status_code == 200
    assert update_response.json()["data"]["quantity"] == 4

    delete_response = client.delete(
        reverse("cart-item-detail", kwargs={"cart_item_id": cart_item_id}),
        HTTP_AUTHORIZATION=f"Bearer {token}",
    )
    assert delete_response.status_code == 200
    assert delete_response.json()["data"]["deleted"] is True
    assert CartItem.objects.count() == 0


def test_cart_item_is_user_isolated(client, seeded_products):
    owner = register_user("cart-owner@example.com", "password123")
    sku = first_sku()
    cart_item = CartItem.objects.create(user=owner, product=sku.product, sku=sku, quantity=1)
    token = member_token(client)

    list_response = client.get(reverse("cart-item-list"), HTTP_AUTHORIZATION=f"Bearer {token}")
    assert list_response.status_code == 200
    assert list_response.json()["data"]["items"] == []

    patch_response = client.patch(
        reverse("cart-item-detail", kwargs={"cart_item_id": cart_item.id}),
        {"quantity": 2},
        content_type="application/json",
        HTTP_AUTHORIZATION=f"Bearer {token}",
    )
    assert patch_response.status_code == 404


def test_admin_product_catalog_crud_and_permission(client, seeded_products):
    token = admin_token(client)

    category_response = client.post(
        reverse("admin-product-category-list"),
        {"name": "后台测试分类", "sort_order": 30, "status": CatalogStatus.ACTIVE},
        content_type="application/json",
        HTTP_AUTHORIZATION=f"Bearer {token}",
    )
    assert category_response.status_code == 201
    category_id = category_response.json()["data"]["id"]

    product_response = client.post(
        reverse("admin-product-list"),
        {
            "category_id": category_id,
            "title": "后台测试商品",
            "description": "FEA-005 管理端测试",
            "status": CatalogStatus.ACTIVE,
        },
        content_type="application/json",
        HTTP_AUTHORIZATION=f"Bearer {token}",
    )
    assert product_response.status_code == 201
    product_id = product_response.json()["data"]["id"]

    sku_response = client.post(
        reverse("admin-product-sku-list"),
        {
            "product_id": product_id,
            "sku_code": "FEA005-SKU-001",
            "spec_json": {"颜色": "黑色"},
            "price": "88.80",
            "stock": 12,
            "status": CatalogStatus.ACTIVE,
        },
        content_type="application/json",
        HTTP_AUTHORIZATION=f"Bearer {token}",
    )
    assert sku_response.status_code == 201
    sku_id = sku_response.json()["data"]["id"]

    update_response = client.patch(
        reverse("admin-product-sku-detail", kwargs={"sku_id": sku_id}),
        {
            "product_id": product_id,
            "sku_code": "FEA005-SKU-001",
            "spec_json": {"颜色": "黑色", "版本": "升级"},
            "price": "98.80",
            "stock": 20,
            "status": CatalogStatus.ACTIVE,
        },
        content_type="application/json",
        HTTP_AUTHORIZATION=f"Bearer {token}",
    )
    assert update_response.status_code == 200
    assert update_response.json()["data"]["price"] == "98.80"

    delete_response = client.delete(
        reverse("admin-product-detail", kwargs={"product_id": product_id}),
        HTTP_AUTHORIZATION=f"Bearer {token}",
    )
    assert delete_response.status_code == 200
    assert delete_response.json()["data"]["status"] == CatalogStatus.DISABLED
    assert ProductSku.objects.get(id=sku_id).status == CatalogStatus.DISABLED

    denied = client.get(
        reverse("admin-product-list"),
        HTTP_AUTHORIZATION=f"Bearer {admin_token(client, email='finance@example.com')}",
    )
    assert denied.status_code == 403
    assert denied.json()["code"] == "FORBIDDEN"
