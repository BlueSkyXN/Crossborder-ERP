from django.urls import path

from .views import AdminAuditLogExportView, AdminAuditLogListView

urlpatterns = [
    path("admin/audit-logs", AdminAuditLogListView.as_view(), name="admin-audit-log-list"),
    path("admin/audit-logs/export.csv", AdminAuditLogExportView.as_view(), name="admin-audit-log-export"),
]
