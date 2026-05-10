from rest_framework import authentication, exceptions
from rest_framework_simplejwt.exceptions import TokenError
from rest_framework_simplejwt.tokens import AccessToken

from .models import AdminUser
from .services import ADMIN_TOKEN_SCOPE


class AdminTokenAuthentication(authentication.BaseAuthentication):
    keyword = "Bearer"

    def authenticate_header(self, request) -> str:
        return self.keyword

    def authenticate(self, request):
        header = authentication.get_authorization_header(request).decode("utf-8")
        if not header:
            return None

        parts = header.split()
        if len(parts) != 2 or parts[0] != self.keyword:
            raise exceptions.AuthenticationFailed("无效的认证头")

        try:
            token = AccessToken(parts[1])
        except TokenError as exc:
            raise exceptions.AuthenticationFailed("无效或过期的后台 token") from exc

        if token.get("token_scope") != ADMIN_TOKEN_SCOPE:
            raise exceptions.AuthenticationFailed("无效的后台 token")

        admin_user_id = token.get("admin_user_id")
        try:
            admin_user = AdminUser.objects.get(id=admin_user_id)
        except AdminUser.DoesNotExist as exc:
            raise exceptions.AuthenticationFailed("管理员不存在") from exc

        if not admin_user.is_active:
            raise exceptions.PermissionDenied("管理员已停用")

        pwd_ts = token.get("pwd_ts")
        if admin_user.password_changed_at:
            if not pwd_ts or int(admin_user.password_changed_at.timestamp()) != pwd_ts:
                raise exceptions.AuthenticationFailed("密码已变更，请重新登录")

        return (admin_user, token)
