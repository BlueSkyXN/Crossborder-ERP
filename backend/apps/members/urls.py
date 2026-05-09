from django.urls import path

from .views import (
    AdminMemberDetailView,
    AdminMemberFreezeView,
    AdminMemberListView,
    AdminMemberResetPasswordView,
    AdminMemberUnfreezeView,
    AdminSupportUserListView,
    MemberLoginView,
    MemberLogoutView,
    MeProfileView,
    MeView,
    RegisterView,
)

urlpatterns = [
    path("auth/register", RegisterView.as_view(), name="member-register"),
    path("auth/login", MemberLoginView.as_view(), name="member-login"),
    path("auth/logout", MemberLogoutView.as_view(), name="member-logout"),
    path("me", MeView.as_view(), name="member-me"),
    path("me/profile", MeProfileView.as_view(), name="member-profile"),
    path("admin/members", AdminMemberListView.as_view(), name="admin-members"),
    path("admin/members/<int:user_id>", AdminMemberDetailView.as_view(), name="admin-member-detail"),
    path("admin/members/<int:user_id>/freeze", AdminMemberFreezeView.as_view(), name="admin-member-freeze"),
    path("admin/members/<int:user_id>/unfreeze", AdminMemberUnfreezeView.as_view(), name="admin-member-unfreeze"),
    path(
        "admin/members/<int:user_id>/reset-password",
        AdminMemberResetPasswordView.as_view(),
        name="admin-member-reset-password",
    ),
    path("admin/member-service-admins", AdminSupportUserListView.as_view(), name="admin-member-service-admins"),
]
