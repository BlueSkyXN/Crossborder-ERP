from rest_framework import serializers

from .models import AdminUser, Permission, Role


class AdminLoginSerializer(serializers.Serializer):
    email = serializers.EmailField()
    password = serializers.CharField(trim_whitespace=False)


class AdminUserSerializer(serializers.ModelSerializer):
    roles = serializers.SlugRelatedField(many=True, read_only=True, slug_field="code")
    permission_codes = serializers.SerializerMethodField()

    class Meta:
        model = AdminUser
        fields = ["id", "email", "name", "status", "is_super_admin", "roles", "permission_codes"]

    def get_permission_codes(self, admin_user: AdminUser) -> list[str]:
        from .services import get_admin_permission_codes

        return sorted(get_admin_permission_codes(admin_user))


class PermissionSerializer(serializers.ModelSerializer):
    class Meta:
        model = Permission
        fields = ["id", "code", "name", "type", "resource"]


class RoleSerializer(serializers.ModelSerializer):
    permissions = PermissionSerializer(many=True, read_only=True)
    permission_codes = serializers.SerializerMethodField()

    class Meta:
        model = Role
        fields = ["id", "code", "name", "description", "permissions", "permission_codes"]

    def get_permission_codes(self, role: Role) -> list[str]:
        return [permission.code for permission in role.permissions.all()]


class RoleWriteSerializer(serializers.Serializer):
    code = serializers.RegexField(
        regex=r"^[a-z][a-z0-9_]{2,79}$",
        required=False,
        error_messages={"invalid": "角色编码只能使用小写字母、数字和下划线，且必须以字母开头"},
    )
    name = serializers.CharField(max_length=100)
    description = serializers.CharField(allow_blank=True, required=False, default="")
    permission_codes = serializers.ListField(
        child=serializers.CharField(max_length=120),
        allow_empty=False,
    )

    def validate_code(self, value: str) -> str:
        if self.instance is not None:
            return self.instance.code
        if Role.objects.filter(code=value).exists():
            raise serializers.ValidationError("角色编码已存在")
        return value

    def validate_permission_codes(self, value: list[str]) -> list[str]:
        seen = set()
        codes = []
        for code in value:
            if code in seen:
                continue
            seen.add(code)
            codes.append(code)

        existing_codes = set(Permission.objects.filter(code__in=codes).values_list("code", flat=True))
        missing = sorted(set(codes) - existing_codes)
        if missing:
            raise serializers.ValidationError(f"权限不存在：{', '.join(missing)}")
        return codes

    def validate(self, attrs):
        if self.instance is None and not attrs.get("code"):
            raise serializers.ValidationError({"code": "创建角色时必须提供角色编码"})
        return attrs
