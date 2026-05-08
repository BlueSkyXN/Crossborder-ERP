import { requestData } from "../../api/client";
import type {
  PaymentOrder,
  TrackingEvent,
  WalletAdjustmentPayload,
  WalletTransaction,
  Waybill,
  WaybillFeePayload,
  WaybillReviewPayload,
  WaybillTrackingPayload,
} from "./types";

type ListResponse<T> = {
  items: T[];
};

function listItems<T>(url: string) {
  return requestData<ListResponse<T>>({ method: "GET", url }).then((result) => result.items);
}

export const waybillOpsApi = {
  listWaybills: () => listItems<Waybill>("/admin/waybills"),
  reviewWaybill: (waybillId: number, payload: WaybillReviewPayload) =>
    requestData<Waybill>({ method: "POST", url: `/admin/waybills/${waybillId}/review`, data: payload }),
  setWaybillFee: (waybillId: number, payload: WaybillFeePayload) =>
    requestData<Waybill>({ method: "POST", url: `/admin/waybills/${waybillId}/set-fee`, data: payload }),
  shipWaybill: (waybillId: number, payload: WaybillTrackingPayload) =>
    requestData<Waybill>({ method: "POST", url: `/admin/waybills/${waybillId}/ship`, data: payload }),
  addTrackingEvent: (waybillId: number, payload: WaybillTrackingPayload) =>
    requestData<TrackingEvent>({
      method: "POST",
      url: `/admin/waybills/${waybillId}/tracking-events`,
      data: payload,
    }),
  rechargeWallet: (userId: number, payload: WalletAdjustmentPayload) =>
    requestData<WalletTransaction>({
      method: "POST",
      url: `/admin/users/${userId}/wallet/recharge`,
      data: payload,
    }),
  listWalletTransactions: () => listItems<WalletTransaction>("/admin/wallet-transactions"),
  listPaymentOrders: () => listItems<PaymentOrder>("/admin/payment-orders"),
};
