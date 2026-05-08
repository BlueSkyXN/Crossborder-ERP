from django.urls import path

from .views import (
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
]
