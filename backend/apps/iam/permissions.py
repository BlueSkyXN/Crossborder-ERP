from rest_framework import exceptions, permissions

from .services import admin_has_permission, has_any_permission


class IsAdminAuthenticated(permissions.BasePermission):
    def has_permission(self, request, view) -> bool:
        if not request.user or not getattr(request.user, "is_authenticated", False):
            raise exceptions.NotAuthenticated("未登录")
        return bool(getattr(request.user, "is_active", False))


class HasAdminPermission(IsAdminAuthenticated):
    permission_code = ""
    safe_methods = {"GET", "HEAD", "OPTIONS"}

    def has_permission(self, request, view) -> bool:
        if not super().has_permission(request, view):
            return False

        required_permission = getattr(view, "required_permission", self.permission_code)
        method_permissions = getattr(view, "method_permissions", {})
        if request.method in method_permissions:
            required_permission = method_permissions[request.method]
        elif request.method not in self.safe_methods:
            required_permission = getattr(view, "write_permission", None) or required_permission
        if not required_permission:
            return True
        if isinstance(required_permission, str):
            return admin_has_permission(request.user, required_permission)
        return has_any_permission(request.user, required_permission)
