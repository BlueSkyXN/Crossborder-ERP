from django.http import HttpResponse
from django.shortcuts import get_object_or_404
from django.utils.encoding import escape_uri_path
from drf_spectacular.types import OpenApiTypes
from drf_spectacular.utils import extend_schema
from rest_framework import status
from rest_framework.views import APIView

from apps.common.responses import error_response, success_response
from apps.iam.authentication import AdminTokenAuthentication
from apps.iam.permissions import HasAdminPermission
from apps.members.authentication import MemberTokenAuthentication
from apps.members.permissions import IsMemberAuthenticated

from .models import Parcel, ParcelStatus, UnclaimedParcel, UnclaimedParcelStatus
from .import_export import (
    build_parcel_export_csv,
    build_parcel_import_template_csv,
    build_parcel_import_template_xlsx,
    import_parcel_forecasts,
    list_member_import_jobs,
    XLSX_CONTENT_TYPE,
)
from .serializers import (
    AdminUnclaimedParcelCreateSerializer,
    AdminUnclaimedParcelApproveResponseSerializer,
    InboundRequestSerializer,
    ParcelImportCreateSerializer,
    ParcelImportJobSerializer,
    ParcelForecastSerializer,
    ParcelSerializer,
    PublicUnclaimedParcelSerializer,
    ScanInboundResponseSerializer,
    ScanInboundRequestSerializer,
    UnclaimedParcelClaimSerializer,
    UnclaimedParcelQuerySerializer,
    UnclaimedParcelReviewSerializer,
    UnclaimedParcelSerializer,
)
from .services import (
    StateConflictError,
    approve_unclaimed_claim,
    forecast_parcel,
    inbound_parcel,
    reject_unclaimed_claim,
    scan_inbound,
    submit_unclaimed_claim,
    user_visible_unclaimed_queryset,
)


def state_conflict_response(exc: StateConflictError):
    return error_response("STATE_CONFLICT", str(exc), status=status.HTTP_409_CONFLICT)


def csv_response(content: str, filename: str) -> HttpResponse:
    response = HttpResponse(content, content_type="text/csv; charset=utf-8")
    response["Content-Disposition"] = f"attachment; filename*=UTF-8''{escape_uri_path(filename)}"
    return response


def xlsx_response(content: bytes, filename: str) -> HttpResponse:
    response = HttpResponse(content, content_type=XLSX_CONTENT_TYPE)
    response["Content-Disposition"] = f"attachment; filename*=UTF-8''{escape_uri_path(filename)}"
    return response


class ParcelImportTemplateView(APIView):
    authentication_classes = [MemberTokenAuthentication]
    permission_classes = [IsMemberAuthenticated]

    @extend_schema(tags=["parcels"], responses={200: OpenApiTypes.BINARY})
    def get(self, request):
        return csv_response(build_parcel_import_template_csv(), "parcel-import-template.csv")


class ParcelImportTemplateXlsxView(APIView):
    authentication_classes = [MemberTokenAuthentication]
    permission_classes = [IsMemberAuthenticated]

    @extend_schema(tags=["parcels"], responses={200: OpenApiTypes.BINARY})
    def get(self, request):
        return xlsx_response(build_parcel_import_template_xlsx(), "parcel-import-template.xlsx")


class ParcelImportListCreateView(APIView):
    authentication_classes = [MemberTokenAuthentication]
    permission_classes = [IsMemberAuthenticated]

    @extend_schema(tags=["parcels"], responses={200: ParcelImportJobSerializer(many=True)})
    def get(self, request):
        jobs = list_member_import_jobs(user=request.user)
        return success_response({"items": ParcelImportJobSerializer(jobs, many=True).data})

    @extend_schema(tags=["parcels"], request=ParcelImportCreateSerializer, responses={201: ParcelImportJobSerializer})
    def post(self, request):
        serializer = ParcelImportCreateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        job = import_parcel_forecasts(user=request.user, file_id=serializer.validated_data["file_id"])
        return success_response(ParcelImportJobSerializer(job).data, status=status.HTTP_201_CREATED)


class ParcelExportView(APIView):
    authentication_classes = [MemberTokenAuthentication]
    permission_classes = [IsMemberAuthenticated]

    @extend_schema(tags=["parcels"], responses={200: OpenApiTypes.BINARY})
    def get(self, request):
        return csv_response(build_parcel_export_csv(user=request.user), "member-parcels-export.csv")


