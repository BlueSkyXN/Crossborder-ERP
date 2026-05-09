import { requestData } from "../../api/client";
import type { AdminDashboardSnapshot } from "./types";

export function fetchAdminDashboard() {
  return requestData<AdminDashboardSnapshot>({
    method: "GET",
    url: "/admin/dashboard",
  });
}
