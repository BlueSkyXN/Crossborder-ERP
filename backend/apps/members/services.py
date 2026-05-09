from dataclasses import dataclass
from decimal import Decimal

from django.contrib.auth.hashers import check_password, make_password
from django.db import IntegrityError, transaction
from django.db.models import Count, Max, Q, QuerySet, Sum
from django.utils import timezone
from rest_framework import exceptions
from rest_framework_simplejwt.tokens import AccessToken

from apps.iam.models import AdminUser, AdminUserStatus
from apps.tickets.models import TicketStatus

from .models import (
    MemberProfile,
    PointLedger,
    PointTransactionDirection,
    PointTransactionType,
    RebateRecord,
    RebateStatus,
    ReferralRelation,
    ReferralStatus,
    User,
    UserStatus,
)


MEMBER_TOKEN_SCOPE = "member"
DEFAULT_TEST_MEMBER_PASSWORD = "password123"
TODO_CONFIRM_POINTS_RULE = "TODO_CONFIRM: 积分获取和兑换比例待业务确认；当前仅记录可审计流水和余额。"
TODO_CONFIRM_REBATE_RULE = "TODO_CONFIRM: 返利比例、结算周期、提现和税务规则待业务确认；当前不进入钱包余额。"


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


def _build_referral_code(user: User) -> str:
    profile = getattr(user, "profile", None)
    return profile.member_no if profile else build_member_no(user.id)


@transaction.atomic
def register_user(email: str, password: str, display_name: str = "", phone: str = "", referral_code: str = "") -> User:
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
    if referral_code:
        create_referral_relation_from_code(
            invitee=user,
            referral_code=referral_code,
            remark="TODO_CONFIRM: 当前仅登记邀请关系，不自动发放最终积分或返利。",
        )
    return user


def get_point_balance(user: User) -> int:
    latest = PointLedger.objects.filter(user=user).order_by("-id").first()
    return latest.balance_after if latest else 0


def member_growth_summary(user: User) -> dict[str, object]:
    confirmed_amount = (
        RebateRecord.objects.filter(user=user, status=RebateStatus.CONFIRMED)
        .aggregate(total=Sum("amount"))
        .get("total")
        or Decimal("0.00")
    )
    pending_amount = (
        RebateRecord.objects.filter(user=user, status=RebateStatus.PENDING)
        .aggregate(total=Sum("amount"))
        .get("total")
        or Decimal("0.00")
    )
    invited = ReferralRelation.objects.filter(inviter=user)
    confirmed_reward_points = (
        RebateRecord.objects.filter(user=user, status=RebateStatus.CONFIRMED)
        .aggregate(total=Sum("reward_points"))
        .get("total")
        or 0
    )
    return {
        "points_balance": get_point_balance(user),
        "referral_code": _build_referral_code(user),
        "invited_count": invited.count(),
        "active_invited_count": invited.filter(status=ReferralStatus.ACTIVE).count(),
        "confirmed_reward_points": confirmed_reward_points,
        "confirmed_rebate_amount": confirmed_amount,
        "pending_rebate_amount": pending_amount,
        "currency": "CNY",
        "points_rule_note": TODO_CONFIRM_POINTS_RULE,
        "rebate_rule_note": TODO_CONFIRM_REBATE_RULE,
    }


def point_ledger_queryset() -> QuerySet[PointLedger]:
    return PointLedger.objects.select_related("user", "operator")


def referral_relation_queryset() -> QuerySet[ReferralRelation]:
    return ReferralRelation.objects.select_related(
        "inviter",
        "inviter__profile",
        "invitee",
        "invitee__profile",
        "created_by_admin",
    )


def rebate_record_queryset() -> QuerySet[RebateRecord]:
    return RebateRecord.objects.select_related(
        "user",
        "referral_relation",
        "referral_relation__invitee",
        "created_by_admin",
    )


def get_member_user(*, user_id: int) -> User:
    try:
        return User.objects.select_related("profile").get(id=user_id)
    except User.DoesNotExist as exc:
        raise exceptions.NotFound("会员不存在") from exc


def get_referral_relation(*, referral_id: int) -> ReferralRelation:
    try:
        return referral_relation_queryset().get(id=referral_id)
    except ReferralRelation.DoesNotExist as exc:
        raise exceptions.NotFound("邀请关系不存在") from exc


def create_referral_relation_from_code(
    *,
    invitee: User,
    referral_code: str,
    operator: AdminUser | None = None,
    remark: str = "",
) -> ReferralRelation | None:
    normalized_code = (referral_code or "").strip().upper()
    if not normalized_code:
        return None
    try:
        inviter_profile = MemberProfile.objects.select_related("user").get(member_no__iexact=normalized_code)
    except MemberProfile.DoesNotExist as exc:
        raise exceptions.ValidationError({"referral_code": ["邀请码不存在"]}) from exc
    return create_referral_relation(
        inviter=inviter_profile.user,
        invitee=invitee,
        operator=operator,
        invitation_code=normalized_code,
        status=ReferralStatus.ACTIVE,
        remark=remark or "TODO_CONFIRM: 邀请归因、有效期和首单有效条件待业务确认。",
    )


