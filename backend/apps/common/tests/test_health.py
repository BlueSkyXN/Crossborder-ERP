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
