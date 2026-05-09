import importlib

from django.conf import settings

from apps.common.throttles import LoginRateThrottle
from config.settings import base as base_settings


def test_login_rate_throttle_class_exists_and_has_login_scope():
    assert LoginRateThrottle.scope == "login"


def test_base_settings_configure_login_throttle_rate():
    reloaded_base_settings = importlib.reload(base_settings)

    assert reloaded_base_settings.REST_FRAMEWORK["DEFAULT_THROTTLE_RATES"]["login"] == "10/minute"
    assert "rest_framework.throttling.AnonRateThrottle" in reloaded_base_settings.REST_FRAMEWORK["DEFAULT_THROTTLE_CLASSES"]
    assert "rest_framework.throttling.UserRateThrottle" in reloaded_base_settings.REST_FRAMEWORK["DEFAULT_THROTTLE_CLASSES"]


def test_throttling_is_disabled_in_test_settings():
    assert settings.REST_FRAMEWORK["DEFAULT_THROTTLE_CLASSES"] == []
    assert settings.REST_FRAMEWORK["DEFAULT_THROTTLE_RATES"].get("anon") is None
    assert settings.REST_FRAMEWORK["DEFAULT_THROTTLE_RATES"].get("user") is None
