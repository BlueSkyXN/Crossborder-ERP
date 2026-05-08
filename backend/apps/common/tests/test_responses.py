from apps.common.responses import error_response, success_response


def test_success_response_defaults_to_empty_data():
    response = success_response()

    assert response.status_code == 200
    assert response.data == {"code": "OK", "message": "success", "data": {}}


def test_error_response_shape():
    response = error_response(
        code="VALIDATION_ERROR",
        message="字段校验失败",
        data={"field_errors": {"name": ["不能为空"]}},
        status=400,
    )

    assert response.status_code == 400
    assert response.data == {
        "code": "VALIDATION_ERROR",
        "message": "字段校验失败",
        "data": {"field_errors": {"name": ["不能为空"]}},
    }
