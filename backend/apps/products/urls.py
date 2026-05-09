from django.urls import path

from .views import (
    AdminProductAttributeDetailView,
    AdminProductAttributeListCreateView,
    AdminProductAttrValueDetailView,
    AdminProductAttrValueListCreateView,
    AdminProductCategoryDetailView,
    AdminProductCategoryListCreateView,
    AdminProductDetailView,
    AdminProductListCreateView,
    AdminProductSkuDetailView,
    AdminProductSkuListCreateView,
    AdminProductTranslationDetailView,
    AdminProductTranslationListCreateView,
    CartItemDetailView,
    CartItemListCreateView,
    ProductDetailView,
    ProductListView,
)

urlpatterns = [
    path("products", ProductListView.as_view(), name="product-list"),
    path("products/<int:product_id>", ProductDetailView.as_view(), name="product-detail"),
    path("cart-items", CartItemListCreateView.as_view(), name="cart-item-list"),
    path("cart-items/<int:cart_item_id>", CartItemDetailView.as_view(), name="cart-item-detail"),
    path("admin/product-categories", AdminProductCategoryListCreateView.as_view(), name="admin-product-category-list"),
    path(
        "admin/product-categories/<int:category_id>",
        AdminProductCategoryDetailView.as_view(),
        name="admin-product-category-detail",
    ),
    path("admin/products", AdminProductListCreateView.as_view(), name="admin-product-list"),
    path("admin/products/<int:product_id>", AdminProductDetailView.as_view(), name="admin-product-detail"),
    path("admin/product-skus", AdminProductSkuListCreateView.as_view(), name="admin-product-sku-list"),
    path("admin/product-skus/<int:sku_id>", AdminProductSkuDetailView.as_view(), name="admin-product-sku-detail"),
    # Translations
    path("admin/products/<int:product_id>/translations", AdminProductTranslationListCreateView.as_view(), name="admin-product-translation-list"),
    path("admin/products/<int:product_id>/translations/<int:translation_id>", AdminProductTranslationDetailView.as_view(), name="admin-product-translation-detail"),
    # Attributes
    path("admin/product-attributes", AdminProductAttributeListCreateView.as_view(), name="admin-product-attribute-list"),
    path("admin/product-attributes/<int:attr_id>", AdminProductAttributeDetailView.as_view(), name="admin-product-attribute-detail"),
    # Attribute Values
    path("admin/products/<int:product_id>/attribute-values", AdminProductAttrValueListCreateView.as_view(), name="admin-product-attrvalue-list"),
    path("admin/products/<int:product_id>/attribute-values/<int:value_id>", AdminProductAttrValueDetailView.as_view(), name="admin-product-attrvalue-detail"),
]
