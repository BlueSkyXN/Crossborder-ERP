from drf_spectacular.utils import OpenApiResponse, extend_schema
from rest_framework import status
from rest_framework.views import APIView

from apps.common.responses import success_response
from apps.iam.authentication import AdminTokenAuthentication
from apps.iam.permissions import HasAdminPermission

from .authentication import MemberTokenAuthentication
from .models import UserStatus
from .permissions import IsMemberAuthenticated
from .serializers import (
    AdminMemberQuerySerializer,
    AdminMemberResetPasswordSerializer,
    AdminMemberSerializer,
    AdminMemberUpdateSerializer,
    AdminSupportUserSerializer,
    MemberLoginSerializer,
    RegisterSerializer,
    UpdateProfileSerializer,
    UserSerializer,
)
from .services import (
    active_service_admin_options,
    filter_admin_members,
    get_admin_member,
    login_user,
    register_user,
    reset_member_password,
    set_member_status,
    update_admin_member,
    update_member_profile,
)


class RegisterView(APIView):
    authentication_classes = []
    permission_classes = []

    @extend_schema(tags=["auth"], request=RegisterSerializer, responses={201: UserSerializer})
    def post(self, request):
        serializer = RegisterSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        user = register_user(**serializer.validated_data)
        return success_response(UserSerializer(user).data, status=status.HTTP_201_CREATED)


class MemberLoginView(APIView):
    authentication_classes = []
    permission_classes = []

    @extend_schema(
        tags=["auth"],
        request=MemberLoginSerializer,
        responses={200: OpenApiResponse(description="Member login result")},
    )
    def post(self, request):
        serializer = MemberLoginSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        result = login_user(**serializer.validated_data)
        return success_response(
            {
                "access_token": result.access_token,
                "token_type": "Bearer",
                "user": UserSerializer(result.user).data,
            }
        )


class MemberLogoutView(APIView):
    authentication_classes = [MemberTokenAuthentication]
    permission_classes = [IsMemberAuthenticated]

    @extend_schema(
        tags=["auth"],
        request=None,
        responses={200: OpenApiResponse(description="Logged out")},
    )
    def post(self, request):
        return success_response({"logged_out": True})


class MeView(APIView):
    authentication_classes = [MemberTokenAuthentication]
    permission_classes = [IsMemberAuthenticated]

    @extend_schema(tags=["auth"], responses={200: UserSerializer})
    def get(self, request):
        return success_response(UserSerializer(request.user).data)


class MeProfileView(APIView):
    authentication_classes = [MemberTokenAuthentication]
    permission_classes = [IsMemberAuthenticated]

    @extend_schema(tags=["auth"], request=UpdateProfileSerializer, responses={200: UserSerializer})
    def put(self, request):
        serializer = UpdateProfileSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        user = update_member_profile(request.user, **serializer.validated_data)
        return success_response(UserSerializer(user).data)


class AdminMemberListView(APIView):
    authentication_classes = [AdminTokenAuthentication]
    permission_classes = [HasAdminPermission]
    required_permission = "members.view"

    @extend_schema(
        tags=["admin-members"],
        parameters=[AdminMemberQuerySerializer],
        responses={200: AdminMemberSerializer(many=True)},
    )
    def get(self, request):
        query_serializer = AdminMemberQuerySerializer(data=request.query_params)
        query_serializer.is_valid(raise_exception=True)
        members = filter_admin_members(**query_serializer.validated_data)
        return success_response({"items": AdminMemberSerializer(members, many=True).data})


class AdminMemberDetailView(APIView):
    authentication_classes = [AdminTokenAuthentication]
    permission_classes = [HasAdminPermission]
    required_permission = "members.view"

    @extend_schema(tags=["admin-members"], responses={200: AdminMemberSerializer})
    def get(self, request, user_id: int):
        return success_response(AdminMemberSerializer(get_admin_member(user_id=user_id)).data)

    @extend_schema(tags=["admin-members"], request=AdminMemberUpdateSerializer, responses={200: AdminMemberSerializer})
    def patch(self, request, user_id: int):
        serializer = AdminMemberUpdateSerializer(data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        data = dict(serializer.validated_data)
        if "assigned_admin_id" in data and data["assigned_admin_id"] is None:
            data["assigned_admin_id"] = 0
        member = update_admin_member(user=get_admin_member(user_id=user_id), **data)
        return success_response(AdminMemberSerializer(member).data)


class AdminMemberFreezeView(APIView):
    authentication_classes = [AdminTokenAuthentication]
    permission_classes = [HasAdminPermission]
    required_permission = "members.view"

    @extend_schema(tags=["admin-members"], request=None, responses={200: AdminMemberSerializer})
    def post(self, request, user_id: int):
        member = set_member_status(user=get_admin_member(user_id=user_id), status=UserStatus.FROZEN)
        return success_response(AdminMemberSerializer(member).data)


class AdminMemberUnfreezeView(APIView):
    authentication_classes = [AdminTokenAuthentication]
    permission_classes = [HasAdminPermission]
    required_permission = "members.view"

    @extend_schema(tags=["admin-members"], request=None, responses={200: AdminMemberSerializer})
    def post(self, request, user_id: int):
        member = set_member_status(user=get_admin_member(user_id=user_id), status=UserStatus.ACTIVE)
        return success_response(AdminMemberSerializer(member).data)


class AdminMemberResetPasswordView(APIView):
    authentication_classes = [AdminTokenAuthentication]
    permission_classes = [HasAdminPermission]
    required_permission = "members.view"

    @extend_schema(
        tags=["admin-members"],
        request=AdminMemberResetPasswordSerializer,
        responses={200: AdminMemberSerializer},
    )
    def post(self, request, user_id: int):
        serializer = AdminMemberResetPasswordSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        member = reset_member_password(user=get_admin_member(user_id=user_id), **serializer.validated_data)
        return success_response(AdminMemberSerializer(member).data)


class AdminSupportUserListView(APIView):
    authentication_classes = [AdminTokenAuthentication]
    permission_classes = [HasAdminPermission]
    required_permission = "members.view"

    @extend_schema(tags=["admin-members"], responses={200: AdminSupportUserSerializer(many=True)})
    def get(self, request):
        return success_response({"items": AdminSupportUserSerializer(active_service_admin_options(), many=True).data})
