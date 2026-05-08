import { requestData } from "../../api/client";
import { memberFilesApi } from "../files/api";
import type { OfflineRemittancePayload, RechargeRequest, Wallet, WalletTransaction } from "./types";

type ListResponse<T> = {
  items: T[];
};

function listItems<T>(url: string) {
  return requestData<ListResponse<T>>({ method: "GET", url }).then((result) => result.items);
}

export function fetchFinanceWallet() {
  return requestData<Wallet>({ method: "GET", url: "/wallet" });
}

export function fetchFinanceTransactions() {
  return listItems<WalletTransaction>("/wallet/transactions");
}

export function fetchRemittances() {
  return listItems<RechargeRequest>("/remittances");
}

export function uploadRemittanceProof(file: File) {
  return memberFilesApi.uploadFile(file, "REMITTANCE_PROOF");
}

export function createOfflineRemittance(payload: OfflineRemittancePayload) {
  return requestData<RechargeRequest>({ method: "POST", url: "/remittances", data: payload });
}
