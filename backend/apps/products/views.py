from django.shortcuts import get_object_or_404
from django.db.models import Prefetch
from drf_spectacular.utils import extend_schema
from rest_framework import status
from rest_framework.views import APIView

from apps.common.responses import success_response
from apps.members.authentication import MemberTokenAuthentication
from apps.members.permissions import IsMemberAuthenticated

from .models import CartItem, CatalogStatus, Product, ProductSku
from .serializers import CartItemCreateSerializer, CartItemSerializer, CartItemUpdateSerializer, ProductSerializer
from .services import add_cart_item, delete_cart_item, get_user_cart_items, update_cart_item


class ProductListView(APIView):
    @extend_schema(tags=["products"], responses={200: ProductSerializer(many=True)})
    def get(self, request):
        products = (
            Product.objects.filter(status=CatalogStatus.ACTIVE)
            .select_related("category")
            .prefetch_related(Prefetch("skus", queryset=ProductSku.objects.filter(status=CatalogStatus.ACTIVE)))
        )
        return success_response({"items": ProductSerializer(products, many=True).data})


class ProductDetailView(APIView):
    @extend_schema(tags=["products"], responses={200: ProductSerializer})
    def get(self, request, product_id: int):
        product = get_object_or_404(
            Product.objects.filter(status=CatalogStatus.ACTIVE)
            .select_related("category")
            .prefetch_related(Prefetch("skus", queryset=ProductSku.objects.filter(status=CatalogStatus.ACTIVE))),
            id=product_id,
        )
        return success_response(ProductSerializer(product).data)


class CartItemListCreateView(APIView):
    authentication_classes = [MemberTokenAuthentication]
    permission_classes = [IsMemberAuthenticated]

    @extend_schema(tags=["cart"], responses={200: CartItemSerializer(many=True)})
    def get(self, request):
        return success_response({"items": CartItemSerializer(get_user_cart_items(request.user), many=True).data})

    @extend_schema(tags=["cart"], request=CartItemCreateSerializer, responses={201: CartItemSerializer})
    def post(self, request):
        serializer = CartItemCreateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        cart_item = add_cart_item(user=request.user, **serializer.validated_data)
        return success_response(CartItemSerializer(cart_item).data, status=status.HTTP_201_CREATED)


class CartItemDetailView(APIView):
    authentication_classes = [MemberTokenAuthentication]
    permission_classes = [IsMemberAuthenticated]

    @extend_schema(tags=["cart"], request=CartItemUpdateSerializer, responses={200: CartItemSerializer})
    def patch(self, request, cart_item_id: int):
        serializer = CartItemUpdateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        cart_item = get_object_or_404(CartItem.objects.select_related("product", "sku"), id=cart_item_id, user=request.user)
        updated = update_cart_item(cart_item=cart_item, **serializer.validated_data)
        return success_response(CartItemSerializer(updated).data)

    @extend_schema(tags=["cart"], responses={200: dict})
    def delete(self, request, cart_item_id: int):
        cart_item = get_object_or_404(CartItem, id=cart_item_id, user=request.user)
        delete_cart_item(cart_item=cart_item)
        return success_response({"deleted": True})
