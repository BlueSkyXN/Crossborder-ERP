from django.urls import path

from .views import CartItemDetailView, CartItemListCreateView, ProductDetailView, ProductListView

urlpatterns = [
    path("products", ProductListView.as_view(), name="product-list"),
    path("products/<int:product_id>", ProductDetailView.as_view(), name="product-detail"),
    path("cart-items", CartItemListCreateView.as_view(), name="cart-item-list"),
    path("cart-items/<int:cart_item_id>", CartItemDetailView.as_view(), name="cart-item-detail"),
]
