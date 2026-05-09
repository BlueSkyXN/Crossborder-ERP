from decimal import Decimal

from drf_spectacular.utils import extend_schema_field
from rest_framework import serializers

from apps.iam.models import AdminUser

from .models import (
    MemberProfile,
    PointLedger,
    PointTransactionType,
    RebateRecord,
    RebateStatus,
    ReferralRelation,
    ReferralStatus,
    User,
    UserStatus,
)


class RegisterSerializer(serializers.Serializer):
    email = serializers.EmailField()
    password = serializers.CharField(min_length=8, trim_whitespace=False)
    display_name = serializers.CharField(required=False, allow_blank=True)
    phone = serializers.CharField(required=False, allow_blank=True)
    referral_code = serializers.CharField(required=False, allow_blank=True)


class MemberLoginSerializer(serializers.Serializer):
    email = serializers.EmailField()
    password = serializers.CharField(trim_whitespace=False)


class MemberProfileSerializer(serializers.ModelSerializer):
    class Meta:
        model = MemberProfile
        fields = ["member_no", "display_name", "level", "warehouse_code"]


class AdminMemberProfileSerializer(serializers.ModelSerializer):
    assigned_admin_id = serializers.IntegerField(source="assigned_service_admin_id", read_only=True)
    assigned_admin_name = serializers.CharField(source="assigned_service_admin.name", read_only=True, allow_null=True)

    class Meta:
        model = MemberProfile
        fields = [
            "member_no",
            "display_name",
            "level",
            "warehouse_code",
            "assigned_admin_id",
            "assigned_admin_name",
            "service_note",
        ]


class UserSerializer(serializers.ModelSerializer):
    profile = MemberProfileSerializer(read_only=True)

    class Meta:
        model = User
        fields = ["id", "email", "phone", "status", "profile"]


class UpdateProfileSerializer(serializers.Serializer):
    display_name = serializers.CharField(required=False, allow_blank=True)
    phone = serializers.CharField(required=False, allow_blank=True)


class ChangePasswordSerializer(serializers.Serializer):
    current_password = serializers.CharField(trim_whitespace=False)
    new_password = serializers.CharField(min_length=8, trim_whitespace=False)

    def validate(self, attrs):
        if attrs["current_password"] == attrs["new_password"]:
            raise serializers.ValidationError({"new_password": ["新密码不能与当前密码相同"]})
        return attrs


class PasswordResetRequestSerializer(serializers.Serializer):
    email = serializers.EmailField()


class PasswordResetConfirmSerializer(serializers.Serializer):
    email = serializers.EmailField()
    token = serializers.CharField(trim_whitespace=False, max_length=200)
    new_password = serializers.CharField(min_length=8, trim_whitespace=False)


class AdminMemberServiceSummarySerializer(serializers.Serializer):
    ticket_count = serializers.IntegerField()
    open_ticket_count = serializers.IntegerField()
    last_ticket_at = serializers.DateTimeField(allow_null=True)


class AdminMemberSerializer(serializers.ModelSerializer):
    profile = AdminMemberProfileSerializer(read_only=True)
    service_summary = serializers.SerializerMethodField()

    class Meta:
        model = User
        fields = [
            "id",
            "email",
            "phone",
            "status",
            "last_login_at",
            "created_at",
            "updated_at",
            "profile",
            "service_summary",
        ]
        read_only_fields = fields

    @extend_schema_field(AdminMemberServiceSummarySerializer)
    def get_service_summary(self, obj: User) -> dict[str, object]:
        return {
            "ticket_count": getattr(obj, "ticket_count", 0),
            "open_ticket_count": getattr(obj, "open_ticket_count", 0),
            "last_ticket_at": getattr(obj, "last_ticket_at", None),
        }


class AdminMemberQuerySerializer(serializers.Serializer):
    keyword = serializers.CharField(required=False, allow_blank=True)
    status = serializers.ChoiceField(choices=UserStatus.choices, required=False)
    level = serializers.CharField(required=False, allow_blank=True)
    assigned_admin_id = serializers.IntegerField(required=False, min_value=1)


class AdminMemberUpdateSerializer(serializers.Serializer):
    display_name = serializers.CharField(required=False, allow_blank=True, max_length=100)
    phone = serializers.CharField(required=False, allow_blank=True, max_length=30)
    level = serializers.CharField(required=False, allow_blank=True, max_length=30)
    assigned_admin_id = serializers.IntegerField(required=False, allow_null=True, min_value=1)
    service_note = serializers.CharField(required=False, allow_blank=True)


class AdminMemberResetPasswordSerializer(serializers.Serializer):
    password = serializers.CharField(required=False, min_length=8, trim_whitespace=False)


