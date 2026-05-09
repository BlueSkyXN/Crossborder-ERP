from django.contrib import admin
from django.urls import include, path
from drf_spectacular.views import SpectacularAPIView, SpectacularSwaggerView

urlpatterns = [
    path("admin/", admin.site.urls),
    path("api/v1/", include("apps.common.urls")),
    path("api/v1/", include("apps.audit.urls")),
    path("api/v1/", include("apps.iam.urls")),
    path("api/v1/", include("apps.members.urls")),
    path("api/v1/", include("apps.addresses.urls")),
    path("api/v1/", include("apps.files.urls")),
    path("api/v1/", include("apps.content.urls")),
    path("api/v1/", include("apps.warehouses.urls")),
    path("api/v1/", include("apps.parcels.urls")),
    path("api/v1/", include("apps.waybills.urls")),
    path("api/v1/", include("apps.finance.urls")),
    path("api/v1/", include("apps.products.urls")),
    path("api/v1/", include("apps.purchases.urls")),
    path("api/v1/", include("apps.tickets.urls")),
    path("api/v1/", include("apps.regions.urls")),
    path("api/v1/schema/", SpectacularAPIView.as_view(), name="schema"),
    path("api/v1/docs/", SpectacularSwaggerView.as_view(url_name="schema"), name="swagger-ui"),
]
