/**
 * Thin wrapper that creates memberClient / adminClient using the shared
 * @crossborder-erp/api-client package. Pages should import API functions
 * from "@crossborder-erp/api-client" and pass the appropriate client.
 */
import { createApiClient } from "@crossborder-erp/api-client";
export { requestData, ApiError } from "@crossborder-erp/api-client";

import { useMemberAuthStore, useAdminAuthStore } from "../stores/auth";

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "/api/v1";

export const memberClient = createApiClient({
  baseURL: API_BASE_URL,
  getToken: () => useMemberAuthStore.getState().token,
  onUnauthorized: () => useMemberAuthStore.getState().logout(),
});

export const adminClient = createApiClient({
  baseURL: API_BASE_URL,
  getToken: () => useAdminAuthStore.getState().token,
  onUnauthorized: () => useAdminAuthStore.getState().logout(),
});
