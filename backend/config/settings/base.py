from pathlib import Path

import environ

BASE_DIR = Path(__file__).resolve().parents[2]
REPO_ROOT = BASE_DIR.parent

env = environ.Env(
    DJANGO_DEBUG=(bool, True),
    DJANGO_ALLOWED_HOSTS=(list, ["localhost", "127.0.0.1", "testserver"]),
)

for env_file in (REPO_ROOT / ".env", BASE_DIR / ".env"):
    if env_file.exists():
        environ.Env.read_env(env_file)

SECRET_KEY = env(
    "DJANGO_SECRET_KEY",
    default="dev-secret-change-in-real-env-please-keep-at-least-32-bytes",
)
DEBUG = env.bool("DJANGO_DEBUG", default=True)
ALLOWED_HOSTS = env.list(
    "DJANGO_ALLOWED_HOSTS",
    default=["localhost", "127.0.0.1", "testserver"],
)

SECURE_CONTENT_TYPE_NOSNIFF = env.bool("DJANGO_SECURE_CONTENT_TYPE_NOSNIFF", default=True)
SECURE_REFERRER_POLICY = env("DJANGO_SECURE_REFERRER_POLICY", default="same-origin")
SECURE_CROSS_ORIGIN_OPENER_POLICY = env(
    "DJANGO_SECURE_CROSS_ORIGIN_OPENER_POLICY",
    default="same-origin",
)
X_FRAME_OPTIONS = env("DJANGO_X_FRAME_OPTIONS", default="DENY")
PERMISSIONS_POLICY = env(
    "DJANGO_PERMISSIONS_POLICY",
    default="camera=(),microphone=(),geolocation=(),payment=(),usb=()",
)
SECURE_HSTS_SECONDS = env.int("DJANGO_SECURE_HSTS_SECONDS", default=0)
SECURE_HSTS_INCLUDE_SUBDOMAINS = env.bool(
    "DJANGO_SECURE_HSTS_INCLUDE_SUBDOMAINS",
    default=False,
)
SECURE_HSTS_PRELOAD = env.bool("DJANGO_SECURE_HSTS_PRELOAD", default=False)
SECURE_SSL_REDIRECT = env.bool("DJANGO_SECURE_SSL_REDIRECT", default=False)

INSTALLED_APPS = [
    "django.contrib.admin",
    "django.contrib.auth",
    "django.contrib.contenttypes",
    "django.contrib.sessions",
    "django.contrib.messages",
    "django.contrib.staticfiles",
    "rest_framework",
    "drf_spectacular",
    "apps.common",
    "apps.audit",
    "apps.iam",
    "apps.members",
    "apps.addresses",
    "apps.files",
    "apps.content",
    "apps.warehouses",
    "apps.parcels",
    "apps.waybills",
    "apps.finance",
    "apps.products",
    "apps.purchases",
    "apps.tickets",
]

MIDDLEWARE = [
    "django.middleware.security.SecurityMiddleware",
    "apps.common.middleware.PermissionsPolicyMiddleware",
    "django.contrib.sessions.middleware.SessionMiddleware",
    "django.middleware.common.CommonMiddleware",
    "django.middleware.csrf.CsrfViewMiddleware",
    "django.contrib.auth.middleware.AuthenticationMiddleware",
    "django.contrib.messages.middleware.MessageMiddleware",
    "django.middleware.clickjacking.XFrameOptionsMiddleware",
    "apps.audit.middleware.AdminAuditLogMiddleware",
]

ROOT_URLCONF = "config.urls"

TEMPLATES = [
    {
        "BACKEND": "django.template.backends.django.DjangoTemplates",
        "DIRS": [BASE_DIR / "templates"],
        "APP_DIRS": True,
        "OPTIONS": {
            "context_processors": [
                "django.template.context_processors.request",
                "django.contrib.auth.context_processors.auth",
                "django.contrib.messages.context_processors.messages",
            ],
        },
    },
]

WSGI_APPLICATION = "config.wsgi.application"
ASGI_APPLICATION = "config.asgi.application"

DATABASES = {
    "default": env.db(
        "DATABASE_URL",
        default=f"sqlite:///{BASE_DIR / 'db.sqlite3'}",
    )
}

