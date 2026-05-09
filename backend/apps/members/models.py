from django.db import models


class UserStatus(models.TextChoices):
    ACTIVE = "ACTIVE", "启用"
    FROZEN = "FROZEN", "冻结"


class User(models.Model):
    email = models.EmailField(unique=True)
    phone = models.CharField(max_length=30, blank=True)
    password_hash = models.CharField(max_length=255)
    status = models.CharField(max_length=20, choices=UserStatus.choices, default=UserStatus.ACTIVE)
    last_login_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "users"
        ordering = ["id"]

    def __str__(self) -> str:
        return self.email

    @property
    def is_active(self) -> bool:
        return self.status == UserStatus.ACTIVE

    @property
    def is_authenticated(self) -> bool:
        return True


class MemberProfile(models.Model):
    user = models.OneToOneField(User, on_delete=models.CASCADE, related_name="profile")
    member_no = models.CharField(max_length=30, unique=True)
    display_name = models.CharField(max_length=100, blank=True)
    level = models.CharField(max_length=30, default="basic")
    warehouse_code = models.CharField(max_length=30, unique=True)
    assigned_service_admin = models.ForeignKey(
        "iam.AdminUser",
        on_delete=models.SET_NULL,
        related_name="assigned_member_profiles",
        null=True,
        blank=True,
    )
    service_note = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "member_profiles"
        ordering = ["id"]

    def __str__(self) -> str:
        return self.member_no