class AdminSupportUserSerializer(serializers.ModelSerializer):
    class Meta:
        model = AdminUser
        fields = ["id", "email", "name"]


class GrowthSummarySerializer(serializers.Serializer):
    points_balance = serializers.IntegerField()
    referral_code = serializers.CharField()
    invited_count = serializers.IntegerField()
    active_invited_count = serializers.IntegerField()
    confirmed_reward_points = serializers.IntegerField()
    confirmed_rebate_amount = serializers.DecimalField(max_digits=12, decimal_places=2)
    pending_rebate_amount = serializers.DecimalField(max_digits=12, decimal_places=2)
    currency = serializers.CharField()
    points_rule_note = serializers.CharField()
    rebate_rule_note = serializers.CharField()


class PointLedgerSerializer(serializers.ModelSerializer):
    user_email = serializers.EmailField(source="user.email", read_only=True)
    operator_name = serializers.CharField(source="operator.name", read_only=True, allow_null=True)

    class Meta:
        model = PointLedger
        fields = [
            "id",
            "user",
            "user_email",
            "operator_name",
            "type",
            "direction",
            "points",
            "balance_after",
            "business_type",
            "business_id",
            "remark",
            "created_at",
        ]
        read_only_fields = fields


class ReferralRelationSerializer(serializers.ModelSerializer):
    inviter_email = serializers.EmailField(source="inviter.email", read_only=True)
    inviter_member_no = serializers.CharField(source="inviter.profile.member_no", read_only=True)
    invitee_email = serializers.EmailField(source="invitee.email", read_only=True)
    invitee_member_no = serializers.CharField(source="invitee.profile.member_no", read_only=True)
    created_by_admin_name = serializers.CharField(source="created_by_admin.name", read_only=True, allow_null=True)

    class Meta:
        model = ReferralRelation
        fields = [
            "id",
            "inviter",
            "inviter_email",
            "inviter_member_no",
            "invitee",
            "invitee_email",
            "invitee_member_no",
            "invitation_code",
            "status",
            "created_by_admin_name",
            "remark",
            "activated_at",
            "created_at",
            "updated_at",
        ]
        read_only_fields = fields


class RebateRecordSerializer(serializers.ModelSerializer):
    user_email = serializers.EmailField(source="user.email", read_only=True)
    invitee_email = serializers.EmailField(source="referral_relation.invitee.email", read_only=True, allow_null=True)
    created_by_admin_name = serializers.CharField(source="created_by_admin.name", read_only=True, allow_null=True)

    class Meta:
        model = RebateRecord
        fields = [
            "id",
            "user",
            "user_email",
            "referral_relation",
            "invitee_email",
            "amount",
            "reward_points",
            "currency",
            "status",
            "business_type",
            "business_id",
            "remark",
            "created_by_admin_name",
            "created_at",
            "updated_at",
        ]
        read_only_fields = fields


class AdminPointAdjustmentSerializer(serializers.Serializer):
    points_delta = serializers.IntegerField(min_value=-1_000_000, max_value=1_000_000)
    type = serializers.ChoiceField(
        choices=PointTransactionType.choices,
        required=False,
        default=PointTransactionType.MANUAL_ADJUSTMENT,
    )
    business_type = serializers.CharField(max_length=50, required=False, allow_blank=True)
    business_id = serializers.IntegerField(required=False, allow_null=True, min_value=1)
    remark = serializers.CharField(max_length=255, required=False, allow_blank=True)


class AdminReferralCreateSerializer(serializers.Serializer):
    inviter_id = serializers.IntegerField(min_value=1)
    invitee_id = serializers.IntegerField(min_value=1)
    invitation_code = serializers.CharField(max_length=40, required=False, allow_blank=True)
    status = serializers.ChoiceField(choices=ReferralStatus.choices, required=False, default=ReferralStatus.ACTIVE)
    remark = serializers.CharField(max_length=255, required=False, allow_blank=True)


class AdminRebateCreateSerializer(serializers.Serializer):
    referral_id = serializers.IntegerField(min_value=1)
    amount = serializers.DecimalField(
        max_digits=12,
        decimal_places=2,
        required=False,
        default=Decimal("0.00"),
        min_value=Decimal("0.00"),
    )
    reward_points = serializers.IntegerField(required=False, default=0, min_value=0)
    currency = serializers.CharField(max_length=10, required=False, default="CNY")
    status = serializers.ChoiceField(choices=RebateStatus.choices, required=False, default=RebateStatus.CONFIRMED)
    business_type = serializers.CharField(max_length=50, required=False, allow_blank=True)
    business_id = serializers.IntegerField(required=False, allow_null=True, min_value=1)
    remark = serializers.CharField(max_length=255, required=False, allow_blank=True)
