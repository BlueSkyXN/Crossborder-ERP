from django.urls import reverse


def test_health_response_shape(client):
    response = client.get(reverse("health"))

    assert response.status_code == 200
    assert response.json() == {
        "code": "OK",
        "message": "success",
        "data": {
            "status": "ok",
            "service": "crossborder-erp-backend",
        },
    }


def test_health_security_headers(client):
    response = client.get(reverse("health"))

    assert response["X-Content-Type-Options"] == "nosniff"
    assert response["Referrer-Policy"] == "same-origin"
    assert response["Cross-Origin-Opener-Policy"] == "same-origin"
    assert response["X-Frame-Options"] == "DENY"
    assert response["Permissions-Policy"] == (
        "camera=(),microphone=(),geolocation=(),payment=(),usb=()"
    )
