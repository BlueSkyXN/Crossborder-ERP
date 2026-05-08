from django.urls import path

from .views import (
    AdminWaybillListView,
    AdminWaybillReviewView,
    AdminWaybillSetFeeView,
    WaybillDetailView,
    WaybillListCreateView,
)

urlpatterns = [
    path("waybills", WaybillListCreateView.as_view(), name="waybill-list"),
    path("waybills/<int:waybill_id>", WaybillDetailView.as_view(), name="waybill-detail"),
    path("admin/waybills", AdminWaybillListView.as_view(), name="admin-waybill-list"),
    path("admin/waybills/<int:waybill_id>/review", AdminWaybillReviewView.as_view(), name="admin-waybill-review"),
    path("admin/waybills/<int:waybill_id>/set-fee", AdminWaybillSetFeeView.as_view(), name="admin-waybill-set-fee"),
]
