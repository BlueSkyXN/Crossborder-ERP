import { requestData } from "../../api/client";
import type { GrowthSummary, PointLedger, RebateRecord, ReferralRelation } from "./types";

type ListResponse<T> = {
  items: T[];
};

function listItems<T>(url: string) {
  return requestData<ListResponse<T>>({ method: "GET", url }).then((result) => result.items);
}

export function fetchGrowthOverview() {
  return requestData<GrowthSummary>({
    method: "GET",
    url: "/growth/summary",
  });
}

export function fetchGrowthSummary() {
  return fetchGrowthOverview();
}

export function fetchPointLedgers() {
  return listItems<PointLedger>("/growth/point-ledgers");
}

export function fetchReferralRelations() {
  return listItems<ReferralRelation>("/growth/referrals");
}

export function fetchRebateRecords() {
  return listItems<RebateRecord>("/growth/rebates");
}
