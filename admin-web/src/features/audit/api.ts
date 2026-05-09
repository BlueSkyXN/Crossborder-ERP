import { requestData } from "../../api/client";
import type { AuditLogListResult, AuditLogQuery } from "./types";

export const auditLogsApi = {
  listLogs: (query: AuditLogQuery = {}) => {
    const params = new URLSearchParams();
    Object.entries(query).forEach(([key, value]) => {
      if (value !== undefined && value !== null && String(value).trim() !== "") {
        params.set(key, String(value));
      }
    });
    const search = params.toString();
    return requestData<AuditLogListResult>({
      method: "GET",
      url: `/admin/audit-logs${search ? `?${search}` : ""}`,
    });
  },
};

