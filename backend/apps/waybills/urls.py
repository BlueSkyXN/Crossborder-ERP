from django.urls import path

from .views import (
    AdminShippingBatchDetailView,
    AdminShippingBatchListCreateView,
    AdminShippingBatchLockView,
    AdminShippingBatchPrintPreviewView,
    AdminShippingBatchShipView,
    AdminShippingBatchTrackingEventCreateView,
    AdminShippingBatchWaybillDetailView,
    AdminShippingBatchWaybillListView,
    AdminWaybillListView,
    AdminWaybillReviewView,
    AdminWaybillSetFeeView,
    AdminWaybillShipView,
    AdminWaybillTrackingEventCreateView,
    WaybillConfirmReceiptView,
    WaybillDetailView,
    WaybillListCreateView,
    WaybillTrackingEventListView,
    WaybillTrackingQueryView,
)

urlpatterns = [
    path("waybills", WaybillListCreateView.as_view(), name="waybill-list"),
    path("waybills/tracking", WaybillTrackingQueryView.as_view(), name="waybill-tracking-query"),
    path("waybills/<int:waybill_id>", WaybillDetailView.as_view(), name="waybill-detail"),
    path(
        "waybills/<int:waybill_id>/tracking-events",
        WaybillTrackingEventListView.as_view(),
        name="waybill-tracking-event-list",
    ),
    path(
        "waybills/<int:waybill_id>/confirm-receipt",
        WaybillConfirmReceiptView.as_view(),
        name="waybill-confirm-receipt",
    ),
    path("admin/waybills", AdminWaybillListView.as_view(), name="admin-waybill-list"),
    path("admin/waybills/<int:waybill_id>/review", AdminWaybillReviewView.as_view(), name="admin-waybill-review"),
    path("admin/waybills/<int:waybill_id>/set-fee", AdminWaybillSetFeeView.as_view(), name="admin-waybill-set-fee"),
    path("admin/waybills/<int:waybill_id>/ship", AdminWaybillShipView.as_view(), name="admin-waybill-ship"),
    path(
        "admin/waybills/<int:waybill_id>/tracking-events",
        AdminWaybillTrackingEventCreateView.as_view(),
        name="admin-waybill-tracking-event-create",
    ),
    path("admin/shipping-batches", AdminShippingBatchListCreateView.as_view(), name="admin-shipping-batch-list"),
    path("admin/shipping-batches/<int:batch_id>", AdminShippingBatchDetailView.as_view(), name="admin-shipping-batch-detail"),
    path(
        "admin/shipping-batches/<int:batch_id>/waybills",
        AdminShippingBatchWaybillListView.as_view(),
        name="admin-shipping-batch-waybill-list",
    ),
    path(
        "admin/shipping-batches/<int:batch_id>/waybills/<int:waybill_id>",
        AdminShippingBatchWaybillDetailView.as_view(),
        name="admin-shipping-batch-waybill-detail",
    ),
    path(
        "admin/shipping-batches/<int:batch_id>/lock",
        AdminShippingBatchLockView.as_view(),
        name="admin-shipping-batch-lock",
    ),
    path(
        "admin/shipping-batches/<int:batch_id>/ship",
        AdminShippingBatchShipView.as_view(),
        name="admin-shipping-batch-ship",
    ),
    path(
        "admin/shipping-batches/<int:batch_id>/tracking-events",
        AdminShippingBatchTrackingEventCreateView.as_view(),
        name="admin-shipping-batch-tracking-event-create",
    ),
    path(
        "admin/shipping-batches/<int:batch_id>/print-preview",
        AdminShippingBatchPrintPreviewView.as_view(),
        name="admin-shipping-batch-print-preview",
    ),
    path(
        "admin/shipping-batches/<int:batch_id>/print-data",
        AdminShippingBatchPrintPreviewView.as_view(),
        name="admin-shipping-batch-print-data",
    ),
]
