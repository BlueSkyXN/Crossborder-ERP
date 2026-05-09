from django.urls import path

from .views import (
    AdminAccountDetailView,
    AdminAccountsView,
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
    path("admin/admin-users", AdminAccountsView.as_view(), name="admin-accounts"),
    path("admin/admin-users/<int:admin_id>", AdminAccountDetailView.as_view(), name="admin-account-detail"),
]
