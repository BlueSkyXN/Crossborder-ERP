from drf_spectacular.utils import OpenApiResponse, extend_schema
from rest_framework import status
from rest_framework.views import APIView

from apps.common.responses import success_response

from .authentication import AdminTokenAuthentication
from .dashboard import build_admin_dashboard_snapshot
from .models import Role
from .permissions import HasAdminPermission, IsAdminAuthenticated
from .serializers import AdminLoginSerializer, AdminUserSerializer, RoleSerializer
from .services import get_admin_menus, login_admin


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
