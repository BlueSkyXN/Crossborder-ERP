from drf_spectacular.utils import OpenApiResponse, extend_schema
from rest_framework import exceptions, status
from rest_framework.views import APIView

from apps.common.responses import success_response
from apps.iam.authentication import AdminTokenAuthentication
from apps.iam.permissions import HasAdminPermission

from .authentication import MemberTokenAuthentication
from .models import RebateRecord, ReferralRelation, User, UserStatus
from .permissions import IsMemberAuthenticated
from .serializers import (
    AdminPointAdjustmentSerializer,
    AdminRebateCreateSerializer,
    AdminReferralCreateSerializer,
    ChangePasswordSerializer,
    AdminMemberQuerySerializer,
    AdminMemberResetPasswordSerializer,
    AdminMemberSerializer,
    AdminMemberUpdateSerializer,
    AdminSupportUserSerializer,
    GrowthSummarySerializer,
    MemberLoginSerializer,
    PointLedgerSerializer,
    RebateRecordSerializer,
    ReferralRelationSerializer,
    RegisterSerializer,
    UpdateProfileSerializer,
    UserSerializer,
)
from .services import (
    active_service_admin_options,
    adjust_member_points,
    change_member_password,
    create_rebate_record,
    create_referral_relation,
    filter_admin_members,
    get_admin_member,
    login_user,
    member_growth_summary,
    point_ledger_queryset,
    rebate_record_queryset,
    referral_relation_queryset,
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


class MePasswordView(APIView):
    authentication_classes = [MemberTokenAuthentication]
    permission_classes = [IsMemberAuthenticated]

    @extend_schema(
        tags=["auth"],
        request=ChangePasswordSerializer,
        responses={200: OpenApiResponse(description="Password changed")},
    )
    def post(self, request):
        serializer = ChangePasswordSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        change_member_password(request.user, **serializer.validated_data)
        return success_response({"changed": True})


class GrowthSummaryView(APIView):
    authentication_classes = [MemberTokenAuthentication]
    permission_classes = [IsMemberAuthenticated]

    @extend_schema(tags=["growth"], responses={200: GrowthSummarySerializer})
    def get(self, request):
        return success_response(GrowthSummarySerializer(member_growth_summary(request.user)).data)


class PointLedgerListView(APIView):
    authentication_classes = [MemberTokenAuthentication]
    permission_classes = [IsMemberAuthenticated]

    @extend_schema(tags=["growth"], responses={200: PointLedgerSerializer(many=True)})
    def get(self, request):
        ledgers = point_ledger_queryset().filter(user=request.user)
        return success_response({"items": PointLedgerSerializer(ledgers, many=True).data})


class ReferralRelationListView(APIView):
    authentication_classes = [MemberTokenAuthentication]
    permission_classes = [IsMemberAuthenticated]

    @extend_schema(tags=["growth"], responses={200: ReferralRelationSerializer(many=True)})
    def get(self, request):
        referrals = referral_relation_queryset().filter(inviter=request.user)
        return success_response({"items": ReferralRelationSerializer(referrals, many=True).data})


class RebateRecordListView(APIView):
    authentication_classes = [MemberTokenAuthentication]
    permission_classes = [IsMemberAuthenticated]

    @extend_schema(tags=["growth"], responses={200: RebateRecordSerializer(many=True)})
    def get(self, request):
        rebates = rebate_record_queryset().filter(user=request.user)
        return success_response({"items": RebateRecordSerializer(rebates, many=True).data})


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


class AdminMemberGrowthDetailView(APIView):
    authentication_classes = [AdminTokenAuthentication]
    permission_classes = [HasAdminPermission]
    required_permission = "growth.view"

    @extend_schema(tags=["admin-growth"], responses={200: OpenApiResponse(description="Member growth audit detail")})
    def get(self, request, user_id: int):
        member = get_admin_member(user_id=user_id)
        referral_source = referral_relation_queryset().filter(invitee=member).first()
        return success_response(
            {
                "summary": GrowthSummarySerializer(member_growth_summary(member)).data,
                "point_ledgers": PointLedgerSerializer(
                    point_ledger_queryset().filter(user=member)[:50],
                    many=True,
                ).data,
                "referrals": ReferralRelationSerializer(
                    referral_relation_queryset().filter(inviter=member)[:50],
                    many=True,
                ).data,
                "referral_source": ReferralRelationSerializer(referral_source).data if referral_source else None,
                "rebates": RebateRecordSerializer(
                    rebate_record_queryset().filter(user=member)[:50],
                    many=True,
                ).data,
            }
        )


class AdminSupportUserListView(APIView):
    authentication_classes = [AdminTokenAuthentication]
    permission_classes = [HasAdminPermission]
    required_permission = "members.view"

    @extend_schema(tags=["admin-members"], responses={200: AdminSupportUserSerializer(many=True)})
    def get(self, request):
        return success_response({"items": AdminSupportUserSerializer(active_service_admin_options(), many=True).data})


class AdminPointLedgerListView(APIView):
    authentication_classes = [AdminTokenAuthentication]
    permission_classes = [HasAdminPermission]
    required_permission = "growth.view"

    @extend_schema(tags=["admin-growth"], responses={200: PointLedgerSerializer(many=True)})
    def get(self, request):
        ledgers = point_ledger_queryset()
        user_id = request.query_params.get("user_id")
        if user_id:
            ledgers = ledgers.filter(user_id=user_id)
        return success_response({"items": PointLedgerSerializer(ledgers, many=True).data})


class AdminUserPointAdjustView(APIView):
    authentication_classes = [AdminTokenAuthentication]
    permission_classes = [HasAdminPermission]
    required_permission = "growth.view"

    @extend_schema(tags=["admin-growth"], request=AdminPointAdjustmentSerializer, responses={201: PointLedgerSerializer})
    def post(self, request, user_id: int):
        serializer = AdminPointAdjustmentSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        user = get_admin_member(user_id=user_id)
        ledger = adjust_member_points(user=user, operator=request.user, **serializer.validated_data)
        return success_response(PointLedgerSerializer(ledger).data, status=status.HTTP_201_CREATED)


class AdminReferralRelationListCreateView(APIView):
    authentication_classes = [AdminTokenAuthentication]
    permission_classes = [HasAdminPermission]
    required_permission = "growth.view"

    @extend_schema(tags=["admin-growth"], responses={200: ReferralRelationSerializer(many=True)})
    def get(self, request):
        referrals = referral_relation_queryset()
        inviter_id = request.query_params.get("inviter_id")
        invitee_id = request.query_params.get("invitee_id")
        if inviter_id:
            referrals = referrals.filter(inviter_id=inviter_id)
        if invitee_id:
            referrals = referrals.filter(invitee_id=invitee_id)
        return success_response({"items": ReferralRelationSerializer(referrals, many=True).data})

    @extend_schema(
        tags=["admin-growth"],
        request=AdminReferralCreateSerializer,
        responses={201: ReferralRelationSerializer},
    )
    def post(self, request):
        serializer = AdminReferralCreateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data
        try:
            inviter = User.objects.get(id=data["inviter_id"])
            invitee = User.objects.get(id=data["invitee_id"])
        except User.DoesNotExist as exc:
            raise exceptions.NotFound("会员不存在") from exc
        referral = create_referral_relation(
            inviter=inviter,
            invitee=invitee,
            operator=request.user,
            invitation_code=data.get("invitation_code", ""),
            status=data.get("status"),
            remark=data.get("remark", ""),
        )
        return success_response(ReferralRelationSerializer(referral).data, status=status.HTTP_201_CREATED)


class AdminRebateRecordListCreateView(APIView):
    authentication_classes = [AdminTokenAuthentication]
    permission_classes = [HasAdminPermission]
    required_permission = "growth.view"

    @extend_schema(tags=["admin-growth"], responses={200: RebateRecordSerializer(many=True)})
    def get(self, request):
        rebates = rebate_record_queryset()
        user_id = request.query_params.get("user_id")
        if user_id:
            rebates = rebates.filter(user_id=user_id)
        return success_response({"items": RebateRecordSerializer(rebates, many=True).data})

    @extend_schema(
        tags=["admin-growth"],
        request=AdminRebateCreateSerializer,
        responses={201: RebateRecordSerializer},
    )
    def post(self, request):
        serializer = AdminRebateCreateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data
        try:
            referral = ReferralRelation.objects.get(id=data["referral_id"])
        except ReferralRelation.DoesNotExist as exc:
            raise exceptions.NotFound("邀请关系不存在") from exc
        rebate = create_rebate_record(
            referral_relation=referral,
            operator=request.user,
            amount=data["amount"],
            reward_points=data.get("reward_points", 0),
            currency=data.get("currency", "CNY"),
            status=data.get("status"),
            business_type=data.get("business_type", ""),
            business_id=data.get("business_id"),
            remark=data.get("remark", ""),
        )
        return success_response(RebateRecordSerializer(rebate).data, status=status.HTTP_201_CREATED)
