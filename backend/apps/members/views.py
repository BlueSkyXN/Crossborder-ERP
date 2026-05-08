from drf_spectacular.utils import OpenApiResponse, extend_schema
from rest_framework import status
from rest_framework.views import APIView

from apps.common.responses import success_response

from .authentication import MemberTokenAuthentication
from .permissions import IsMemberAuthenticated
from .serializers import (
    MemberLoginSerializer,
    RegisterSerializer,
    UpdateProfileSerializer,
    UserSerializer,
)
from .services import login_user, register_user, update_member_profile


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
