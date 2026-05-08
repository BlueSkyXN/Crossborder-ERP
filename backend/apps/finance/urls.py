from django.urls import path

from .views import (
    AdminPaymentOrderListView,
    AdminUserWalletDeductView,
    AdminUserWalletRechargeView,
    AdminWalletTransactionListView,
    WalletTransactionListView,
    WalletView,
    WaybillPayView,
)

urlpatterns = [
    path("wallet", WalletView.as_view(), name="wallet-detail"),
    path("wallet/transactions", WalletTransactionListView.as_view(), name="wallet-transaction-list"),
    path("waybills/<int:waybill_id>/pay", WaybillPayView.as_view(), name="waybill-pay"),
    path("admin/wallet-transactions", AdminWalletTransactionListView.as_view(), name="admin-wallet-transaction-list"),
    path("admin/users/<int:user_id>/wallet/recharge", AdminUserWalletRechargeView.as_view(), name="admin-wallet-recharge"),
    path("admin/users/<int:user_id>/wallet/deduct", AdminUserWalletDeductView.as_view(), name="admin-wallet-deduct"),
    path("admin/payment-orders", AdminPaymentOrderListView.as_view(), name="admin-payment-order-list"),
]
