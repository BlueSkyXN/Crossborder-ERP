import { apiClient, requestData } from "../../api/client";
import type { AuditLogListResult, AuditLogQuery } from "./types";

function buildSearch(query: AuditLogQuery = {}) {
  const params = new URLSearchParams();
  Object.entries(query).forEach(([key, value]) => {
    if (value !== undefined && value !== null && String(value).trim() !== "") {
      params.set(key, String(value));
    }
  });
  return params.toString();
}

export const auditLogsApi = {
  listLogs: (query: AuditLogQuery = {}) => {
    const search = buildSearch(query);
    return requestData<AuditLogListResult>({
      method: "GET",
      url: `/admin/audit-logs${search ? `?${search}` : ""}`,
    });
  },
  exportLogs: (query: AuditLogQuery = {}) => {
    const search = buildSearch(query);
    return apiClient
      .request<Blob>({
        method: "GET",
        url: `/admin/audit-logs/export.csv${search ? `?${search}` : ""}`,
        responseType: "blob",
      })
      .then((response) => response.data);
  },
};
