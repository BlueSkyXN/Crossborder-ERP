import { requestData } from "../../api/client";
import type { PaymentOrder, RechargeRequest, RemittanceReviewPayload, WalletTransaction } from "./types";

type ListResponse<T> = {
  items: T[];
};

function listItems<T>(url: string) {
  return requestData<ListResponse<T>>({ method: "GET", url }).then((result) => result.items);
}

export const financeOpsApi = {
  listRemittances: () => listItems<RechargeRequest>("/admin/remittances"),
  approveRemittance: (remittanceId: number, payload: RemittanceReviewPayload) =>
    requestData<WalletTransaction>({
      method: "POST",
      url: `/admin/remittances/${remittanceId}/approve`,
      data: payload,
    }),
  cancelRemittance: (remittanceId: number, payload: RemittanceReviewPayload) =>
    requestData<RechargeRequest>({
      method: "POST",
      url: `/admin/remittances/${remittanceId}/cancel`,
      data: payload,
    }),
  listWalletTransactions: () => listItems<WalletTransaction>("/admin/wallet-transactions"),
  listPaymentOrders: () => listItems<PaymentOrder>("/admin/payment-orders"),
};
