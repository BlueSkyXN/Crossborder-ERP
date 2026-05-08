from rest_framework import serializers

from .models import AdminUser, Permission, Role


class AdminLoginSerializer(serializers.Serializer):
    email = serializers.EmailField()
    password = serializers.CharField(trim_whitespace=False)


class AdminUserSerializer(serializers.ModelSerializer):
    roles = serializers.SlugRelatedField(many=True, read_only=True, slug_field="code")

    class Meta:
        model = AdminUser
        fields = ["id", "email", "name", "status", "is_super_admin", "roles"]


class PermissionSerializer(serializers.ModelSerializer):
    class Meta:
        model = Permission
        fields = ["id", "code", "name", "type", "resource"]


class RoleSerializer(serializers.ModelSerializer):
    permissions = PermissionSerializer(many=True, read_only=True)

    class Meta:
        model = Role
        fields = ["id", "code", "name", "description", "permissions"]
