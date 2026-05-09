import json
from io import StringIO

from django.core.management import call_command
from django.test import override_settings

from apps.common.configuration import (
    MYSQL_ENGINE,
    POSTGRES_ENGINE,
    SQLITE_ENGINE,
    build_database_config,
    describe_celery_config,
    describe_database_config,
    describe_redis_url,
)


def test_database_url_parsing_supports_sqlite_postgresql_and_mysql_without_connections(tmp_path):
    sqlite_config = build_database_config(None, tmp_path / "db.sqlite3")
    postgres_config = build_database_config("postgres://erp:secret@localhost:5432/crossborder", tmp_path / "db.sqlite3")
    mysql_config = build_database_config("mysql://erp:secret@localhost:3306/crossborder", tmp_path / "db.sqlite3")

    assert sqlite_config["ENGINE"] == SQLITE_ENGINE
    assert sqlite_config["NAME"].endswith("db.sqlite3")
    assert postgres_config == {
        "ENGINE": POSTGRES_ENGINE,
        "HOST": "localhost",
        "NAME": "crossborder",
        "PASSWORD": "secret",
        "PORT": 5432,
        "USER": "erp",
    }
    assert mysql_config == {
        "ENGINE": MYSQL_ENGINE,
        "HOST": "localhost",
        "NAME": "crossborder",
        "PASSWORD": "secret",
        "PORT": 3306,
        "USER": "erp",
    }


def test_configuration_descriptions_keep_unverified_boundaries():
    assert describe_database_config({"ENGINE": SQLITE_ENGINE})["status"] == "verified_sqlite"
    assert describe_database_config({"ENGINE": POSTGRES_ENGINE})["status"] == "configured_unverified"
    assert describe_database_config({"ENGINE": MYSQL_ENGINE})["status"] == "configured_unverified"
    assert describe_redis_url("") == {
        "configured": False,
        "scheme": "",
        "status": "not_configured",
    }
    assert describe_redis_url("redis://localhost:6379/0") == {
        "configured": True,
        "scheme": "redis",
        "status": "configured_unverified",
    }
    assert describe_celery_config(True, "") == {
        "always_eager": True,
        "broker_configured": False,
        "broker_scheme": "",
        "status": "verified_eager",
    }
    assert describe_celery_config(False, "redis://localhost:6379/0") == {
        "always_eager": False,
        "broker_configured": True,
        "broker_scheme": "redis",
        "status": "configured_unverified",
    }


@override_settings(
    DATABASES={
        "default": {
            "ENGINE": POSTGRES_ENGINE,
            "NAME": "crossborder",
            "USER": "erp",
            "PASSWORD": "secret",
            "HOST": "localhost",
            "PORT": 5432,
        }
    },
    CELERY_BROKER_URL="redis://localhost:6379/0",
    CELERY_TASK_ALWAYS_EAGER=False,
)
def test_inspect_configured_services_reports_without_external_connections():
    stdout = StringIO()

    call_command("inspect_configured_services", format="json", stdout=stdout)

    payload = json.loads(stdout.getvalue())
    assert payload["database"] == {
        "engine": POSTGRES_ENGINE,
        "status": "configured_unverified",
    }
    assert payload["redis"] == {
        "configured": True,
        "scheme": "redis",
        "status": "configured_unverified",
    }
    assert payload["celery"] == {
        "always_eager": False,
        "broker_configured": True,
        "broker_scheme": "redis",
        "status": "configured_unverified",
    }
    assert payload["external_connections_opened"] is False
