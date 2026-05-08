from rest_framework import exceptions, permissions

from .services import admin_has_permission


class IsAdminAuthenticated(permissions.BasePermission):
    def has_permission(self, request, view) -> bool:
        if not request.user or not getattr(request.user, "is_authenticated", False):
            raise exceptions.NotAuthenticated("未登录")
        return bool(getattr(request.user, "is_active", False))


class HasAdminPermission(IsAdminAuthenticated):
    permission_code = ""

    def has_permission(self, request, view) -> bool:
        if not super().has_permission(request, view):
            return False

        required_permission = getattr(view, "required_permission", self.permission_code)
        if not required_permission:
            return True
        return admin_has_permission(request.user, required_permission)
