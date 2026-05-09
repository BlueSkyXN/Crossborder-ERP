from dataclasses import dataclass
from typing import Iterable

from django.contrib.auth.hashers import check_password, make_password
from django.db import transaction
from rest_framework import exceptions
from rest_framework_simplejwt.tokens import AccessToken

from .models import AdminUser, AdminUserStatus, Permission, PermissionType, Role, mark_admin_login


ADMIN_TOKEN_SCOPE = "admin"

MENU_PERMISSIONS = [
    ("dashboard.view", "控制台", "dashboard", 10),
    ("members.view", "会员管理", "members", 20),
    ("warehouses.view", "仓库配置", "warehouses", 30),
    ("parcels.view", "包裹管理", "parcels", 40),
    ("waybills.view", "运单管理", "waybills", 50),
    ("finance.view", "财务管理", "finance", 60),
    ("purchases.view", "代购管理", "purchases", 70),
    ("products.view", "商品管理", "products", 80),
    ("tickets.view", "客服工单", "tickets", 85),
    ("content.view", "内容管理", "content", 88),
    ("iam.role.view", "角色权限", "roles", 90),
]

ROLE_DEFINITIONS = {
    "super_admin": {
        "name": "超级管理员",
        "description": "全部后台权限",
        "permissions": [item[0] for item in MENU_PERMISSIONS],
    },
    "warehouse": {
        "name": "仓库人员",
        "description": "包裹、仓储和运单操作",
        "permissions": ["dashboard.view", "parcels.view", "waybills.view"],
    },
    "finance": {
        "name": "财务人员",
        "description": "财务和支付查询操作",
        "permissions": ["dashboard.view", "finance.view"],
    },
    "buyer": {
        "name": "采购人员",
        "description": "代购订单和商品相关操作",
        "permissions": ["dashboard.view", "purchases.view", "products.view"],
    },
    "support": {
        "name": "客服人员",
        "description": "会员咨询、包裹、运单和代购问题处理",
        "permissions": [
            "dashboard.view",
            "members.view",
            "parcels.view",
            "waybills.view",
            "purchases.view",
            "tickets.view",
        ],
    },
}

ADMIN_DEMO_USERS = [
    ("admin@example.com", "超级管理员", "super_admin", True),
    ("warehouse@example.com", "仓库人员", "warehouse", False),
    ("finance@example.com", "财务人员", "finance", False),
    ("buyer@example.com", "采购人员", "buyer", False),
    ("support@example.com", "客服人员", "support", False),
]


@dataclass(frozen=True)
class LoginResult:
    admin_user: AdminUser
    access_token: str


def issue_admin_access_token(admin_user: AdminUser) -> str:
    token = AccessToken()
    token["token_scope"] = ADMIN_TOKEN_SCOPE
    token["admin_user_id"] = admin_user.id
    token["email"] = admin_user.email
    return str(token)


def login_admin(email: str, password: str) -> LoginResult:
    try:
        admin_user = AdminUser.objects.get(email=email)
    except AdminUser.DoesNotExist as exc:
        raise exceptions.AuthenticationFailed("邮箱或密码错误") from exc

    if not admin_user.is_active:
        raise exceptions.PermissionDenied("管理员已停用")

    if not check_password(password, admin_user.password_hash):
        raise exceptions.AuthenticationFailed("邮箱或密码错误")

    mark_admin_login(admin_user)
    admin_user.refresh_from_db()
    return LoginResult(admin_user=admin_user, access_token=issue_admin_access_token(admin_user))


def get_admin_permission_codes(admin_user: AdminUser) -> set[str]:
    if admin_user.is_super_admin:
        return set(Permission.objects.values_list("code", flat=True))

    return set(
        Permission.objects.filter(roles__admin_users=admin_user).values_list("code", flat=True)
    )


def get_admin_menus(admin_user: AdminUser) -> list[dict[str, str]]:
    allowed_codes = get_admin_permission_codes(admin_user)
    permissions = Permission.objects.filter(type=PermissionType.MENU, code__in=allowed_codes)
    return [
        {
            "code": permission.code,
            "name": permission.name,
            "resource": permission.resource,
        }
        for permission in permissions
    ]


def admin_has_permission(admin_user: AdminUser, permission_code: str) -> bool:
    if admin_user.is_super_admin:
        return True
    return permission_code in get_admin_permission_codes(admin_user)


@transaction.atomic
def seed_iam_demo_data(password: str = "password123") -> None:
    permission_by_code = {}
    for code, name, resource, sort_order in MENU_PERMISSIONS:
        permission, _ = Permission.objects.update_or_create(
            code=code,
            defaults={
                "name": name,
                "type": PermissionType.MENU,
                "resource": resource,
                "sort_order": sort_order,
            },
        )
        permission_by_code[code] = permission

    role_by_code = {}
    for role_code, role_data in ROLE_DEFINITIONS.items():
        role, _ = Role.objects.update_or_create(
            code=role_code,
            defaults={
                "name": role_data["name"],
                "description": role_data["description"],
            },
        )
        role.permissions.set(permission_by_code[code] for code in role_data["permissions"])
        role_by_code[role_code] = role

    for email, name, role_code, is_super_admin in ADMIN_DEMO_USERS:
        admin_user, created = AdminUser.objects.update_or_create(
            email=email,
            defaults={
                "name": name,
                "status": AdminUserStatus.ACTIVE,
                "is_super_admin": is_super_admin,
            },
        )
        if created or not admin_user.password_hash:
            admin_user.password_hash = make_password(password)
            admin_user.save(update_fields=["password_hash", "updated_at"])
        admin_user.roles.set([role_by_code[role_code]])


def has_any_permission(admin_user: AdminUser, permission_codes: Iterable[str]) -> bool:
    return any(admin_has_permission(admin_user, code) for code in permission_codes)
