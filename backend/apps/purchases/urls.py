from django.urls import path

from .views import (
    AdminPurchaseOrderConvertToParcelView,
    AdminPurchaseOrderCancelView,
    AdminPurchaseOrderDetailView,
    AdminPurchaseOrderMarkExceptionView,
    AdminPurchaseOrderListView,
    AdminPurchaseOrderMarkArrivedView,
    AdminPurchaseOrderProcureView,
    AdminPurchaseOrderReviewView,
    AdminPurchaseWarehouseOptionListView,
    ManualPurchaseOrderCreateView,
    PurchaseLinkParseView,
    PurchaseOrderDetailView,
    PurchaseOrderListCreateView,
    PurchaseOrderPayView,
)

urlpatterns = [
    path("purchase-links/parse", PurchaseLinkParseView.as_view(), name="purchase-link-parse"),
    path("purchase-orders", PurchaseOrderListCreateView.as_view(), name="purchase-order-list"),
    path("purchase-orders/manual", ManualPurchaseOrderCreateView.as_view(), name="purchase-order-manual"),
    path("purchase-orders/<int:purchase_order_id>", PurchaseOrderDetailView.as_view(), name="purchase-order-detail"),
    path("purchase-orders/<int:purchase_order_id>/pay", PurchaseOrderPayView.as_view(), name="purchase-order-pay"),
    path("admin/purchase-orders", AdminPurchaseOrderListView.as_view(), name="admin-purchase-order-list"),
    path(
        "admin/purchase-warehouses",
        AdminPurchaseWarehouseOptionListView.as_view(),
        name="admin-purchase-warehouse-options",
    ),
    path(
        "admin/purchase-orders/<int:purchase_order_id>",
        AdminPurchaseOrderDetailView.as_view(),
        name="admin-purchase-order-detail",
    ),
    path(
        "admin/purchase-orders/<int:purchase_order_id>/review",
        AdminPurchaseOrderReviewView.as_view(),
        name="admin-purchase-order-review",
    ),
    path(
        "admin/purchase-orders/<int:purchase_order_id>/procure",
        AdminPurchaseOrderProcureView.as_view(),
        name="admin-purchase-order-procure",
    ),
    path(
        "admin/purchase-orders/<int:purchase_order_id>/mark-arrived",
        AdminPurchaseOrderMarkArrivedView.as_view(),
        name="admin-purchase-order-mark-arrived",
    ),
    path(
        "admin/purchase-orders/<int:purchase_order_id>/convert-to-parcel",
        AdminPurchaseOrderConvertToParcelView.as_view(),
        name="admin-purchase-order-convert-to-parcel",
    ),
    path(
        "admin/purchase-orders/<int:purchase_order_id>/mark-exception",
        AdminPurchaseOrderMarkExceptionView.as_view(),
        name="admin-purchase-order-mark-exception",
    ),
    path(
        "admin/purchase-orders/<int:purchase_order_id>/cancel",
        AdminPurchaseOrderCancelView.as_view(),
        name="admin-purchase-order-cancel",
    ),
]
