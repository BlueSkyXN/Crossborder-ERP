import { requestData } from "../../api/client";
import type {
  TrackingEvent,
  Wallet,
  WalletTransaction,
  Waybill,
  WaybillCreatePayload,
  WaybillPayPayload,
  WaybillPayResult,
} from "./types";

type ListResponse<T> = {
  items: T[];
};

function listItems<T>(url: string) {
  return requestData<ListResponse<T>>({ method: "GET", url }).then((result) => result.items);
}

export function fetchWaybills() {
  return listItems<Waybill>("/waybills");
}

export function createWaybill(payload: WaybillCreatePayload) {
  return requestData<Waybill>({ method: "POST", url: "/waybills", data: payload });
}

export function payWaybill(waybillId: number, payload: WaybillPayPayload) {
  return requestData<WaybillPayResult>({
    method: "POST",
    url: `/waybills/${waybillId}/pay`,
    data: payload,
  });
}

export function confirmWaybillReceipt(waybillId: number, description = "") {
  return requestData<Waybill>({
    method: "POST",
    url: `/waybills/${waybillId}/confirm-receipt`,
    data: { description },
  });
}

export function fetchTrackingEvents(waybillId: number) {
  return listItems<TrackingEvent>(`/waybills/${waybillId}/tracking-events`);
}

export function fetchWallet() {
  return requestData<Wallet>({ method: "GET", url: "/wallet" });
}

export function fetchWalletTransactions() {
  return listItems<WalletTransaction>("/wallet/transactions");
}
