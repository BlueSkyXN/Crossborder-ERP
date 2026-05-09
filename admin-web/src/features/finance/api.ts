import { requestData } from "../../api/client";
import type {
  CostType,
  CostTypePayload,
  Payable,
  PayableCancelPayload,
  PayablePayload,
  PayableSettlePayload,
  PaymentOrder,
  RechargeRequest,
  RemittanceReviewPayload,
  Supplier,
  SupplierPayload,
  WalletTransaction,
} from "./types";

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
  listSuppliers: () => listItems<Supplier>("/admin/suppliers"),
  createSupplier: (payload: SupplierPayload) =>
    requestData<Supplier>({ method: "POST", url: "/admin/suppliers", data: payload }),
  updateSupplier: (supplierId: number, payload: SupplierPayload) =>
    requestData<Supplier>({ method: "PATCH", url: `/admin/suppliers/${supplierId}`, data: payload }),
  listCostTypes: () => listItems<CostType>("/admin/cost-types"),
  createCostType: (payload: CostTypePayload) =>
    requestData<CostType>({ method: "POST", url: "/admin/cost-types", data: payload }),
  updateCostType: (costTypeId: number, payload: CostTypePayload) =>
    requestData<CostType>({ method: "PATCH", url: `/admin/cost-types/${costTypeId}`, data: payload }),
  listPayables: () => listItems<Payable>("/admin/payables"),
  createPayable: (payload: PayablePayload) =>
    requestData<Payable>({ method: "POST", url: "/admin/payables", data: payload }),
  updatePayable: (payableId: number, payload: PayablePayload) =>
    requestData<Payable>({ method: "PATCH", url: `/admin/payables/${payableId}`, data: payload }),
  confirmPayable: (payableId: number) =>
    requestData<Payable>({ method: "POST", url: `/admin/payables/${payableId}/confirm`, data: {} }),
  settlePayable: (payableId: number, payload: PayableSettlePayload) =>
    requestData<Payable>({ method: "POST", url: `/admin/payables/${payableId}/settle`, data: payload }),
  cancelPayable: (payableId: number, payload: PayableCancelPayload) =>
    requestData<Payable>({ method: "POST", url: `/admin/payables/${payableId}/cancel`, data: payload }),
};
