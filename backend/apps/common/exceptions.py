from typing import Any

from django.http import Http404
from rest_framework import exceptions, status
from rest_framework.views import exception_handler

from .responses import error_response


ERROR_CODE_BY_EXCEPTION = {
    exceptions.NotAuthenticated: "UNAUTHORIZED",
    exceptions.AuthenticationFailed: "UNAUTHORIZED",
    exceptions.PermissionDenied: "FORBIDDEN",
    exceptions.NotFound: "NOT_FOUND",
    exceptions.ValidationError: "VALIDATION_ERROR",
    exceptions.APIException: "BUSINESS_ERROR",
}


def _normalize_error_data(detail: Any) -> dict[str, Any]:
    if isinstance(detail, dict):
        return {"field_errors": detail}
    if isinstance(detail, list):
        return {"errors": detail}
    if detail:
        return {"detail": str(detail)}
    return {}


def _resolve_error_code(exc: Exception) -> str:
    for exc_type, code in ERROR_CODE_BY_EXCEPTION.items():
        if isinstance(exc, exc_type):
            return code
    if isinstance(exc, Http404):
        return "NOT_FOUND"
    return "INTERNAL_ERROR"


def api_exception_handler(exc: Exception, context: dict[str, Any]):
    response = exception_handler(exc, context)
    if response is None:
        return error_response(
            code="INTERNAL_ERROR",
            message="服务端错误",
            status=status.HTTP_500_INTERNAL_SERVER_ERROR,
        )

    code = _resolve_error_code(exc)
    detail = getattr(exc, "detail", response.data)
    if code == "VALIDATION_ERROR":
        message = "字段校验失败"
    else:
        message = str(detail) if isinstance(detail, str) else response.status_text

    return error_response(
        code=code,
        message=message,
        data=_normalize_error_data(detail),
        status=response.status_code,
    )
