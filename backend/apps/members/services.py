from dataclasses import dataclass

from django.contrib.auth.hashers import check_password, make_password
from django.db import IntegrityError, transaction
from django.db.models import Count, Max, Q, QuerySet
from django.utils import timezone
from rest_framework import exceptions
from rest_framework_simplejwt.tokens import AccessToken

from apps.iam.models import AdminUser, AdminUserStatus
from apps.tickets.models import TicketStatus

from .models import MemberProfile, User, UserStatus


MEMBER_TOKEN_SCOPE = "member"
DEFAULT_TEST_MEMBER_PASSWORD = "password123"


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


def admin_member_queryset() -> QuerySet[User]:
    return (
        User.objects.select_related("profile", "profile__assigned_service_admin")
        .annotate(
            ticket_count=Count("tickets", distinct=True),
            open_ticket_count=Count(
                "tickets",
                filter=Q(tickets__status__in=[TicketStatus.OPEN, TicketStatus.PROCESSING]),
                distinct=True,
            ),
            last_ticket_at=Max("tickets__last_message_at"),
        )
        .order_by("-id")
    )


def filter_admin_members(
    *,
    keyword: str = "",
    status: str | None = None,
    level: str = "",
    assigned_admin_id: int | None = None,
) -> QuerySet[User]:
    queryset = admin_member_queryset()
    normalized_keyword = (keyword or "").strip()
    if normalized_keyword:
        queryset = queryset.filter(
            Q(email__icontains=normalized_keyword)
            | Q(phone__icontains=normalized_keyword)
            | Q(profile__member_no__icontains=normalized_keyword)
            | Q(profile__display_name__icontains=normalized_keyword)
            | Q(profile__warehouse_code__icontains=normalized_keyword)
        )
    if status:
        queryset = queryset.filter(status=status)
    normalized_level = (level or "").strip()
    if normalized_level:
        queryset = queryset.filter(profile__level=normalized_level)
    if assigned_admin_id:
        queryset = queryset.filter(profile__assigned_service_admin_id=assigned_admin_id)
    return queryset


def get_admin_member(*, user_id: int) -> User:
    try:
        return admin_member_queryset().get(id=user_id)
    except User.DoesNotExist as exc:
        raise exceptions.NotFound("会员不存在") from exc


def active_service_admin_options() -> QuerySet[AdminUser]:
    return (
        AdminUser.objects.filter(status=AdminUserStatus.ACTIVE)
        .filter(Q(is_super_admin=True) | Q(roles__permissions__code="members.view"))
        .distinct()
        .order_by("id")
    )


@transaction.atomic
def update_admin_member(
    *,
    user: User,
    display_name: str | None = None,
    phone: str | None = None,
    level: str | None = None,
    assigned_admin_id: int | None = None,
    service_note: str | None = None,
) -> User:
    locked = User.objects.select_for_update().select_related("profile").get(id=user.id)
    user_fields: list[str] = []
    profile_fields: list[str] = []

    if phone is not None:
        locked.phone = phone.strip()
        user_fields.extend(["phone", "updated_at"])
    if display_name is not None:
        locked.profile.display_name = display_name.strip()
        profile_fields.extend(["display_name", "updated_at"])
    if level is not None:
        normalized_level = level.strip()
        if not normalized_level:
            raise exceptions.ValidationError({"level": ["会员等级不能为空"]})
        locked.profile.level = normalized_level
        profile_fields.extend(["level", "updated_at"])
    if assigned_admin_id is not None:
        admin_user = None
        if assigned_admin_id:
            try:
                admin_user = AdminUser.objects.get(id=assigned_admin_id, status=AdminUserStatus.ACTIVE)
            except AdminUser.DoesNotExist as exc:
                raise exceptions.ValidationError({"assigned_admin_id": ["客服人员不存在或已停用"]}) from exc
        locked.profile.assigned_service_admin = admin_user
        profile_fields.extend(["assigned_service_admin", "updated_at"])
    if service_note is not None:
        locked.profile.service_note = service_note.strip()
        profile_fields.extend(["service_note", "updated_at"])

    if user_fields:
        locked.save(update_fields=sorted(set(user_fields)))
    if profile_fields:
        locked.profile.save(update_fields=sorted(set(profile_fields)))
    return get_admin_member(user_id=locked.id)


@transaction.atomic
def set_member_status(*, user: User, status: UserStatus) -> User:
    locked = User.objects.select_for_update().get(id=user.id)
    locked.status = status
    locked.save(update_fields=["status", "updated_at"])
    return get_admin_member(user_id=locked.id)


@transaction.atomic
def reset_member_password(*, user: User, password: str = DEFAULT_TEST_MEMBER_PASSWORD) -> User:
    locked = User.objects.select_for_update().get(id=user.id)
    locked.password_hash = make_password(password or DEFAULT_TEST_MEMBER_PASSWORD)
    locked.save(update_fields=["password_hash", "updated_at"])
    return get_admin_member(user_id=locked.id)


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
        return

    update_fields = []
    if user.status != UserStatus.ACTIVE:
        user.status = UserStatus.ACTIVE
        update_fields.extend(["status", "updated_at"])
    if not check_password(password, user.password_hash):
        user.password_hash = make_password(password)
        update_fields.extend(["password_hash", "updated_at"])
    if update_fields:
        user.save(update_fields=sorted(set(update_fields)))

    if not hasattr(user, "profile"):
        MemberProfile.objects.create(
            user=user,
            member_no=build_member_no(user.id),
            display_name="测试用户",
            warehouse_code=build_warehouse_code(user.id),
        )
