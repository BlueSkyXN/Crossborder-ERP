from django.urls import path

from .views import (
    AdminContentCategoryDetailView,
    AdminContentCategoryListCreateView,
    AdminContentPageDetailView,
    AdminContentPageHideView,
    AdminContentPageListCreateView,
    AdminContentPagePublishView,
    ContentCategoryListView,
    ContentPageDetailView,
    ContentPageListView,
)

urlpatterns = [
    path("content/categories", ContentCategoryListView.as_view(), name="content-category-list"),
    path("content/pages", ContentPageListView.as_view(), name="content-page-list"),
    path("content/pages/<slug:slug>", ContentPageDetailView.as_view(), name="content-page-detail"),
    path("admin/content/categories", AdminContentCategoryListCreateView.as_view(), name="admin-content-category-list"),
    path(
        "admin/content/categories/<int:category_id>",
        AdminContentCategoryDetailView.as_view(),
        name="admin-content-category-detail",
    ),
    path("admin/content/pages", AdminContentPageListCreateView.as_view(), name="admin-content-page-list"),
    path("admin/content/pages/<int:page_id>", AdminContentPageDetailView.as_view(), name="admin-content-page-detail"),
    path(
        "admin/content/pages/<int:page_id>/publish",
        AdminContentPagePublishView.as_view(),
        name="admin-content-page-publish",
    ),
    path("admin/content/pages/<int:page_id>/hide", AdminContentPageHideView.as_view(), name="admin-content-page-hide"),
]
