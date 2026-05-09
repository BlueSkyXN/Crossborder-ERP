from drf_spectacular.utils import extend_schema
from rest_framework import status
from rest_framework.views import APIView

from apps.common.responses import error_response, success_response
from apps.iam.authentication import AdminTokenAuthentication
from apps.iam.permissions import HasAdminPermission
from apps.members.authentication import MemberTokenAuthentication
from apps.members.permissions import IsMemberAuthenticated

from .serializers import (
    TicketCloseSerializer,
    TicketCreateSerializer,
    TicketMessageCreateSerializer,
    TicketSerializer,
)
from .services import (
    TicketStateConflictError,
    add_admin_reply,
    add_member_message,
    close_ticket,
    create_ticket,
    get_admin_ticket,
    get_member_ticket,
    mark_ticket_processing,
    ticket_queryset,
)


def ticket_state_conflict_response(exc: TicketStateConflictError):
    return error_response("STATE_CONFLICT", str(exc), status=status.HTTP_409_CONFLICT)


class TicketListCreateView(APIView):
    authentication_classes = [MemberTokenAuthentication]
    permission_classes = [IsMemberAuthenticated]

    @extend_schema(tags=["tickets"], responses={200: TicketSerializer(many=True)})
    def get(self, request):
        tickets = ticket_queryset().filter(user=request.user)
        return success_response(
            {"items": TicketSerializer(tickets, many=True, context={"scope": "member"}).data}
        )

    @extend_schema(tags=["tickets"], request=TicketCreateSerializer, responses={201: TicketSerializer})
    def post(self, request):
        serializer = TicketCreateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        ticket = create_ticket(user=request.user, **serializer.validated_data)
        return success_response(
            TicketSerializer(ticket, context={"scope": "member"}).data,
            status=status.HTTP_201_CREATED,
        )


class TicketDetailView(APIView):
    authentication_classes = [MemberTokenAuthentication]
    permission_classes = [IsMemberAuthenticated]

    @extend_schema(tags=["tickets"], responses={200: TicketSerializer})
    def get(self, request, ticket_id: int):
        return success_response(
            TicketSerializer(get_member_ticket(user=request.user, ticket_id=ticket_id), context={"scope": "member"}).data
        )


class TicketMessageCreateView(APIView):
    authentication_classes = [MemberTokenAuthentication]
    permission_classes = [IsMemberAuthenticated]

    @extend_schema(tags=["tickets"], request=TicketMessageCreateSerializer, responses={201: TicketSerializer})
    def post(self, request, ticket_id: int):
        serializer = TicketMessageCreateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        ticket = get_member_ticket(user=request.user, ticket_id=ticket_id)
        try:
            ticket = add_member_message(ticket=ticket, user=request.user, **serializer.validated_data)
        except TicketStateConflictError as exc:
            return ticket_state_conflict_response(exc)
        return success_response(
            TicketSerializer(ticket, context={"scope": "member"}).data,
            status=status.HTTP_201_CREATED,
        )


class AdminTicketListView(APIView):
    authentication_classes = [AdminTokenAuthentication]
    permission_classes = [HasAdminPermission]
    required_permission = "tickets.view"

    @extend_schema(tags=["admin-tickets"], responses={200: TicketSerializer(many=True)})
    def get(self, request):
        tickets = ticket_queryset()
        return success_response(
            {"items": TicketSerializer(tickets, many=True, context={"scope": "admin"}).data}
        )


class AdminTicketDetailView(APIView):
    authentication_classes = [AdminTokenAuthentication]
    permission_classes = [HasAdminPermission]
    required_permission = "tickets.view"

    @extend_schema(tags=["admin-tickets"], responses={200: TicketSerializer})
    def get(self, request, ticket_id: int):
        return success_response(
            TicketSerializer(get_admin_ticket(ticket_id=ticket_id), context={"scope": "admin"}).data
        )


class AdminTicketMarkProcessingView(APIView):
    authentication_classes = [AdminTokenAuthentication]
    permission_classes = [HasAdminPermission]
    required_permission = "tickets.view"
    write_permission = "tickets.manage"

    @extend_schema(tags=["admin-tickets"], request=None, responses={200: TicketSerializer})
    def post(self, request, ticket_id: int):
        ticket = get_admin_ticket(ticket_id=ticket_id)
        try:
            ticket = mark_ticket_processing(ticket=ticket, operator=request.user)
        except TicketStateConflictError as exc:
            return ticket_state_conflict_response(exc)
        return success_response(TicketSerializer(ticket, context={"scope": "admin"}).data)


class AdminTicketReplyView(APIView):
    authentication_classes = [AdminTokenAuthentication]
    permission_classes = [HasAdminPermission]
    required_permission = "tickets.view"
    write_permission = "tickets.manage"

    @extend_schema(tags=["admin-tickets"], request=TicketMessageCreateSerializer, responses={200: TicketSerializer})
    def post(self, request, ticket_id: int):
        serializer = TicketMessageCreateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        ticket = get_admin_ticket(ticket_id=ticket_id)
        try:
            ticket = add_admin_reply(ticket=ticket, operator=request.user, **serializer.validated_data)
        except TicketStateConflictError as exc:
            return ticket_state_conflict_response(exc)
        return success_response(TicketSerializer(ticket, context={"scope": "admin"}).data)


class AdminTicketCloseView(APIView):
    authentication_classes = [AdminTokenAuthentication]
    permission_classes = [HasAdminPermission]
    required_permission = "tickets.view"
    write_permission = "tickets.manage"

    @extend_schema(tags=["admin-tickets"], request=TicketCloseSerializer, responses={200: TicketSerializer})
    def post(self, request, ticket_id: int):
        serializer = TicketCloseSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        ticket = get_admin_ticket(ticket_id=ticket_id)
        try:
            ticket = close_ticket(ticket=ticket, operator=request.user, **serializer.validated_data)
        except TicketStateConflictError as exc:
            return ticket_state_conflict_response(exc)
        return success_response(TicketSerializer(ticket, context={"scope": "admin"}).data)