@transaction.atomic
def adjust_member_points(
    *,
    user: User,
    operator: AdminUser | None,
    points_delta: int,
    type: str = PointTransactionType.MANUAL_ADJUSTMENT,
    business_type: str = "",
    business_id: int | None = None,
    remark: str = "",
) -> PointLedger:
    if points_delta == 0:
        raise exceptions.ValidationError({"points_delta": ["积分调整值不能为 0"]})
    if type not in PointTransactionType.values:
        raise exceptions.ValidationError({"type": ["积分流水类型无效"]})
    locked_user = User.objects.select_for_update().get(id=user.id)
    current_balance = get_point_balance(locked_user)
    direction = PointTransactionDirection.EARN if points_delta > 0 else PointTransactionDirection.SPEND
    points = abs(points_delta)
    next_balance = current_balance + points_delta
    if next_balance < 0:
        raise exceptions.ValidationError({"points_delta": ["积分余额不足"]})
    ledger = PointLedger.objects.create(
        user=locked_user,
        operator=operator,
        type=type,
        direction=direction,
        points=points,
        balance_after=next_balance,
        business_type=(business_type or "").strip(),
        business_id=business_id,
        remark=(remark or "").strip() or TODO_CONFIRM_POINTS_RULE,
    )
    return point_ledger_queryset().get(id=ledger.id)


@transaction.atomic
def create_referral_relation(
    *,
    inviter: User,
    invitee: User,
    operator: AdminUser | None = None,
    invitation_code: str = "",
    status: str = ReferralStatus.ACTIVE,
    remark: str = "",
) -> ReferralRelation:
    if inviter.id == invitee.id:
        raise exceptions.ValidationError({"invitee_id": ["邀请人和被邀请人不能相同"]})
    inviter = User.objects.select_for_update().select_related("profile").get(id=inviter.id)
    invitee = User.objects.select_for_update().select_related("profile").get(id=invitee.id)
    if ReferralRelation.objects.filter(invitee=invitee).exists():
        raise exceptions.ValidationError({"invitee_id": ["该会员已有邀请关系"]})
    relation = ReferralRelation.objects.create(
        inviter=inviter,
        invitee=invitee,
        invitation_code=(invitation_code or _build_referral_code(inviter)).strip(),
        status=status,
        created_by_admin=operator,
        remark=(remark or "").strip() or "TODO_CONFIRM: 邀请归因和有效期规则待业务确认。",
        activated_at=timezone.now() if status == ReferralStatus.ACTIVE else None,
    )
    return referral_relation_queryset().get(id=relation.id)


@transaction.atomic
def create_rebate_record(
    *,
    referral_relation: ReferralRelation,
    operator: AdminUser | None,
    amount: Decimal,
    reward_points: int = 0,
    currency: str = "CNY",
    status: str = RebateStatus.CONFIRMED,
    business_type: str = "",
    business_id: int | None = None,
    remark: str = "",
) -> RebateRecord:
    if amount < Decimal("0.00"):
        raise exceptions.ValidationError({"amount": ["返利金额不能小于 0"]})
    if reward_points < 0:
        raise exceptions.ValidationError({"reward_points": ["奖励积分不能小于 0"]})
    if amount == Decimal("0.00") and reward_points == 0:
        raise exceptions.ValidationError({"amount": ["返利金额或奖励积分至少填写一项"]})
    if status not in RebateStatus.values:
        raise exceptions.ValidationError({"status": ["返利状态无效"]})
    relation = ReferralRelation.objects.select_for_update().select_related("inviter", "invitee").get(
        id=referral_relation.id
    )
    if relation.status != ReferralStatus.ACTIVE:
        raise exceptions.ValidationError({"referral_id": ["只有有效邀请关系可以登记返利"]})
    normalized_business_type = (business_type or "").strip()
    if normalized_business_type and business_id:
        exists = RebateRecord.objects.filter(
            referral_relation=relation,
            business_type=normalized_business_type,
            business_id=business_id,
        ).exists()
        if exists:
            raise exceptions.ValidationError({"business_id": ["该业务来源已登记返利"]})
    rebate = RebateRecord.objects.create(
        user=relation.inviter,
        referral_relation=relation,
        amount=amount,
        reward_points=reward_points,
        currency=currency,
        status=status,
        business_type=normalized_business_type,
        business_id=business_id,
        remark=(remark or "").strip() or TODO_CONFIRM_REBATE_RULE,
        created_by_admin=operator,
    )
    if status == RebateStatus.CONFIRMED and reward_points > 0:
        adjust_member_points(
            user=relation.inviter,
            operator=operator,
            points_delta=reward_points,
            type=PointTransactionType.REBATE_REWARD,
            business_type="REBATE_RECORD",
            business_id=rebate.id,
            remark=rebate.remark,
        )
    return rebate_record_queryset().get(id=rebate.id)


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


def update_member_profile(user: User, *, display_name: str | None = None, phone: str | None = None) -> User:
    if display_name is not None:
        user.profile.display_name = display_name
        user.profile.save(update_fields=["display_name", "updated_at"])
    if phone is not None:
        user.phone = phone
        user.save(update_fields=["phone", "updated_at"])
    user.refresh_from_db()
    return user


def change_member_password(user: User, *, current_password: str, new_password: str) -> User:
    locked = User.objects.select_for_update().select_related("profile").get(id=user.id)
    if not check_password(current_password, locked.password_hash):
        raise exceptions.ValidationError({"current_password": ["当前密码不正确"]})
    if check_password(new_password, locked.password_hash):
        raise exceptions.ValidationError({"new_password": ["新密码不能与当前密码相同"]})
    locked.password_hash = make_password(new_password)
    locked.save(update_fields=["password_hash", "updated_at"])
    return locked


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
