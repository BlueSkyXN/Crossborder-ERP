from datetime import timedelta

from django.contrib.auth.hashers import make_password
from django.db import transaction
from django.utils import timezone
from drf_spectacular.utils import OpenApiResponse, extend_schema
from rest_framework import exceptions
from rest_framework import status
from rest_framework.views import APIView

from apps.common.responses import success_response
from apps.common.throttles import LoginRateThrottle

from .authentication import AdminTokenAuthentication
from .dashboard import build_admin_dashboard_snapshot
from .models import AdminUser, AdminUserStatus, Permission, Role
from .permissions import HasAdminPermission, IsAdminAuthenticated
from .serializers import (
    AdminAccountSerializer,
    AdminAccountWriteSerializer,
    AdminLoginSerializer,
    AdminUserSerializer,
    PermissionSerializer,
    RoleSerializer,
    RoleWriteSerializer,
)
from .services import get_admin_menus, has_any_permission, login_admin


def next_password_changed_at(current):
    changed_at = timezone.now()
    if current and int(changed_at.timestamp()) <= int(current.timestamp()):
        return current + timedelta(seconds=1)
    return changed_at


class AdminLoginView(APIView):
    authentication_classes = []
    permission_classes = []
    throttle_classes = [LoginRateThrottle]

    @extend_schema(
        tags=["admin-auth"],
        request=AdminLoginSerializer,
        responses={200: OpenApiResponse(description="Admin login result")},
    )
    def post(self, request):
        serializer = AdminLoginSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        result = login_admin(**serializer.validated_data)
        return success_response(
            {
                "access_token": result.access_token,
                "token_type": "Bearer",
                "admin_user": AdminUserSerializer(result.admin_user).data,
            },
            status=status.HTTP_200_OK,
        )


class AdminMeView(APIView):
    authentication_classes = [AdminTokenAuthentication]
    permission_classes = [IsAdminAuthenticated]

    @extend_schema(tags=["admin-auth"], responses={200: AdminUserSerializer})
    def get(self, request):
        return success_response(AdminUserSerializer(request.user).data)


class AdminMenusView(APIView):
    authentication_classes = [AdminTokenAuthentication]
    permission_classes = [IsAdminAuthenticated]

    @extend_schema(tags=["admin-auth"], responses={200: OpenApiResponse(description="Menus")})
    def get(self, request):
        return success_response({"items": get_admin_menus(request.user)})


class AdminDashboardView(APIView):
    authentication_classes = [AdminTokenAuthentication]
    permission_classes = [HasAdminPermission]
    required_permission = "dashboard.view"

    @extend_schema(tags=["admin-dashboard"], responses={200: OpenApiResponse(description="Admin dashboard snapshot")})
    def get(self, request):
        return success_response(build_admin_dashboard_snapshot(request.user))


class AdminRolesView(APIView):
    authentication_classes = [AdminTokenAuthentication]
    permission_classes = [HasAdminPermission]
    required_permission = "iam.role.view"
    write_permission = "iam.role.manage"
    method_permissions = {"POST": ("iam.role.create", "iam.role.manage")}

    @extend_schema(tags=["admin-auth"], responses={200: RoleSerializer(many=True)})
    def get(self, request):
        roles = Role.objects.prefetch_related("permissions")
        return success_response({"items": RoleSerializer(roles, many=True).data})

    @extend_schema(
        tags=["admin-auth"],
        request=RoleWriteSerializer,
        responses={201: RoleSerializer},
    )
    def post(self, request):
        ensure_admin_action_permission(request.user, ("iam.role.create", "iam.role.manage"), "缺少角色创建权限")
        serializer = RoleWriteSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        role = save_role(serializer.validated_data)
        return success_response(RoleSerializer(role).data, status=status.HTTP_201_CREATED)


