from __future__ import annotations

import json
from decimal import Decimal
from typing import Any

from django.db.models import QuerySet
from rest_framework_simplejwt.exceptions import TokenError
from rest_framework_simplejwt.tokens import AccessToken

from apps.iam.models import AdminUser
from apps.iam.services import ADMIN_TOKEN_SCOPE

from .models import AuditLog, AuditOperatorType


SENSITIVE_KEYS = {
    "access_token",
    "authorization",
    "new_password",
    "old_password",
    "password",
    "refresh",
    "token",
}
MAX_STRING_LENGTH = 512
MAX_LIST_ITEMS = 40
MAX_DICT_ITEMS = 80
ADMIN_MUTATION_METHODS = {"POST", "PUT", "PATCH", "DELETE"}


def should_audit_request(request) -> bool:
    path = getattr(request, "path_info", getattr(request, "path", ""))
    return (
        request.method in ADMIN_MUTATION_METHODS
        and path.startswith("/api/v1/admin/")
        and not path.startswith("/api/v1/admin/audit-logs")
    )


def resolve_admin_from_request(request) -> AdminUser | None:
    header = request.META.get("HTTP_AUTHORIZATION", "")
    parts = header.split()
    if len(parts) != 2 or parts[0] != "Bearer":
        return None
    try:
        token = AccessToken(parts[1])
    except TokenError:
        return None
    if token.get("token_scope") != ADMIN_TOKEN_SCOPE:
        return None
    admin_user_id = token.get("admin_user_id")
    if not admin_user_id:
        return None
    return AdminUser.objects.filter(id=admin_user_id).first()


def sanitize_data(value: Any, *, drop_sensitive: bool = False) -> Any:
    if isinstance(value, dict):
        sanitized: dict[str, Any] = {}
        for index, (key, item) in enumerate(value.items()):
            if index >= MAX_DICT_ITEMS:
                sanitized["_truncated"] = True
                break
            normalized_key = str(key)
            if normalized_key.lower() in SENSITIVE_KEYS:
                if not drop_sensitive:
                    sanitized[normalized_key] = "***REDACTED***"
            else:
                sanitized[normalized_key] = sanitize_data(item, drop_sensitive=drop_sensitive)
        return sanitized
    if isinstance(value, (list, tuple)):
        items = [sanitize_data(item, drop_sensitive=drop_sensitive) for item in list(value)[:MAX_LIST_ITEMS]]
        if len(value) > MAX_LIST_ITEMS:
            items.append({"_truncated": True})
        return items
    if isinstance(value, Decimal):
        return str(value)
    if isinstance(value, (str, int, float, bool)) or value is None:
        if isinstance(value, str) and len(value) > MAX_STRING_LENGTH:
            return f"{value[:MAX_STRING_LENGTH]}..."
        return value
    return str(value)


def get_request_data(request) -> dict[str, Any]:
    content_type = request.META.get("CONTENT_TYPE", "")
    if "application/json" in content_type:
        body = getattr(request, "body", b"")
        if not body:
            return {}
        try:
            parsed = json.loads(body.decode(request.encoding or "utf-8"))
        except (UnicodeDecodeError, json.JSONDecodeError):
            return {"_unparsed": True}
        return sanitize_data(parsed if isinstance(parsed, dict) else {"value": parsed})
    if request.POST:
        payload = {}
        for key in request.POST.keys():
            values = request.POST.getlist(key)
            payload[key] = values[0] if len(values) == 1 else values
        return sanitize_data(payload)
    if request.FILES:
        return {
            "files": [
                {"name": uploaded.name, "size": uploaded.size, "content_type": uploaded.content_type}
                for uploaded in request.FILES.values()
            ]
        }
    return {}


def get_response_data(response) -> dict[str, Any]:
    data = getattr(response, "data", None)
    if data is None:
        return {}
    return sanitize_data(data if isinstance(data, dict) else {"value": data}, drop_sensitive=True)


def get_client_ip(request) -> str:
    forwarded = request.META.get("HTTP_X_FORWARDED_FOR", "")
    if forwarded:
        return forwarded.split(",")[0].strip()
    return request.META.get("REMOTE_ADDR", "")


