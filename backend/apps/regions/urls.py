from django.urls import path

from .views import (
    AdminRegionDetailView,
    AdminRegionListCreateView,
    PublicRegionListView,
    PublicRegionTreeView,
)

urlpatterns = [
    path("regions", PublicRegionListView.as_view(), name="region-list"),
    path("regions/tree", PublicRegionTreeView.as_view(), name="region-tree"),
    path("admin/regions", AdminRegionListCreateView.as_view(), name="admin-region-list"),
    path("admin/regions/<int:region_id>", AdminRegionDetailView.as_view(), name="admin-region-detail"),
]
