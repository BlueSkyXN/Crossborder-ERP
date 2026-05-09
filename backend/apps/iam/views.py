from django.db import transaction
from drf_spectacular.utils import OpenApiResponse, extend_schema
from rest_framework import exceptions
from rest_framework import status
from rest_framework.views import APIView

from apps.common.responses import success_response

from .authentication import AdminTokenAuthentication
from .dashboard import build_admin_dashboard_snapshot
from .models import Permission, Role
from .permissions import HasAdminPermission, IsAdminAuthenticated
from .serializers import (
    AdminLoginSerializer,
    AdminUserSerializer,
    PermissionSerializer,
    RoleSerializer,
    RoleWriteSerializer,
)
from .services import admin_has_permission, get_admin_menus, login_admin


class AdminLoginView(APIView):
    authentication_classes = []
    permission_classes = []

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
        ensure_role_manage_permission(request.user)
        serializer = RoleWriteSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        role = save_role(serializer.validated_data)
        return success_response(RoleSerializer(role).data, status=status.HTTP_201_CREATED)


class AdminRoleDetailView(APIView):
    authentication_classes = [AdminTokenAuthentication]
    permission_classes = [HasAdminPermission]
    required_permission = "iam.role.view"

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
        ensure_role_manage_permission(request.user)
        role = self.get_role(role_id)
        serializer = RoleWriteSerializer(role, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        role = save_role(serializer.validated_data, role=role)
        return success_response(RoleSerializer(role).data)


class AdminPermissionsView(APIView):
    authentication_classes = [AdminTokenAuthentication]
    permission_classes = [HasAdminPermission]
    required_permission = "iam.role.view"

    @extend_schema(tags=["admin-auth"], responses={200: PermissionSerializer(many=True)})
    def get(self, request):
        permissions = Permission.objects.all()
        return success_response({"items": PermissionSerializer(permissions, many=True).data})


def ensure_role_manage_permission(admin_user):
    if not admin_has_permission(admin_user, "iam.role.manage"):
        raise exceptions.PermissionDenied("缺少角色管理权限")


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