class ParcelForecastView(APIView):
    authentication_classes = [MemberTokenAuthentication]
    permission_classes = [IsMemberAuthenticated]

    @extend_schema(tags=["parcels"], request=ParcelForecastSerializer, responses={201: ParcelSerializer})
    def post(self, request):
        serializer = ParcelForecastSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        parcel = forecast_parcel(user=request.user, **serializer.validated_data)
        return success_response(ParcelSerializer(parcel).data, status=status.HTTP_201_CREATED)


class ParcelListView(APIView):
    authentication_classes = [MemberTokenAuthentication]
    permission_classes = [IsMemberAuthenticated]

    @extend_schema(tags=["parcels"], responses={200: ParcelSerializer(many=True)})
    def get(self, request):
        parcels = (
            Parcel.objects.filter(user=request.user)
            .select_related("warehouse", "user")
            .prefetch_related("items", "photos")
        )
        return success_response({"items": ParcelSerializer(parcels, many=True).data})


class PackableParcelListView(APIView):
    authentication_classes = [MemberTokenAuthentication]
    permission_classes = [IsMemberAuthenticated]

    @extend_schema(tags=["parcels"], responses={200: ParcelSerializer(many=True)})
    def get(self, request):
        parcels = (
            Parcel.objects.filter(user=request.user, status=ParcelStatus.IN_STOCK)
            .select_related("warehouse", "user")
            .prefetch_related("items", "photos")
        )
        return success_response({"items": ParcelSerializer(parcels, many=True).data})


class ParcelDetailView(APIView):
    authentication_classes = [MemberTokenAuthentication]
    permission_classes = [IsMemberAuthenticated]

    @extend_schema(tags=["parcels"], responses={200: ParcelSerializer})
    def get(self, request, parcel_id: int):
        parcel = get_object_or_404(
            Parcel.objects.select_related("warehouse", "user").prefetch_related("items", "photos"),
            id=parcel_id,
            user=request.user,
        )
        return success_response(ParcelSerializer(parcel).data)


class UnclaimedParcelListView(APIView):
    authentication_classes = [MemberTokenAuthentication]
    permission_classes = [IsMemberAuthenticated]

    @extend_schema(
        tags=["unclaimed-parcels"],
        parameters=[UnclaimedParcelQuerySerializer],
        responses={200: PublicUnclaimedParcelSerializer(many=True)},
    )
    def get(self, request):
        serializer = UnclaimedParcelQuerySerializer(data=request.query_params)
        serializer.is_valid(raise_exception=True)
        keyword = serializer.validated_data.get("keyword", "").strip()
        unclaimed = user_visible_unclaimed_queryset(user=request.user)
        if keyword:
            unclaimed = unclaimed.filter(tracking_no__icontains=keyword)
        return success_response(
            {"items": PublicUnclaimedParcelSerializer(unclaimed, many=True, context={"user": request.user}).data}
        )


class UnclaimedParcelClaimView(APIView):
    authentication_classes = [MemberTokenAuthentication]
    permission_classes = [IsMemberAuthenticated]

    @extend_schema(
        tags=["unclaimed-parcels"],
        request=UnclaimedParcelClaimSerializer,
        responses={200: PublicUnclaimedParcelSerializer},
    )
    def post(self, request, unclaimed_id: int):
        serializer = UnclaimedParcelClaimSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        unclaimed = get_object_or_404(UnclaimedParcel, id=unclaimed_id)
        try:
            claimed = submit_unclaimed_claim(unclaimed_parcel=unclaimed, user=request.user, **serializer.validated_data)
        except StateConflictError as exc:
            return state_conflict_response(exc)
        return success_response(PublicUnclaimedParcelSerializer(claimed, context={"user": request.user}).data)


class AdminParcelListView(APIView):
    authentication_classes = [AdminTokenAuthentication]
    permission_classes = [HasAdminPermission]
    required_permission = "parcels.view"

    @extend_schema(tags=["admin-parcels"], responses={200: ParcelSerializer(many=True)})
    def get(self, request):
        parcels = Parcel.objects.select_related("warehouse", "user").prefetch_related("items", "photos")
        return success_response({"items": ParcelSerializer(parcels, many=True).data})


class AdminParcelExportView(APIView):
    authentication_classes = [AdminTokenAuthentication]
    permission_classes = [HasAdminPermission]
    required_permission = "parcels.view"

    @extend_schema(tags=["admin-parcels"], responses={200: OpenApiTypes.BINARY})
    def get(self, request):
        return csv_response(build_parcel_export_csv(), "admin-parcels-export.csv")