def resolve_target_from_path(path: str) -> tuple[str, str]:
    segments = [segment for segment in path.strip("/").split("/") if segment]
    try:
        admin_index = segments.index("admin")
    except ValueError:
        return "", ""
    parts = segments[admin_index + 1 :]
    if not parts:
        return "admin", ""
    target_type = parts[0]
    if target_type == "growth" and len(parts) > 1:
        target_type = f"{parts[0]}/{parts[1]}"
        id_candidates = parts[2:]
    else:
        id_candidates = parts[1:]
    target_id = ""
    for candidate in id_candidates:
        if candidate.isdigit():
            target_id = candidate
            break
    return target_type.replace("-", "_"), target_id


def resolve_action(request) -> str:
    resolver_match = getattr(request, "resolver_match", None)
    if resolver_match and resolver_match.url_name:
        return resolver_match.url_name
    return f"{request.method} {getattr(request, 'path_info', request.path)}"


def create_audit_log_from_request(request, response) -> AuditLog:
    path = getattr(request, "path_info", getattr(request, "path", ""))
    admin_user = resolve_admin_from_request(request)
    target_type, target_id = resolve_target_from_path(path)
    operator_type = AuditOperatorType.ADMIN if admin_user else AuditOperatorType.SYSTEM
    request_data = getattr(request, "_audit_request_data", None)
    if request_data is None:
        request_data = get_request_data(request)
    return AuditLog.objects.create(
        operator_type=operator_type,
        operator_id=admin_user.id if admin_user else None,
        operator_label=(admin_user.email if admin_user else "system"),
        action=resolve_action(request),
        target_type=target_type,
        target_id=target_id,
        request_method=request.method,
        request_path=path,
        status_code=getattr(response, "status_code", 0) or 0,
        ip_address=get_client_ip(request),
        user_agent=request.META.get("HTTP_USER_AGENT", "")[:255],
        request_data=request_data,
        response_data=get_response_data(response),
    )


def log_audit_event(
    *,
    action: str,
    module: str = "",
    actor_admin: AdminUser | None = None,
    actor_member=None,
    target_type: str = "",
    target_id: int | str | None = None,
    target_repr: str = "",
    result: str = "SUCCESS",
    metadata: dict[str, Any] | None = None,
) -> AuditLog:
    # 服务层审计用于事务内关键业务动作；字段复用请求级审计表，避免两套审计结构并存。
    if actor_admin and actor_member:
        raise ValueError("audit event can only have one actor")

    operator_type = AuditOperatorType.ADMIN if actor_admin else AuditOperatorType.UNKNOWN
    operator_id = actor_admin.id if actor_admin else None
    operator_label = actor_admin.email if actor_admin else "service"
    request_data = sanitize_data(metadata or {})
    response_data = sanitize_data(
        {
            "module": module,
            "result": result,
            "target_repr": target_repr,
        }
    )
    return AuditLog.objects.create(
        operator_type=operator_type,
        operator_id=operator_id,
        operator_label=operator_label,
        action=action,
        target_type=target_type,
        target_id="" if target_id is None else str(target_id),
        request_method="SERVICE",
        request_path=f"service://{module or 'unknown'}/{action}",
        status_code=200 if result == "SUCCESS" else 500,
        request_data=request_data,
        response_data=response_data,
    )


def list_audit_logs(params) -> QuerySet[AuditLog]:
    logs = AuditLog.objects.all()
    action = params.get("action", "").strip()
    target_type = params.get("target_type", "").strip()
    operator_id = params.get("operator_id", "").strip()
    method = params.get("method", "").strip().upper()
    keyword = params.get("keyword", "").strip()
    if action:
        logs = logs.filter(action__icontains=action)
    if target_type:
        logs = logs.filter(target_type=target_type)
    if operator_id:
        logs = logs.filter(operator_id=operator_id)
    if method:
        logs = logs.filter(request_method=method)
    if keyword:
        logs = logs.filter(request_path__icontains=keyword) | logs.filter(operator_label__icontains=keyword)
    return logs
