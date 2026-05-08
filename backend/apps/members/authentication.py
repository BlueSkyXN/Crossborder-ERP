from rest_framework import authentication, exceptions
from rest_framework_simplejwt.exceptions import TokenError
from rest_framework_simplejwt.tokens import AccessToken

from .models import User
from .services import MEMBER_TOKEN_SCOPE


class MemberTokenAuthentication(authentication.BaseAuthentication):
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
            raise exceptions.AuthenticationFailed("无效或过期的用户 token") from exc

        if token.get("token_scope") != MEMBER_TOKEN_SCOPE:
            raise exceptions.AuthenticationFailed("无效的用户 token")

        user_id = token.get("user_id")
        try:
            user = User.objects.select_related("profile").get(id=user_id)
        except User.DoesNotExist as exc:
            raise exceptions.AuthenticationFailed("用户不存在") from exc

        if not user.is_active:
            raise exceptions.PermissionDenied("用户已冻结")

        return (user, token)
