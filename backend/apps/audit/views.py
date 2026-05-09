from django.http import HttpResponse
from drf_spectacular.types import OpenApiTypes
from drf_spectacular.utils import extend_schema
from rest_framework.views import APIView

from apps.common.pagination import StandardPagination
from apps.common.responses import success_response
from apps.iam.authentication import AdminTokenAuthentication
from apps.iam.permissions import HasAdminPermission

from .serializers import AuditLogSerializer
from .services import export_audit_logs_csv, list_audit_logs


class AdminAuditLogListView(APIView):
    authentication_classes = [AdminTokenAuthentication]
    permission_classes = [HasAdminPermission]
    required_permission = "audit.logs.view"

    @extend_schema(tags=["admin-audit"], responses={200: AuditLogSerializer(many=True)})
    def get(self, request):
        logs = list_audit_logs(request.query_params)
        paginator = StandardPagination()
        page = paginator.paginate_queryset(logs, request)
        if page is not None:
            return paginator.get_paginated_response(AuditLogSerializer(page, many=True).data)
        return success_response({"items": AuditLogSerializer(logs, many=True).data})


class AdminAuditLogExportView(APIView):
    authentication_classes = [AdminTokenAuthentication]
    permission_classes = [HasAdminPermission]
    required_permission = "audit.logs.view"
    method_permissions = {"GET": "audit.logs.export"}

    @extend_schema(tags=["admin-audit"], responses={200: OpenApiTypes.BINARY})
    def get(self, request):
        response = HttpResponse(export_audit_logs_csv(request.query_params), content_type="text/csv; charset=utf-8")
        response["Content-Disposition"] = 'attachment; filename="audit-logs-export.csv"'
        return response
