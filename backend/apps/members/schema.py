from drf_spectacular.extensions import OpenApiAuthenticationExtension


class MemberTokenAuthenticationScheme(OpenApiAuthenticationExtension):
    target_class = "apps.members.authentication.MemberTokenAuthentication"
    name = "MemberBearerAuth"

    def get_security_definition(self, auto_schema):
        return {
            "type": "http",
            "scheme": "bearer",
            "bearerFormat": "JWT",
            "description": "Member API access token issued by /api/v1/auth/login.",
        }
