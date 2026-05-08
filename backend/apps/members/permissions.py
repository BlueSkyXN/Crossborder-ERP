from rest_framework import exceptions, permissions


class IsMemberAuthenticated(permissions.BasePermission):
    def has_permission(self, request, view) -> bool:
        if not request.user or not getattr(request.user, "is_authenticated", False):
            raise exceptions.NotAuthenticated("未登录")
        return bool(getattr(request.user, "is_active", False))
