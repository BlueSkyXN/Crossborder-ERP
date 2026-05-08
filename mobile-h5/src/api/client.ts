import axios from "axios";
import type { AxiosRequestConfig } from "axios";

import { useAuthStore } from "../features/auth/store";
import { ApiEnvelope, ApiError } from "./types";

export const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "/api/v1";

export const apiClient = axios.create({
  baseURL: API_BASE_URL,
  timeout: 15000,
  headers: {
    "Content-Type": "application/json",
  },
});

apiClient.interceptors.request.use((config) => {
  const token = useAuthStore.getState().token;
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

apiClient.interceptors.response.use(
  (response) => {
    const payload = response.data as ApiEnvelope<unknown>;
    if (payload?.code && payload.code !== "OK") {
      throw new ApiError(payload.message || "请求失败", payload.code, response.status, payload.data);
    }
    return response;
  },
  (error) => {
    if (error.response?.status === 401) {
      useAuthStore.getState().logout();
    }
    const payload = error.response?.data as Partial<ApiEnvelope<unknown>> | undefined;
    throw new ApiError(
      payload?.message || error.message || "网络请求失败",
      payload?.code || "NETWORK_ERROR",
      error.response?.status,
      payload?.data,
    );
  },
);

export async function requestData<T>(config: AxiosRequestConfig) {
  const response = await apiClient.request<ApiEnvelope<T>>(config);
  return response.data.data;
}
