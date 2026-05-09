from django.db import DEFAULT_DB_ALIAS, connections
from drf_spectacular.utils import extend_schema
from rest_framework.views import APIView

from .responses import error_response, success_response


def check_database_ready() -> bool:
    try:
        with connections[DEFAULT_DB_ALIAS].cursor() as cursor:
            cursor.execute("SELECT 1")
            cursor.fetchone()
        return True
    except Exception:
        return False


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


class ReadinessView(APIView):
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
            },
            503: {
                "type": "object",
                "properties": {
                    "code": {"type": "string"},
                    "message": {"type": "string"},
                    "data": {"type": "object"},
                },
            },
        },
    )
    def get(self, request):
        database_ready = check_database_ready()
        data = {
            "status": "ok" if database_ready else "unavailable",
            "service": "crossborder-erp-backend",
            "checks": {
                "database": "ok" if database_ready else "unavailable",
            },
        }
        if database_ready:
            return success_response(data)
        return error_response(
            code="SERVICE_UNAVAILABLE",
            message="service unavailable",
            data=data,
            status=503,
        )
