from rest_framework import serializers

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
    operator_name = serializers.CharField(source="operator.name", read_only=True)

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
            "status",
            "remark",
            "completed_at",
            "created_at",
        ]
        read_only_fields = fields


class WalletAdjustmentSerializer(serializers.Serializer):
    amount = serializers.DecimalField(max_digits=12, decimal_places=2)
    currency = serializers.CharField(max_length=10, required=False, default="CNY")
    remark = serializers.CharField(required=False, allow_blank=True)


class WaybillPaySerializer(serializers.Serializer):
    idempotency_key = serializers.CharField(max_length=120)
