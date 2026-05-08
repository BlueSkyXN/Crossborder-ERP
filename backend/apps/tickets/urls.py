from django.urls import path

from .views import (
    AdminTicketCloseView,
    AdminTicketDetailView,
    AdminTicketListView,
    AdminTicketMarkProcessingView,
    AdminTicketReplyView,
    TicketDetailView,
    TicketListCreateView,
    TicketMessageCreateView,
)

urlpatterns = [
    path("tickets", TicketListCreateView.as_view(), name="ticket-list"),
    path("tickets/<int:ticket_id>", TicketDetailView.as_view(), name="ticket-detail"),
    path("tickets/<int:ticket_id>/messages", TicketMessageCreateView.as_view(), name="ticket-message-create"),
    path("admin/tickets", AdminTicketListView.as_view(), name="admin-ticket-list"),
    path("admin/tickets/<int:ticket_id>", AdminTicketDetailView.as_view(), name="admin-ticket-detail"),
    path(
        "admin/tickets/<int:ticket_id>/mark-processing",
        AdminTicketMarkProcessingView.as_view(),
        name="admin-ticket-mark-processing",
    ),
    path("admin/tickets/<int:ticket_id>/messages", AdminTicketReplyView.as_view(), name="admin-ticket-reply"),
    path("admin/tickets/<int:ticket_id>/close", AdminTicketCloseView.as_view(), name="admin-ticket-close"),
]