class AdminParcelInboundView(APIView):
    authentication_classes = [AdminTokenAuthentication]
    permission_classes = [HasAdminPermission]
    required_permission = "parcels.view"

    @extend_schema(tags=["admin-parcels"], request=InboundRequestSerializer, responses={200: ParcelSerializer})
    def post(self, request, parcel_id: int):
        serializer = InboundRequestSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        parcel = get_object_or_404(Parcel, id=parcel_id)
        try:
            inbounded = inbound_parcel(parcel=parcel, operator=request.user, **serializer.validated_data)
        except StateConflictError as exc:
            return state_conflict_response(exc)
        return success_response(ParcelSerializer(inbounded).data)


class AdminParcelScanInboundView(APIView):
    authentication_classes = [AdminTokenAuthentication]
    permission_classes = [HasAdminPermission]
    required_permission = "parcels.view"

    @extend_schema(
        tags=["admin-parcels"],
        request=ScanInboundRequestSerializer,
        responses={200: ScanInboundResponseSerializer, 201: ScanInboundResponseSerializer},
    )
    def post(self, request):
        serializer = ScanInboundRequestSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        try:
            result = scan_inbound(operator=request.user, **serializer.validated_data)
        except StateConflictError as exc:
            return state_conflict_response(exc)

        if result.parcel:
            return success_response({"parcel": ParcelSerializer(result.parcel).data, "unclaimed_parcel": None})
        return success_response(
            {
                "parcel": None,
                "unclaimed_parcel": UnclaimedParcelSerializer(result.unclaimed_parcel).data,
                "created_unclaimed": result.created_unclaimed,
            },
            status=status.HTTP_201_CREATED if result.created_unclaimed else status.HTTP_200_OK,
        )


class AdminUnclaimedParcelListCreateView(APIView):
    authentication_classes = [AdminTokenAuthentication]
    permission_classes = [HasAdminPermission]
    required_permission = "parcels.view"

    @extend_schema(tags=["admin-parcels"], responses={200: UnclaimedParcelSerializer(many=True)})
    def get(self, request):
        unclaimed = UnclaimedParcel.objects.select_related(
            "warehouse",
            "claimed_by_user",
            "reviewed_by_admin",
        ).order_by("-id")
        return success_response({"items": UnclaimedParcelSerializer(unclaimed, many=True).data})

    @extend_schema(
        tags=["admin-parcels"],
        request=AdminUnclaimedParcelCreateSerializer,
        responses={201: UnclaimedParcelSerializer},
    )
    def post(self, request):
        serializer = AdminUnclaimedParcelCreateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        unclaimed = UnclaimedParcel.objects.create(
            status=UnclaimedParcelStatus.UNCLAIMED,
            **serializer.validated_data,
        )
        return success_response(UnclaimedParcelSerializer(unclaimed).data, status=status.HTTP_201_CREATED)


class AdminUnclaimedParcelApproveView(APIView):
    authentication_classes = [AdminTokenAuthentication]
    permission_classes = [HasAdminPermission]
    required_permission = "parcels.view"

    @extend_schema(
        tags=["admin-parcels"],
        request=UnclaimedParcelReviewSerializer,
        responses={200: AdminUnclaimedParcelApproveResponseSerializer},
    )
    def post(self, request, unclaimed_id: int):
        serializer = UnclaimedParcelReviewSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        unclaimed = get_object_or_404(UnclaimedParcel, id=unclaimed_id)
        try:
            parcel = approve_unclaimed_claim(
                unclaimed_parcel=unclaimed,
                operator=request.user,
                **serializer.validated_data,
            )
        except StateConflictError as exc:
            return state_conflict_response(exc)
        unclaimed.refresh_from_db()
        return success_response(
            {
                "parcel": ParcelSerializer(parcel).data,
                "unclaimed_parcel": UnclaimedParcelSerializer(unclaimed).data,
            }
        )


class AdminUnclaimedParcelRejectView(APIView):
    authentication_classes = [AdminTokenAuthentication]
    permission_classes = [HasAdminPermission]
    required_permission = "parcels.view"

    @extend_schema(
        tags=["admin-parcels"],
        request=UnclaimedParcelReviewSerializer,
        responses={200: UnclaimedParcelSerializer},
    )
    def post(self, request, unclaimed_id: int):
        serializer = UnclaimedParcelReviewSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        unclaimed = get_object_or_404(UnclaimedParcel, id=unclaimed_id)
        try:
            rejected = reject_unclaimed_claim(
                unclaimed_parcel=unclaimed,
                operator=request.user,
                **serializer.validated_data,
            )
        except StateConflictError as exc:
            return state_conflict_response(exc)
        return success_response(UnclaimedParcelSerializer(rejected).data)
