from django.http import FileResponse
from django.utils.encoding import escape_uri_path
from drf_spectacular.types import OpenApiTypes
from drf_spectacular.utils import extend_schema
from rest_framework import status
from rest_framework.parsers import FormParser, MultiPartParser
from rest_framework.views import APIView

from apps.common.responses import success_response
from apps.iam.authentication import AdminTokenAuthentication
from apps.iam.permissions import HasAdminPermission
from apps.members.authentication import MemberTokenAuthentication
from apps.members.permissions import IsMemberAuthenticated

from .serializers import FileUploadSerializer, StoredFileSerializer
from .services import (
    create_admin_file,
    create_member_file,
    delete_admin_file,
    delete_member_file,
    get_admin_file,
    get_member_file,
    get_storage_path,
    list_admin_files,
    list_member_files,
)


def _download_response(stored_file):
    path = get_storage_path(stored_file)
    response = FileResponse(path.open("rb"), content_type=stored_file.content_type)
    filename = escape_uri_path(stored_file.original_name)
    response["Content-Disposition"] = f"inline; filename*=UTF-8''{filename}"
    response["X-File-Id"] = stored_file.file_id
    return response


class MemberFileListCreateView(APIView):
    authentication_classes = [MemberTokenAuthentication]
    permission_classes = [IsMemberAuthenticated]
    parser_classes = [MultiPartParser, FormParser]

    @extend_schema(tags=["files"], responses={200: StoredFileSerializer(many=True)})
    def get(self, request):
        files = list_member_files(member=request.user)
        return success_response(
            {"items": StoredFileSerializer(files, many=True, context={"scope": "member"}).data}
        )

    @extend_schema(tags=["files"], request=FileUploadSerializer, responses={201: StoredFileSerializer})
    def post(self, request):
        serializer = FileUploadSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        stored_file = create_member_file(
            member=request.user,
            uploaded_file=serializer.validated_data["file"],
            usage=serializer.validated_data["usage"],
        )
        return success_response(
            StoredFileSerializer(stored_file, context={"scope": "member"}).data,
            status=status.HTTP_201_CREATED,
        )


class MemberFileDetailView(APIView):
    authentication_classes = [MemberTokenAuthentication]
    permission_classes = [IsMemberAuthenticated]

    @extend_schema(tags=["files"], responses={200: StoredFileSerializer})
    def get(self, request, file_id: str):
        stored_file = get_member_file(member=request.user, file_id=file_id)
        return success_response(StoredFileSerializer(stored_file, context={"scope": "member"}).data)

    @extend_schema(tags=["files"], responses={200: StoredFileSerializer})
    def delete(self, request, file_id: str):
        stored_file = delete_member_file(member=request.user, file_id=file_id)
        return success_response(StoredFileSerializer(stored_file, context={"scope": "member"}).data)


class MemberFileDownloadView(APIView):
    authentication_classes = [MemberTokenAuthentication]
    permission_classes = [IsMemberAuthenticated]

    @extend_schema(tags=["files"], responses={200: OpenApiTypes.BINARY})
    def get(self, request, file_id: str):
        return _download_response(get_member_file(member=request.user, file_id=file_id))


class AdminFileListCreateView(APIView):
    authentication_classes = [AdminTokenAuthentication]
    permission_classes = [HasAdminPermission]
    required_permission = "files.manage"
    parser_classes = [MultiPartParser, FormParser]

    @extend_schema(tags=["admin-files"], responses={200: StoredFileSerializer(many=True)})
    def get(self, request):
        files = list_admin_files()
        return success_response(
            {"items": StoredFileSerializer(files, many=True, context={"scope": "admin"}).data}
        )

    @extend_schema(tags=["admin-files"], request=FileUploadSerializer, responses={201: StoredFileSerializer})
    def post(self, request):
        serializer = FileUploadSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        stored_file = create_admin_file(
            admin_user=request.user,
            uploaded_file=serializer.validated_data["file"],
            usage=serializer.validated_data["usage"],
        )
        return success_response(
            StoredFileSerializer(stored_file, context={"scope": "admin"}).data,
            status=status.HTTP_201_CREATED,
        )


class AdminFileDetailView(APIView):
    authentication_classes = [AdminTokenAuthentication]
    permission_classes = [HasAdminPermission]
    required_permission = "files.manage"

    @extend_schema(tags=["admin-files"], responses={200: StoredFileSerializer})
    def get(self, request, file_id: str):
        return success_response(StoredFileSerializer(get_admin_file(file_id=file_id), context={"scope": "admin"}).data)

    @extend_schema(tags=["admin-files"], responses={200: StoredFileSerializer})
    def delete(self, request, file_id: str):
        stored_file = delete_admin_file(file_id=file_id)
        return success_response(StoredFileSerializer(stored_file, context={"scope": "admin"}).data)


class AdminFileDownloadView(APIView):
    authentication_classes = [AdminTokenAuthentication]
    permission_classes = [HasAdminPermission]
    required_permission = "files.manage"

    @extend_schema(tags=["admin-files"], responses={200: OpenApiTypes.BINARY})
    def get(self, request, file_id: str):
        return _download_response(get_admin_file(file_id=file_id))
