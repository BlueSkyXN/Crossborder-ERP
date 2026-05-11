import axios, { AxiosHeaders } from "axios";
import type { AxiosInstance, AxiosRequestConfig, AxiosResponse } from "axios";

import { ApiError } from "./types.js";
import type { ApiEnvelope } from "./types.js";

export type ApiClientConfig = {
  baseURL?: string;
  getToken?: () => string | null;
  onUnauthorized?: () => void;
};

export type ItemsResponse<T> = T[] | { items: T[] };

export function createApiClient(config: ApiClientConfig = {}): AxiosInstance {
  const client = axios.create({
    baseURL: config.baseURL ?? "/api/v1",
    timeout: 15000,
    headers: {
      "Content-Type": "application/json",
    },
  });

  client.interceptors.request.use((requestConfig) => {
    const token = config.getToken?.();
    if (token) {
      requestConfig.headers = AxiosHeaders.from(requestConfig.headers);
      requestConfig.headers.set("Authorization", `Bearer ${token}`);
    }
    return requestConfig;
  });

  client.interceptors.response.use(
    (response) => unwrapEnvelope(response) as AxiosResponse,
    (error: unknown) => {
      if (axios.isAxiosError(error)) {
        if (error.response?.status === 401) {
          config.onUnauthorized?.();
        }

        const payload = error.response?.data as Partial<ApiEnvelope<unknown>> | undefined;
        throw new ApiError(
          payload?.message || error.message || "网络请求失败",
          payload?.code || "NETWORK_ERROR",
          error.response?.status,
          payload?.data,
        );
      }

      if (error instanceof ApiError) {
        throw error;
      }

      throw new ApiError(error instanceof Error ? error.message : "网络请求失败", "NETWORK_ERROR");
    },
  );

  return client;
}

export async function requestData<T>(client: AxiosInstance, config: AxiosRequestConfig): Promise<T> {
  return client.request<ApiEnvelope<T>, T>(config);
}

export function unwrapItemsResponse<T>(payload: ItemsResponse<T>, endpointName = "list"): T[] {
  if (Array.isArray(payload)) {
    return payload;
  }
  if (payload && Array.isArray(payload.items)) {
    return payload.items;
  }
  throw new ApiError(`${endpointName} 响应格式不正确`, "INVALID_RESPONSE_SHAPE", undefined, payload);
}

function unwrapEnvelope(response: AxiosResponse<ApiEnvelope<unknown> | unknown>): unknown {
  const payload = response.data as Partial<ApiEnvelope<unknown>> | undefined;
  if (payload && typeof payload === "object" && "code" in payload) {
    if (payload.code !== "OK") {
      throw new ApiError(payload.message || "请求失败", payload.code || "UNKNOWN_ERROR", response.status, payload.data);
    }
    return payload.data;
  }
  return response.data;
}
