from django.urls import path
from rest_framework.routers import SimpleRouter

from .views import (
    AdminPackagingMethodViewSet,
    AdminRatePlanViewSet,
    AdminShippingChannelViewSet,
    AdminValueAddedServiceViewSet,
    AdminWarehouseViewSet,
    WarehouseAddressView,
    WarehouseListView,
)

router = SimpleRouter(trailing_slash=False)
router.register("admin/warehouses", AdminWarehouseViewSet, basename="admin-warehouses")
router.register("admin/shipping-channels", AdminShippingChannelViewSet, basename="admin-shipping-channels")
router.register("admin/packaging-methods", AdminPackagingMethodViewSet, basename="admin-packaging-methods")
router.register("admin/value-added-services", AdminValueAddedServiceViewSet, basename="admin-value-added-services")
router.register("admin/rate-plans", AdminRatePlanViewSet, basename="admin-rate-plans")

urlpatterns = [
    path("warehouses", WarehouseListView.as_view(), name="warehouse-list"),
    path("warehouses/<int:warehouse_id>/address", WarehouseAddressView.as_view(), name="warehouse-address"),
]
urlpatterns += router.urls
