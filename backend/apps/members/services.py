from dataclasses import dataclass

from django.contrib.auth.hashers import check_password, make_password
from django.db import IntegrityError, transaction
from django.utils import timezone
from rest_framework import exceptions
from rest_framework_simplejwt.tokens import AccessToken

from .models import MemberProfile, User, UserStatus


MEMBER_TOKEN_SCOPE = "member"


@dataclass(frozen=True)
class MemberLoginResult:
    user: User
    access_token: str


def issue_member_access_token(user: User) -> str:
    token = AccessToken()
    token["token_scope"] = MEMBER_TOKEN_SCOPE
    token["user_id"] = user.id
    token["email"] = user.email
    return str(token)


def build_member_no(user_id: int) -> str:
    return f"M{user_id:06d}"


def build_warehouse_code(user_id: int) -> str:
    return f"CB{user_id:06d}"


@transaction.atomic
def register_user(email: str, password: str, display_name: str = "", phone: str = "") -> User:
    try:
        user = User.objects.create(
            email=email,
            phone=phone,
            password_hash=make_password(password),
            status=UserStatus.ACTIVE,
        )
    except IntegrityError as exc:
        raise exceptions.ValidationError({"email": ["邮箱已存在"]}) from exc

    MemberProfile.objects.create(
        user=user,
        member_no=build_member_no(user.id),
        display_name=display_name,
        warehouse_code=build_warehouse_code(user.id),
    )
    return user


def login_user(email: str, password: str) -> MemberLoginResult:
    try:
        user = User.objects.select_related("profile").get(email=email)
    except User.DoesNotExist as exc:
        raise exceptions.AuthenticationFailed("邮箱或密码错误") from exc

    if not user.is_active:
        raise exceptions.PermissionDenied("用户已冻结")

    if not check_password(password, user.password_hash):
        raise exceptions.AuthenticationFailed("邮箱或密码错误")

    User.objects.filter(id=user.id).update(last_login_at=timezone.now())
    user.refresh_from_db()
    return MemberLoginResult(user=user, access_token=issue_member_access_token(user))


def update_member_profile(user: User, *, display_name: str = "", phone: str = "") -> User:
    if display_name != "":
        user.profile.display_name = display_name
        user.profile.save(update_fields=["display_name", "updated_at"])
    if phone != "":
        user.phone = phone
        user.save(update_fields=["phone", "updated_at"])
    user.refresh_from_db()
    return user


def seed_member_demo_data(password: str = "password123") -> None:
    user, created = User.objects.get_or_create(
        email="user@example.com",
        defaults={
            "password_hash": make_password(password),
            "status": UserStatus.ACTIVE,
        },
    )
    if created:
        MemberProfile.objects.create(
            user=user,
            member_no=build_member_no(user.id),
            display_name="测试用户",
            warehouse_code=build_warehouse_code(user.id),
        )
    elif not hasattr(user, "profile"):
        MemberProfile.objects.create(
            user=user,
            member_no=build_member_no(user.id),
            display_name="测试用户",
            warehouse_code=build_warehouse_code(user.id),
        )
