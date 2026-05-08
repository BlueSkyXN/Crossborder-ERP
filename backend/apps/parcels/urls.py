from django.urls import path

from .views import (
    AdminParcelInboundView,
    AdminParcelListView,
    AdminParcelScanInboundView,
    AdminUnclaimedParcelListCreateView,
    PackableParcelListView,
    ParcelDetailView,
    ParcelForecastView,
    ParcelListView,
)

urlpatterns = [
    path("parcels/forecast", ParcelForecastView.as_view(), name="parcel-forecast"),
    path("parcels", ParcelListView.as_view(), name="parcel-list"),
    path("parcels/packable", PackableParcelListView.as_view(), name="parcel-packable-list"),
    path("parcels/<int:parcel_id>", ParcelDetailView.as_view(), name="parcel-detail"),
    path("admin/parcels", AdminParcelListView.as_view(), name="admin-parcel-list"),
    path("admin/parcels/scan-inbound", AdminParcelScanInboundView.as_view(), name="admin-parcel-scan-inbound"),
    path("admin/parcels/<int:parcel_id>/inbound", AdminParcelInboundView.as_view(), name="admin-parcel-inbound"),
    path("admin/unclaimed-parcels", AdminUnclaimedParcelListCreateView.as_view(), name="admin-unclaimed-parcel-list"),
]
