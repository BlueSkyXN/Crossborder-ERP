import { requestData } from "../../api/client";
import type {
  PaymentOrder,
  ShippingBatch,
  ShippingBatchPayload,
  ShippingBatchPrintPreview,
  ShippingBatchPrintTemplate,
  ShippingBatchWaybillIdsPayload,
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
  listShippingBatches: () => listItems<ShippingBatch>("/admin/shipping-batches"),
  createShippingBatch: (payload: ShippingBatchPayload) =>
    requestData<ShippingBatch>({ method: "POST", url: "/admin/shipping-batches", data: payload }),
  addWaybillsToShippingBatch: (batchId: number, payload: ShippingBatchWaybillIdsPayload) =>
    requestData<ShippingBatch>({ method: "POST", url: `/admin/shipping-batches/${batchId}/waybills`, data: payload }),
  removeWaybillFromShippingBatch: (batchId: number, waybillId: number) =>
    requestData<ShippingBatch>({ method: "DELETE", url: `/admin/shipping-batches/${batchId}/waybills/${waybillId}` }),
  lockShippingBatch: (batchId: number) =>
    requestData<ShippingBatch>({ method: "POST", url: `/admin/shipping-batches/${batchId}/lock`, data: {} }),
  shipShippingBatch: (batchId: number, payload: WaybillTrackingPayload) =>
    requestData<ShippingBatch>({ method: "POST", url: `/admin/shipping-batches/${batchId}/ship`, data: payload }),
  addShippingBatchTrackingEvent: (batchId: number, payload: WaybillTrackingPayload) =>
    requestData<ListResponse<TrackingEvent>>({
      method: "POST",
      url: `/admin/shipping-batches/${batchId}/tracking-events`,
      data: payload,
    }).then((result) => result.items),
  getShippingBatchPrintPreview: (batchId: number, template: ShippingBatchPrintTemplate) =>
    requestData<ShippingBatchPrintPreview>({
      method: "GET",
      url: `/admin/shipping-batches/${batchId}/print-data?template=${template}`,
    }),
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