class AdminRoleDetailView(APIView):
    authentication_classes = [AdminTokenAuthentication]
    permission_classes = [HasAdminPermission]
    required_permission = "iam.role.view"
    write_permission = "iam.role.manage"
    method_permissions = {
        "PATCH": ("iam.role.update", "iam.role.manage"),
        "DELETE": ("iam.role.delete", "iam.role.manage"),
    }

    def get_role(self, role_id: int) -> Role:
        try:
            return Role.objects.prefetch_related("permissions").get(id=role_id)
        except Role.DoesNotExist as exc:
            raise exceptions.NotFound("角色不存在") from exc

    @extend_schema(tags=["admin-auth"], responses={200: RoleSerializer})
    def get(self, request, role_id: int):
        return success_response(RoleSerializer(self.get_role(role_id)).data)

    @extend_schema(tags=["admin-auth"], request=RoleWriteSerializer, responses={200: RoleSerializer})
    def patch(self, request, role_id: int):
        ensure_admin_action_permission(request.user, ("iam.role.update", "iam.role.manage"), "缺少角色编辑权限")
        role = self.get_role(role_id)
        serializer = RoleWriteSerializer(role, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        role = save_role(serializer.validated_data, role=role)
        return success_response(RoleSerializer(role).data)

    @extend_schema(tags=["admin-auth"], responses={200: OpenApiResponse(description="Deleted role id")})
    def delete(self, request, role_id: int):
        ensure_admin_action_permission(request.user, ("iam.role.delete", "iam.role.manage"), "缺少角色删除权限")
        role = self.get_role(role_id)
        deleted_id = delete_role(role)
        return success_response({"deleted_id": deleted_id})


class AdminPermissionsView(APIView):
    authentication_classes = [AdminTokenAuthentication]
    permission_classes = [HasAdminPermission]
    required_permission = "iam.role.view"

    @extend_schema(tags=["admin-auth"], responses={200: PermissionSerializer(many=True)})
    def get(self, request):
        permissions = Permission.objects.all()
        return success_response({"items": PermissionSerializer(permissions, many=True).data})


class AdminAccountsView(APIView):
    authentication_classes = [AdminTokenAuthentication]
    permission_classes = [HasAdminPermission]
    required_permission = "iam.admin.view"
    write_permission = "iam.admin.manage"
    method_permissions = {"POST": ("iam.admin.create", "iam.admin.manage")}

    @extend_schema(tags=["admin-auth"], responses={200: AdminAccountSerializer(many=True)})
    def get(self, request):
        accounts = AdminUser.objects.prefetch_related("roles__permissions").all()
        return success_response({"items": AdminAccountSerializer(accounts, many=True).data})

    @extend_schema(tags=["admin-auth"], request=AdminAccountWriteSerializer, responses={201: AdminAccountSerializer})
    def post(self, request):
        ensure_admin_action_permission(request.user, ("iam.admin.create", "iam.admin.manage"), "缺少管理员账号创建权限")
        serializer = AdminAccountWriteSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        admin_account = save_admin_account(serializer.validated_data, actor=request.user)
        return success_response(AdminAccountSerializer(admin_account).data, status=status.HTTP_201_CREATED)


class AdminAccountDetailView(APIView):
    authentication_classes = [AdminTokenAuthentication]
    permission_classes = [HasAdminPermission]
    required_permission = "iam.admin.view"
    write_permission = "iam.admin.manage"
    method_permissions = {
        "PATCH": ("iam.admin.update", "iam.admin.manage"),
        "DELETE": ("iam.admin.delete", "iam.admin.manage"),
    }

    def get_admin_account(self, admin_id: int) -> AdminUser:
        try:
            return AdminUser.objects.prefetch_related("roles__permissions").get(id=admin_id)
        except AdminUser.DoesNotExist as exc:
            raise exceptions.NotFound("管理员不存在") from exc

    @extend_schema(tags=["admin-auth"], responses={200: AdminAccountSerializer})
    def get(self, request, admin_id: int):
        return success_response(AdminAccountSerializer(self.get_admin_account(admin_id)).data)

    @extend_schema(tags=["admin-auth"], request=AdminAccountWriteSerializer, responses={200: AdminAccountSerializer})
    def patch(self, request, admin_id: int):
        ensure_admin_action_permission(request.user, ("iam.admin.update", "iam.admin.manage"), "缺少管理员账号编辑权限")
        admin_account = self.get_admin_account(admin_id)
        serializer = AdminAccountWriteSerializer(admin_account, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        admin_account = save_admin_account(serializer.validated_data, admin_account=admin_account, actor=request.user)
        return success_response(AdminAccountSerializer(admin_account).data)

    @extend_schema(tags=["admin-auth"], responses={200: OpenApiResponse(description="Deleted admin account id")})
    def delete(self, request, admin_id: int):
        ensure_admin_action_permission(request.user, ("iam.admin.delete", "iam.admin.manage"), "缺少管理员账号删除权限")
        admin_account = self.get_admin_account(admin_id)
        deleted_id = delete_admin_account(admin_account, actor=request.user)
        return success_response({"deleted_id": deleted_id})


def ensure_admin_action_permission(admin_user, permission_codes: tuple[str, ...], message: str) -> None:
    if not has_any_permission(admin_user, permission_codes):
        raise exceptions.PermissionDenied(message)


@transaction.atomic
def save_role(validated_data, role: Role | None = None) -> Role:
    if role and role.code == "super_admin":
        raise exceptions.ValidationError({"code": "内置超级管理员角色不可修改"})

    permission_codes = validated_data.pop("permission_codes", None)
    if role is None:
        role = Role.objects.create(**validated_data)
    else:
        for field in ["name", "description"]:
            if field in validated_data:
                setattr(role, field, validated_data[field])
        role.save(update_fields=["name", "description", "updated_at"])

    if permission_codes is not None:
        permissions = Permission.objects.filter(code__in=permission_codes)
        role.permissions.set(permissions)
    return Role.objects.prefetch_related("permissions").get(id=role.id)


@transaction.atomic
def delete_role(role: Role) -> int:
    if role.code == "super_admin":
        raise exceptions.ValidationError({"code": "内置超级管理员角色不可删除"})
    if role.admin_users.exists():
        raise exceptions.ValidationError({"code": "角色仍分配给管理员，不能删除"})

    deleted_id = role.id
    role.delete()
    return deleted_id


@transaction.atomic
def save_admin_account(
    validated_data,
    *,
    admin_account: AdminUser | None = None,
    actor: AdminUser,
) -> AdminUser:
    role_codes = validated_data.pop("role_codes", None)
    raw_password = validated_data.pop("password", "")

    if admin_account is not None:
        if admin_account.is_super_admin:
            raise exceptions.ValidationError({"email": "内置超级管理员账号不可修改"})
        if actor.id == admin_account.id and ("status" in validated_data or role_codes is not None or raw_password):
            raise exceptions.ValidationError({"email": "当前登录管理员不可修改自己的状态、角色或密码"})

    if admin_account is None:
        admin_account = AdminUser.objects.create(
            email=validated_data["email"],
            name=validated_data["name"],
            status=validated_data.get("status", AdminUserStatus.ACTIVE),
            is_super_admin=False,
            password_hash=make_password(raw_password),
            password_changed_at=next_password_changed_at(None),
        )
    else:
        for field in ["name", "status"]:
            if field in validated_data:
                setattr(admin_account, field, validated_data[field])
        if raw_password:
            admin_account.password_hash = make_password(raw_password)
            admin_account.password_changed_at = next_password_changed_at(admin_account.password_changed_at)
        update_fields = ["name", "status", "updated_at"]
        if raw_password:
            update_fields.extend(["password_hash", "password_changed_at"])
        admin_account.save(update_fields=update_fields)

    if role_codes is not None:
        roles = Role.objects.filter(code__in=role_codes)
        admin_account.roles.set(roles)
    return AdminUser.objects.prefetch_related("roles__permissions").get(id=admin_account.id)


@transaction.atomic
def delete_admin_account(admin_account: AdminUser, *, actor: AdminUser) -> int:
    if admin_account.is_super_admin:
        raise exceptions.ValidationError({"email": "内置超级管理员账号不可删除"})
    if actor.id == admin_account.id:
        raise exceptions.ValidationError({"email": "当前登录管理员不可删除自己"})

    deleted_id = admin_account.id
    admin_account.delete()
    return deleted_id
