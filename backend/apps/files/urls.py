from django.urls import path

from .views import (
    AdminFileDetailView,
    AdminFileDownloadView,
    AdminFileListCreateView,
    MemberFileDetailView,
    MemberFileDownloadView,
    MemberFileListCreateView,
)

urlpatterns = [
    path("files", MemberFileListCreateView.as_view(), name="file-list"),
    path("files/<str:file_id>", MemberFileDetailView.as_view(), name="file-detail"),
    path("files/<str:file_id>/download", MemberFileDownloadView.as_view(), name="file-download"),
    path("admin/files", AdminFileListCreateView.as_view(), name="admin-file-list"),
    path("admin/files/<str:file_id>", AdminFileDetailView.as_view(), name="admin-file-detail"),
    path("admin/files/<str:file_id>/download", AdminFileDownloadView.as_view(), name="admin-file-download"),
]
