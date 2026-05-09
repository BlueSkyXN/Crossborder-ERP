import pytest
from django.urls import reverse
from rest_framework.test import APIClient

from apps.iam.services import seed_iam_demo_data
from apps.products.models import Product, ProductTranslation
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


def first_product():
    return Product.objects.order_by("id").first()


def translation_payload(language_code="en", title="Storage Box", description="English description"):
    return {
        "language_code": language_code,
        "title": title,
        "description_rich": description,
    }


def test_create_product_translation(api_client, seeded_products):
    product = first_product()

    response = api_client.post(
        reverse("admin-product-translation-list", kwargs={"product_id": product.id}),
        translation_payload(),
        format="json",
        **auth_headers(api_client),
    )

    assert response.status_code == 201
    data = response.json()["data"]
    assert data["product"] == product.id
    assert data["language_code"] == "en"
    assert ProductTranslation.objects.filter(product=product, language_code="en").exists()


def test_list_product_translations(api_client, seeded_products):
    product = first_product()
    ProductTranslation.objects.create(product=product, language_code="en", title="Storage Box")
    ProductTranslation.objects.create(product=product, language_code="ja", title="収納箱")

    response = api_client.get(
        reverse("admin-product-translation-list", kwargs={"product_id": product.id}),
        **auth_headers(api_client),
    )

    assert response.status_code == 200
    items = response.json()["data"]["items"]
    assert [item["language_code"] for item in items] == ["en", "ja"]


def test_update_product_translation(api_client, seeded_products):
    product = first_product()
    translation = ProductTranslation.objects.create(product=product, language_code="en", title="Old title")

    response = api_client.put(
        reverse(
            "admin-product-translation-detail",
            kwargs={"product_id": product.id, "translation_id": translation.id},
        ),
        translation_payload(title="Updated title", description="Updated description"),
        format="json",
        **auth_headers(api_client),
    )

    assert response.status_code == 200
    data = response.json()["data"]
    assert data["title"] == "Updated title"
    translation.refresh_from_db()
    assert translation.description_rich == "Updated description"


def test_delete_product_translation(api_client, seeded_products):
    product = first_product()
    translation = ProductTranslation.objects.create(product=product, language_code="en", title="Storage Box")

    response = api_client.delete(
        reverse(
            "admin-product-translation-detail",
            kwargs={"product_id": product.id, "translation_id": translation.id},
        ),
        **auth_headers(api_client),
    )

    assert response.status_code == 200
    assert response.json()["data"]["detail"] == "已删除"
    assert not ProductTranslation.objects.filter(id=translation.id).exists()


def test_duplicate_language_code_for_same_product_fails(api_client, seeded_products):
    product = first_product()
    ProductTranslation.objects.create(product=product, language_code="en", title="Storage Box")

    response = api_client.post(
        reverse("admin-product-translation-list", kwargs={"product_id": product.id}),
        translation_payload(title="Duplicate"),
        format="json",
        **auth_headers(api_client),
    )

    assert response.status_code == 400
    assert response.json()["code"] == "VALIDATION_ERROR"
    assert ProductTranslation.objects.filter(product=product, language_code="en").count() == 1


def test_product_translation_requires_authentication(api_client, seeded_products):
    product = first_product()

    response = api_client.get(reverse("admin-product-translation-list", kwargs={"product_id": product.id}))

    assert response.status_code == 401
    assert response.json()["code"] == "UNAUTHORIZED"
