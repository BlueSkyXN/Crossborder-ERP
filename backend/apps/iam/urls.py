from django.urls import path

from .views import AdminLoginView, AdminMenusView, AdminMeView, AdminRolesView

urlpatterns = [
    path("admin/auth/login", AdminLoginView.as_view(), name="admin-login"),
    path("admin/me", AdminMeView.as_view(), name="admin-me"),
    path("admin/menus", AdminMenusView.as_view(), name="admin-menus"),
    path("admin/roles", AdminRolesView.as_view(), name="admin-roles"),
]
