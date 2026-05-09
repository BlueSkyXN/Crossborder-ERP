from drf_spectacular.utils import extend_schema_field
from rest_framework import serializers

from apps.iam.models import AdminUser

from .models import MemberProfile, User, UserStatus


class RegisterSerializer(serializers.Serializer):
    email = serializers.EmailField()
    password = serializers.CharField(min_length=8, trim_whitespace=False)
    display_name = serializers.CharField(required=False, allow_blank=True)
    phone = serializers.CharField(required=False, allow_blank=True)


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
