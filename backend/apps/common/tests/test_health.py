import pytest
from django.urls import reverse

from apps.common import views


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


@pytest.mark.django_db
def test_readiness_response_shape(client):
    response = client.get(reverse("readiness"))

    assert response.status_code == 200
    assert response.json() == {
        "code": "OK",
        "message": "success",
        "data": {
            "status": "ok",
            "service": "crossborder-erp-backend",
            "checks": {
                "database": "ok",
            },
        },
    }


@pytest.mark.django_db
def test_readiness_returns_503_without_sensitive_details(client, monkeypatch):
    monkeypatch.setattr(views, "check_database_ready", lambda: False)

    response = client.get(reverse("readiness"))

    assert response.status_code == 503
    assert response.json() == {
        "code": "SERVICE_UNAVAILABLE",
        "message": "service unavailable",
        "data": {
            "status": "unavailable",
            "service": "crossborder-erp-backend",
            "checks": {
                "database": "unavailable",
            },
        },
    }
