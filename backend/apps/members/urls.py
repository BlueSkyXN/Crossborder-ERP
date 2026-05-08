from django.urls import path

from .views import MemberLoginView, MemberLogoutView, MeProfileView, MeView, RegisterView

urlpatterns = [
    path("auth/register", RegisterView.as_view(), name="member-register"),
    path("auth/login", MemberLoginView.as_view(), name="member-login"),
    path("auth/logout", MemberLogoutView.as_view(), name="member-logout"),
    path("me", MeView.as_view(), name="member-me"),
    path("me/profile", MeProfileView.as_view(), name="member-profile"),
]
