from django.urls import path

from .views import AddressDetailView, AddressListCreateView, AddressSetDefaultView

urlpatterns = [
    path("addresses", AddressListCreateView.as_view(), name="address-list"),
    path("addresses/<int:address_id>", AddressDetailView.as_view(), name="address-detail"),
    path("addresses/<int:address_id>/set-default", AddressSetDefaultView.as_view(), name="address-set-default"),
]
