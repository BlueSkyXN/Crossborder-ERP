from django.urls import path

from .views import (
    AdminDashboardView,
    AdminLoginView,
    AdminMenusView,
    AdminMeView,
    AdminPermissionsView,
    AdminRoleDetailView,
    AdminRolesView,
)

urlpatterns = [
    path("admin/auth/login", AdminLoginView.as_view(), name="admin-login"),
    path("admin/me", AdminMeView.as_view(), name="admin-me"),
    path("admin/menus", AdminMenusView.as_view(), name="admin-menus"),
    path("admin/dashboard", AdminDashboardView.as_view(), name="admin-dashboard"),
    path("admin/permissions", AdminPermissionsView.as_view(), name="admin-permissions"),
    path("admin/roles", AdminRolesView.as_view(), name="admin-roles"),
    path("admin/roles/<int:role_id>", AdminRoleDetailView.as_view(), name="admin-role-detail"),
]
