from drf_spectacular.utils import extend_schema
from rest_framework.views import APIView

from .responses import success_response


class HealthView(APIView):
    authentication_classes = []
    permission_classes = []

    @extend_schema(
        tags=["system"],
        responses={
            200: {
                "type": "object",
                "properties": {
                    "code": {"type": "string"},
                    "message": {"type": "string"},
                    "data": {"type": "object"},
                },
            }
        },
    )
    def get(self, request):
        return success_response(
            {
                "status": "ok",
                "service": "crossborder-erp-backend",
            }
        )
