from typing import Any

from rest_framework.response import Response


def success_response(data: Any = None, message: str = "success", status: int = 200) -> Response:
    return Response(
        {
            "code": "OK",
            "message": message,
            "data": {} if data is None else data,
        },
        status=status,
    )


def error_response(
    code: str,
    message: str,
    data: Any = None,
    status: int = 400,
) -> Response:
    return Response(
        {
            "code": code,
            "message": message,
            "data": {} if data is None else data,
        },
        status=status,
    )
