from django.shortcuts import get_object_or_404
from django.db.models import Prefetch
from drf_spectacular.utils import extend_schema
from rest_framework import status
from rest_framework.views import APIView

from apps.common.responses import success_response
from apps.iam.authentication import AdminTokenAuthentication
from apps.iam.permissions import HasAdminPermission
from apps.members.authentication import MemberTokenAuthentication
from apps.members.permissions import IsMemberAuthenticated

from .models import CartItem, CatalogStatus, Product, ProductCategory, ProductSku
from .serializers import (
    CartItemCreateSerializer,
    CartItemSerializer,
    CartItemUpdateSerializer,
    ProductCategoryInputSerializer,
    ProductCategorySerializer,
    ProductInputSerializer,
    ProductSerializer,
    ProductSkuInputSerializer,
    ProductSkuSerializer,
)
from .services import (
    add_cart_item,
    create_product,
    create_product_category,
    create_product_sku,
    delete_cart_item,
    disable_product,
    disable_product_category,
    disable_product_sku,
    get_admin_categories,
    get_admin_products,
    get_admin_skus,
    get_user_cart_items,
    update_cart_item,
    update_product,
    update_product_category,
    update_product_sku,
)


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


class AdminProductCategoryListCreateView(APIView):
    authentication_classes = [AdminTokenAuthentication]
    permission_classes = [HasAdminPermission]
    required_permission = "products.view"
    write_permission = "products.manage"

    @extend_schema(tags=["admin-products"], responses={200: ProductCategorySerializer(many=True)})
    def get(self, request):
        return success_response({"items": ProductCategorySerializer(get_admin_categories(), many=True).data})

    @extend_schema(tags=["admin-products"], request=ProductCategoryInputSerializer, responses={201: ProductCategorySerializer})
    def post(self, request):
        serializer = ProductCategoryInputSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        category = create_product_category(**serializer.validated_data)
        return success_response(ProductCategorySerializer(category).data, status=status.HTTP_201_CREATED)


class AdminProductCategoryDetailView(APIView):
    authentication_classes = [AdminTokenAuthentication]
    permission_classes = [HasAdminPermission]
    required_permission = "products.view"
    write_permission = "products.manage"

    @extend_schema(tags=["admin-products"], request=ProductCategoryInputSerializer, responses={200: ProductCategorySerializer})
    def patch(self, request, category_id: int):
        serializer = ProductCategoryInputSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        category = get_object_or_404(ProductCategory, id=category_id)
        updated = update_product_category(category=category, **serializer.validated_data)
        return success_response(ProductCategorySerializer(updated).data)

    @extend_schema(tags=["admin-products"], responses={200: ProductCategorySerializer})
    def delete(self, request, category_id: int):
        category = get_object_or_404(ProductCategory, id=category_id)
        disabled = disable_product_category(category=category)
        return success_response(ProductCategorySerializer(disabled).data)


class AdminProductListCreateView(APIView):
    authentication_classes = [AdminTokenAuthentication]
    permission_classes = [HasAdminPermission]
    required_permission = "products.view"
    write_permission = "products.manage"

    @extend_schema(tags=["admin-products"], responses={200: ProductSerializer(many=True)})
    def get(self, request):
        return success_response({"items": ProductSerializer(get_admin_products(), many=True).data})

    @extend_schema(tags=["admin-products"], request=ProductInputSerializer, responses={201: ProductSerializer})
    def post(self, request):
        serializer = ProductInputSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        product = create_product(**serializer.validated_data)
        return success_response(ProductSerializer(product).data, status=status.HTTP_201_CREATED)


class AdminProductDetailView(APIView):
    authentication_classes = [AdminTokenAuthentication]
    permission_classes = [HasAdminPermission]
    required_permission = "products.view"
    write_permission = "products.manage"

    @extend_schema(tags=["admin-products"], request=ProductInputSerializer, responses={200: ProductSerializer})
    def patch(self, request, product_id: int):
        serializer = ProductInputSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        product = get_object_or_404(Product, id=product_id)
        updated = update_product(product=product, **serializer.validated_data)
        return success_response(ProductSerializer(updated).data)

    @extend_schema(tags=["admin-products"], responses={200: ProductSerializer})
    def delete(self, request, product_id: int):
        product = get_object_or_404(Product, id=product_id)
        disabled = disable_product(product=product)
        return success_response(ProductSerializer(disabled).data)


class AdminProductSkuListCreateView(APIView):
    authentication_classes = [AdminTokenAuthentication]
    permission_classes = [HasAdminPermission]
    required_permission = "products.view"
    write_permission = "products.manage"

    @extend_schema(tags=["admin-products"], responses={200: ProductSkuSerializer(many=True)})
    def get(self, request):
        return success_response({"items": ProductSkuSerializer(get_admin_skus(), many=True).data})

    @extend_schema(tags=["admin-products"], request=ProductSkuInputSerializer, responses={201: ProductSkuSerializer})
    def post(self, request):
        serializer = ProductSkuInputSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        sku = create_product_sku(**serializer.validated_data)
        return success_response(ProductSkuSerializer(sku).data, status=status.HTTP_201_CREATED)


class AdminProductSkuDetailView(APIView):
    authentication_classes = [AdminTokenAuthentication]
    permission_classes = [HasAdminPermission]
    required_permission = "products.view"
    write_permission = "products.manage"

    @extend_schema(tags=["admin-products"], request=ProductSkuInputSerializer, responses={200: ProductSkuSerializer})
    def patch(self, request, sku_id: int):
        serializer = ProductSkuInputSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        sku = get_object_or_404(ProductSku, id=sku_id)
        updated = update_product_sku(sku=sku, **serializer.validated_data)
        return success_response(ProductSkuSerializer(updated).data)

    @extend_schema(tags=["admin-products"], responses={200: ProductSkuSerializer})
    def delete(self, request, sku_id: int):
        sku = get_object_or_404(ProductSku, id=sku_id)
        disabled = disable_product_sku(sku=sku)
        return success_response(ProductSkuSerializer(disabled).data)
