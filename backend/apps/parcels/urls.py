from django.urls import path

from .views import (
    AdminParcelInboundView,
    AdminParcelListView,
    AdminParcelScanInboundView,
    AdminUnclaimedParcelApproveView,
    AdminUnclaimedParcelListCreateView,
    AdminUnclaimedParcelRejectView,
    PackableParcelListView,
    ParcelDetailView,
    ParcelForecastView,
    ParcelListView,
    UnclaimedParcelClaimView,
    UnclaimedParcelListView,
)

urlpatterns = [
    path("parcels/forecast", ParcelForecastView.as_view(), name="parcel-forecast"),
    path("parcels", ParcelListView.as_view(), name="parcel-list"),
    path("parcels/packable", PackableParcelListView.as_view(), name="parcel-packable-list"),
    path("parcels/<int:parcel_id>", ParcelDetailView.as_view(), name="parcel-detail"),
    path("unclaimed-parcels", UnclaimedParcelListView.as_view(), name="unclaimed-parcel-list"),
    path("unclaimed-parcels/<int:unclaimed_id>/claim", UnclaimedParcelClaimView.as_view(), name="unclaimed-parcel-claim"),
    path("admin/parcels", AdminParcelListView.as_view(), name="admin-parcel-list"),
    path("admin/parcels/scan-inbound", AdminParcelScanInboundView.as_view(), name="admin-parcel-scan-inbound"),
    path("admin/parcels/<int:parcel_id>/inbound", AdminParcelInboundView.as_view(), name="admin-parcel-inbound"),
    path("admin/unclaimed-parcels", AdminUnclaimedParcelListCreateView.as_view(), name="admin-unclaimed-parcel-list"),
    path(
        "admin/unclaimed-parcels/<int:unclaimed_id>/approve",
        AdminUnclaimedParcelApproveView.as_view(),
        name="admin-unclaimed-parcel-approve",
    ),
    path(
        "admin/unclaimed-parcels/<int:unclaimed_id>/reject",
        AdminUnclaimedParcelRejectView.as_view(),
        name="admin-unclaimed-parcel-reject",
    ),
]
