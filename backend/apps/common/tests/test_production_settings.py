"""Tests for production settings validation (PROD-SETTINGS-001)."""
import subprocess
import sys

from django.test import TestCase, override_settings


class ProductionSettingsValidationTest(TestCase):
    """Verify production settings enforce required configuration."""

    def _run_production_check(self, env_overrides: dict) -> subprocess.CompletedProcess:
        """Run Django check with production settings in a subprocess."""
        env = {
            "DJANGO_SETTINGS_MODULE": "config.settings.production",
            "PYTHONPATH": "",
            **env_overrides,
        }
        return subprocess.run(
            [sys.executable, "-c", "import django; django.setup()"],
            capture_output=True,
            text=True,
            env=env,
            cwd=str(__import__("pathlib").Path(__file__).resolve().parents[3]),
            timeout=15,
        )

    def test_production_rejects_dev_secret_key(self):
        result = self._run_production_check({
            "DJANGO_ALLOWED_HOSTS": "example.com",
        })
        self.assertNotEqual(result.returncode, 0)
        self.assertIn("DJANGO_SECRET_KEY", result.stderr)

    def test_production_rejects_default_allowed_hosts(self):
        result = self._run_production_check({
            "DJANGO_SECRET_KEY": "real-production-secret-at-least-32-bytes-long",
        })
        self.assertNotEqual(result.returncode, 0)
        self.assertIn("DJANGO_ALLOWED_HOSTS", result.stderr)

    def test_production_succeeds_with_valid_config(self):
        result = self._run_production_check({
            "DJANGO_SECRET_KEY": "real-production-secret-at-least-32-bytes-long",
            "DJANGO_ALLOWED_HOSTS": "example.com,api.example.com",
            "DJANGO_SECURE_SSL_REDIRECT": "false",
        })
        self.assertEqual(result.returncode, 0, f"stderr: {result.stderr}")


class ProductionSecurityDefaultsTest(TestCase):
    """Verify security defaults are correct."""

    def test_test_settings_include_localhost_in_allowed_hosts(self):
        from django.conf import settings
        self.assertIn("testserver", settings.ALLOWED_HOSTS)

    def test_base_password_validators_configured(self):
        from django.conf import settings
        validator_names = [v["NAME"] for v in settings.AUTH_PASSWORD_VALIDATORS]
        self.assertIn(
            "django.contrib.auth.password_validation.MinimumLengthValidator",
            validator_names,
        )
        self.assertIn(
            "django.contrib.auth.password_validation.CommonPasswordValidator",
            validator_names,
        )
