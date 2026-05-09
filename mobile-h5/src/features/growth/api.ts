import { requestData } from "../../api/client";
import type { GrowthSummary } from "./types";

export function fetchGrowthSummary() {
  return requestData<GrowthSummary>({
    method: "GET",
    url: "/growth/summary",
  });
}
