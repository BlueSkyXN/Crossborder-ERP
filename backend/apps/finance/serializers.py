from rest_framework import serializers

from apps.files.models import StoredFile

from .models import PaymentOrder, RechargeRequest, Wallet, WalletTransaction


class WalletSerializer(serializers.ModelSerializer):
    user_email = serializers.EmailField(source="user.email", read_only=True)

    class Meta:
        model = Wallet
        fields = ["id", "user", "user_email", "currency", "balance", "frozen_balance", "created_at", "updated_at"]
        read_only_fields = fields


class WalletTransactionSerializer(serializers.ModelSerializer):
    user_email = serializers.EmailField(source="user.email", read_only=True)
    operator_name = serializers.CharField(source="operator.name", read_only=True, allow_null=True)
    payment_no = serializers.CharField(source="payment_order.payment_no", read_only=True, allow_null=True)

    class Meta:
        model = WalletTransaction
        fields = [
            "id",
            "wallet",
            "user",
            "user_email",
            "payment_order",
            "payment_no",
            "operator_name",
            "type",
            "direction",
            "amount",
            "balance_after",
            "business_type",
            "business_id",
            "remark",
            "created_at",
        ]
        read_only_fields = fields


class PaymentOrderSerializer(serializers.ModelSerializer):
    user_email = serializers.EmailField(source="user.email", read_only=True)

    class Meta:
        model = PaymentOrder
        fields = [
            "id",
            "payment_no",
            "user",
            "user_email",
            "business_type",
            "business_id",
            "status",
            "amount",
            "currency",
            "idempotency_key",
            "remark",
            "paid_at",
            "created_at",
            "updated_at",
        ]
        read_only_fields = fields


class RechargeRequestSerializer(serializers.ModelSerializer):
    user_email = serializers.EmailField(source="user.email", read_only=True)
    operator_name = serializers.CharField(source="operator.name", read_only=True, allow_null=True)
    proof_file_name = serializers.SerializerMethodField()
    proof_download_url = serializers.SerializerMethodField()

    class Meta:
        model = RechargeRequest
        fields = [
            "id",
            "request_no",
            "user",
            "user_email",
            "wallet",
            "operator_name",
            "amount",
            "currency",
            "proof_file_id",
            "proof_file_name",
            "proof_download_url",
            "status",
            "remark",
            "review_remark",
            "reviewed_at",
            "completed_at",
            "created_at",
        ]
        read_only_fields = fields

    def _proof_file(self, obj: RechargeRequest) -> StoredFile | None:
        if not obj.proof_file_id:
            return None
        cache_key = "_serialized_proof_file"
        if hasattr(obj, cache_key):
            return getattr(obj, cache_key)
        stored_file = StoredFile.objects.filter(file_id=obj.proof_file_id).first()
        setattr(obj, cache_key, stored_file)
        return stored_file

    def get_proof_file_name(self, obj: RechargeRequest) -> str:
        stored_file = self._proof_file(obj)
        return stored_file.original_name if stored_file else ""

    def get_proof_download_url(self, obj: RechargeRequest) -> str:
        if not obj.proof_file_id:
            return ""
        scope = self.context.get("scope", "member")
        prefix = "admin/files" if scope == "admin" else "files"
        return f"/api/v1/{prefix}/{obj.proof_file_id}/download"


class OfflineRemittanceCreateSerializer(serializers.Serializer):
    amount = serializers.DecimalField(max_digits=12, decimal_places=2)
    currency = serializers.CharField(max_length=10, required=False, default="CNY")
    proof_file_id = serializers.CharField(max_length=40)
    remark = serializers.CharField(required=False, allow_blank=True, max_length=255)


class OfflineRemittanceReviewSerializer(serializers.Serializer):
    review_remark = serializers.CharField(required=False, allow_blank=True, max_length=255)


class WalletAdjustmentSerializer(serializers.Serializer):
    amount = serializers.DecimalField(max_digits=12, decimal_places=2)
    currency = serializers.CharField(max_length=10, required=False, default="CNY")
    remark = serializers.CharField(required=False, allow_blank=True)


class WaybillPaySerializer(serializers.Serializer):
    idempotency_key = serializers.CharField(max_length=120)
