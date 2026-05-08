import { requestData } from "../../api/client";
import type { OfflineRemittanceCreatePayload, RechargeRequest, Wallet, WalletTransaction } from "./types";

type ListResponse<T> = {
  items: T[];
};

function listItems<T>(url: string) {
  return requestData<ListResponse<T>>({ method: "GET", url }).then((result) => result.items);
}

export function fetchFinanceWallet() {
  return requestData<Wallet>({ method: "GET", url: "/wallet" });
}

export function fetchFinanceWalletTransactions() {
  return listItems<WalletTransaction>("/wallet/transactions");
}

export function fetchRemittances() {
  return listItems<RechargeRequest>("/remittances");
}

export function createRemittance(payload: OfflineRemittanceCreatePayload) {
  return requestData<RechargeRequest>({ method: "POST", url: "/remittances", data: payload });
}
