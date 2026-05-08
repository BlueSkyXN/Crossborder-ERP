from drf_spectacular.extensions import OpenApiAuthenticationExtension


class AdminTokenAuthenticationScheme(OpenApiAuthenticationExtension):
    target_class = "apps.iam.authentication.AdminTokenAuthentication"
    name = "AdminBearerAuth"

    def get_security_definition(self, auto_schema):
        return {
            "type": "http",
            "scheme": "bearer",
            "bearerFormat": "JWT",
            "description": "Admin API access token issued by /api/v1/admin/auth/login.",
        }
