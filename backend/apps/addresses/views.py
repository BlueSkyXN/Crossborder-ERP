from django.shortcuts import get_object_or_404
from drf_spectacular.utils import extend_schema
from rest_framework import status
from rest_framework.views import APIView

from apps.common.responses import success_response
from apps.members.authentication import MemberTokenAuthentication
from apps.members.permissions import IsMemberAuthenticated

from .models import Address
from .serializers import AddressSerializer, AddressUpsertSerializer
from .services import create_address, deactivate_address, list_addresses, set_default_address, update_address


class AddressListCreateView(APIView):
    authentication_classes = [MemberTokenAuthentication]
    permission_classes = [IsMemberAuthenticated]

    @extend_schema(tags=["addresses"], responses={200: AddressSerializer(many=True)})
    def get(self, request):
        addresses = list_addresses(user=request.user, address_type=request.query_params.get("address_type"))
        return success_response({"items": AddressSerializer(addresses, many=True).data})

    @extend_schema(tags=["addresses"], request=AddressUpsertSerializer, responses={201: AddressSerializer})
    def post(self, request):
        serializer = AddressUpsertSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        address = create_address(user=request.user, **serializer.validated_data)
        return success_response(AddressSerializer(address).data, status=status.HTTP_201_CREATED)


class AddressDetailView(APIView):
    authentication_classes = [MemberTokenAuthentication]
    permission_classes = [IsMemberAuthenticated]

    def get_object(self, request, address_id: int) -> Address:
        return get_object_or_404(Address, id=address_id, user=request.user, is_active=True)

    @extend_schema(tags=["addresses"], responses={200: AddressSerializer})
    def get(self, request, address_id: int):
        return success_response(AddressSerializer(self.get_object(request, address_id)).data)

    @extend_schema(tags=["addresses"], request=AddressUpsertSerializer, responses={200: AddressSerializer})
    def put(self, request, address_id: int):
        serializer = AddressUpsertSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        address = update_address(address=self.get_object(request, address_id), **serializer.validated_data)
        return success_response(AddressSerializer(address).data)

    @extend_schema(tags=["addresses"], responses={200: AddressSerializer})
    def delete(self, request, address_id: int):
        address = deactivate_address(address=self.get_object(request, address_id))
        return success_response(AddressSerializer(address).data)


class AddressSetDefaultView(APIView):
    authentication_classes = [MemberTokenAuthentication]
    permission_classes = [IsMemberAuthenticated]

    @extend_schema(tags=["addresses"], request=None, responses={200: AddressSerializer})
    def post(self, request, address_id: int):
        address = get_object_or_404(Address, id=address_id, user=request.user, is_active=True)
        return success_response(AddressSerializer(set_default_address(address=address)).data)
