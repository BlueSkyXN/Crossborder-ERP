from django.db import models
from django.utils import timezone


class AdminUserStatus(models.TextChoices):
    ACTIVE = "ACTIVE", "启用"
    DISABLED = "DISABLED", "停用"


class PermissionType(models.TextChoices):
    MENU = "MENU", "菜单"
    API = "API", "接口"
    BUTTON = "BUTTON", "按钮"


class AdminUser(models.Model):
    email = models.EmailField(unique=True)
    password_hash = models.CharField(max_length=255)
    name = models.CharField(max_length=100)
    status = models.CharField(
        max_length=20,
        choices=AdminUserStatus.choices,
        default=AdminUserStatus.ACTIVE,
    )
    is_super_admin = models.BooleanField(default=False)
    last_login_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "admin_users"
        ordering = ["id"]

    def __str__(self) -> str:
        return f"{self.email} ({self.name})"

    @property
    def is_active(self) -> bool:
        return self.status == AdminUserStatus.ACTIVE

    @property
    def is_authenticated(self) -> bool:
        return True


class Permission(models.Model):
    code = models.CharField(max_length=120, unique=True)
    name = models.CharField(max_length=100)
    type = models.CharField(max_length=20, choices=PermissionType.choices)
    resource = models.CharField(max_length=120, blank=True)
    sort_order = models.PositiveIntegerField(default=0)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "permissions"
        ordering = ["sort_order", "id"]

    def __str__(self) -> str:
        return self.code


class Role(models.Model):
    code = models.CharField(max_length=80, unique=True)
    name = models.CharField(max_length=100)
    description = models.TextField(blank=True)
    permissions = models.ManyToManyField(Permission, related_name="roles", blank=True)
    admin_users = models.ManyToManyField(AdminUser, related_name="roles", blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "roles"
        ordering = ["id"]

    def __str__(self) -> str:
        return self.code

    def has_permission(self, permission_code: str) -> bool:
        return self.permissions.filter(code=permission_code).exists()


def mark_admin_login(admin_user: AdminUser) -> None:
    AdminUser.objects.filter(id=admin_user.id).update(last_login_at=timezone.now())