AUTH_PASSWORD_VALIDATORS = [
    {"NAME": "django.contrib.auth.password_validation.UserAttributeSimilarityValidator"},
    {"NAME": "django.contrib.auth.password_validation.MinimumLengthValidator"},
    {"NAME": "django.contrib.auth.password_validation.CommonPasswordValidator"},
    {"NAME": "django.contrib.auth.password_validation.NumericPasswordValidator"},
]

LANGUAGE_CODE = "zh-hans"
TIME_ZONE = "Asia/Shanghai"
USE_I18N = True
USE_TZ = True

STATIC_URL = "static/"
STATIC_ROOT = BASE_DIR / "staticfiles"
MEDIA_URL = "media/"
MEDIA_ROOT = Path(env("MEDIA_ROOT", default=str(BASE_DIR / "media")))

DEFAULT_AUTO_FIELD = "django.db.models.BigAutoField"

REST_FRAMEWORK = {
    "DEFAULT_SCHEMA_CLASS": "drf_spectacular.openapi.AutoSchema",
    "EXCEPTION_HANDLER": "apps.common.exceptions.api_exception_handler",
    "DEFAULT_PAGINATION_CLASS": "apps.common.pagination.StandardPagination",
    "PAGE_SIZE": 20,
}

SPECTACULAR_SETTINGS = {
    "TITLE": "CrossBorder ERP API",
    "DESCRIPTION": "Cross-border purchasing and forwarding ERP API.",
    "VERSION": "0.1.0",
    "SERVE_INCLUDE_SCHEMA": False,
    "ENUM_NAME_OVERRIDES": {
        "ActiveDisabledStatusEnum": "apps.warehouses.models.ConfigStatus",
        "AuditOperatorTypeEnum": "apps.audit.models.AuditOperatorType",
        "UserStatusEnum": "apps.members.models.UserStatus",
        "PointTransactionTypeEnum": "apps.members.models.PointTransactionType",
        "PointTransactionDirectionEnum": "apps.members.models.PointTransactionDirection",
        "ReferralStatusEnum": "apps.members.models.ReferralStatus",
        "RebateStatusEnum": "apps.members.models.RebateStatus",
        "AddressTypeEnum": "apps.addresses.models.AddressType",
        "FileUsageEnum": "apps.files.models.FileUsage",
        "FileOwnerTypeEnum": "apps.files.models.FileOwnerType",
        "FileStatusEnum": "apps.files.models.FileStatus",
        "ParcelStatusEnum": "apps.parcels.models.ParcelStatus",
        "ParcelImportStatusEnum": "apps.parcels.models.ParcelImportStatus",
        "UnclaimedParcelStatusEnum": "apps.parcels.models.UnclaimedParcelStatus",
        "WaybillStatusEnum": "apps.waybills.models.WaybillStatus",
        "WalletTransactionTypeEnum": "apps.finance.models.WalletTransactionType",
        "WalletTransactionDirectionEnum": "apps.finance.models.WalletTransactionDirection",
        "PaymentOrderStatusEnum": "apps.finance.models.PaymentOrderStatus",
        "PaymentBusinessTypeEnum": "apps.finance.models.PaymentBusinessType",
        "RechargeRequestStatusEnum": "apps.finance.models.RechargeRequestStatus",
        "PayableStatusEnum": "apps.finance.models.PayableStatus",
        "PurchaseOrderStatusEnum": "apps.purchases.models.PurchaseOrderStatus",
        "PurchaseOrderSourceTypeEnum": "apps.purchases.models.PurchaseOrderSourceType",
        "ProcurementTaskStatusEnum": "apps.purchases.models.ProcurementTaskStatus",
        "TicketStatusEnum": "apps.tickets.models.TicketStatus",
        "TicketTypeEnum": "apps.tickets.models.TicketType",
        "ContentStatusEnum": "apps.content.models.ContentStatus",
        "ContentTypeEnum": "apps.content.models.ContentType",
    },
}

CACHES = {
    "default": {
        "BACKEND": "django.core.cache.backends.locmem.LocMemCache",
        "LOCATION": "crossborder-erp-local",
    }
}

CELERY_TASK_ALWAYS_EAGER = env.bool("CELERY_TASK_ALWAYS_EAGER", default=True)
CELERY_BROKER_URL = env("REDIS_URL", default="")
