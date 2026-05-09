from .services import create_audit_log_from_request, get_request_data, should_audit_request


class AdminAuditLogMiddleware:
    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        should_audit = should_audit_request(request)
        if should_audit:
            try:
                request._audit_request_data = get_request_data(request)
            except Exception:
                request._audit_request_data = {"_unavailable": True}
        response = self.get_response(request)
        if should_audit:
            try:
                create_audit_log_from_request(request, response)
            except Exception:
                # 审计写入不能影响主业务请求；异常由后续日志系统接管。
                pass
        return response
