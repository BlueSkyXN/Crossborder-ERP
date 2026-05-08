from django.urls import path

from .views import (
    AdminProductCategoryDetailView,
    AdminProductCategoryListCreateView,
    AdminProductDetailView,
    AdminProductListCreateView,
    AdminProductSkuDetailView,
    AdminProductSkuListCreateView,
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
]
