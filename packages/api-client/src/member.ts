import type { AxiosInstance } from "axios";

import { requestData, unwrapItemsResponse } from "./client.js";
import type { ItemsResponse } from "./client.js";
import type {
  Address,
  ContentPage,
  EntityId,
  Member,
  MemberWarehouseAddress,
  PaginatedResponse,
  Parcel,
  PurchaseOrder,
  Remittance,
  Ticket,
  WalletInfo,
  WalletTransaction,
  Warehouse,
  Waybill,
} from "./types.js";

export type QueryParams = Record<string, string | number | boolean | null | undefined>;
export type RequestBody = Record<string, unknown>;

export type AuthSession = {
  access_token: string;
  token_type: string;
  user: Member;
};

export type ParsedPurchaseLink = {
  source_url: string;
  product_name?: string;
  image_url?: string;
  price?: number;
  currency?: string;
  raw?: unknown;
};

export type TicketMessage = {
  id: EntityId;
  sender_type: string;
  message: string;
  created_at: string;
};

export const memberAuth = {
  register(client: AxiosInstance, payload: RequestBody): Promise<Member> {
    return requestData(client, { method: "POST", url: "/auth/register", data: payload });
  },
  login(client: AxiosInstance, payload: RequestBody): Promise<AuthSession> {
    return requestData(client, { method: "POST", url: "/auth/login", data: payload });
  },
  logout(client: AxiosInstance): Promise<void> {
    return requestData(client, { method: "POST", url: "/auth/logout" });
  },
  getMe(client: AxiosInstance): Promise<Member> {
    return requestData(client, { method: "GET", url: "/me" });
  },
  updateProfile(client: AxiosInstance, payload: RequestBody): Promise<unknown> {
    return requestData(client, { method: "PUT", url: "/me/profile", data: payload });
  },
  changePassword(client: AxiosInstance, payload: RequestBody): Promise<void> {
    return requestData(client, { method: "POST", url: "/me/password", data: payload });
  },
  requestPasswordReset(client: AxiosInstance, payload: RequestBody): Promise<void> {
    return requestData(client, { method: "POST", url: "/auth/password-reset/request", data: payload });
  },
  confirmPasswordReset(client: AxiosInstance, payload: RequestBody): Promise<void> {
    return requestData(client, { method: "POST", url: "/auth/password-reset/confirm", data: payload });
  },
};

export const memberWarehouses = {
  async list(client: AxiosInstance, params?: QueryParams): Promise<Warehouse[]> {
    const payload = await requestData<ItemsResponse<Warehouse>>(client, {
      method: "GET",
      url: "/warehouses",
      params,
    });
    return unwrapItemsResponse(payload, "memberWarehouses.list");
  },
  getAddress(client: AxiosInstance, id: EntityId): Promise<MemberWarehouseAddress> {
    return requestData(client, { method: "GET", url: `/warehouses/${id}/address` });
  },
};

export const memberAddresses = {
  async list(client: AxiosInstance, params?: QueryParams): Promise<Address[]> {
    const payload = await requestData<ItemsResponse<Address>>(client, {
      method: "GET",
      url: "/addresses",
      params,
    });
    return unwrapItemsResponse(payload, "memberAddresses.list");
  },
  create(client: AxiosInstance, payload: RequestBody): Promise<Address> {
    return requestData(client, { method: "POST", url: "/addresses", data: payload });
  },
  getById(client: AxiosInstance, id: EntityId): Promise<Address> {
    return requestData(client, { method: "GET", url: `/addresses/${id}` });
  },
  update(client: AxiosInstance, id: EntityId, payload: RequestBody): Promise<Address> {
    return requestData(client, { method: "PUT", url: `/addresses/${id}`, data: payload });
  },
  remove(client: AxiosInstance, id: EntityId): Promise<Address> {
    return requestData(client, { method: "DELETE", url: `/addresses/${id}` });
  },
  setDefault(client: AxiosInstance, id: EntityId): Promise<Address> {
    return requestData(client, { method: "POST", url: `/addresses/${id}/set-default` });
  },
};

export const memberParcels = {
  forecast(client: AxiosInstance, payload: RequestBody): Promise<Parcel> {
    return requestData(client, { method: "POST", url: "/parcels/forecast", data: payload });
  },
  list(client: AxiosInstance, params?: QueryParams): Promise<PaginatedResponse<Parcel>> {
    return requestData(client, { method: "GET", url: "/parcels", params });
  },
  async getPackable(client: AxiosInstance, params?: QueryParams): Promise<Parcel[]> {
    const payload = await requestData<ItemsResponse<Parcel>>(client, {
      method: "GET",
      url: "/parcels/packable",
      params,
    });
    return unwrapItemsResponse(payload, "memberParcels.getPackable");
  },
  getById(client: AxiosInstance, id: EntityId): Promise<Parcel> {
    return requestData(client, { method: "GET", url: `/parcels/${id}` });
  },
};

export const memberWaybills = {
  create(client: AxiosInstance, payload: RequestBody): Promise<Waybill> {
    return requestData(client, { method: "POST", url: "/waybills", data: payload });
  },
  list(client: AxiosInstance, params?: QueryParams): Promise<PaginatedResponse<Waybill>> {
    return requestData(client, { method: "GET", url: "/waybills", params });
  },
  getById(client: AxiosInstance, id: EntityId): Promise<Waybill> {
    return requestData(client, { method: "GET", url: `/waybills/${id}` });
  },
  pay(client: AxiosInstance, id: EntityId, payload?: RequestBody): Promise<Waybill> {
    return requestData(client, { method: "POST", url: `/waybills/${id}/pay`, data: payload });
  },
  confirmReceipt(client: AxiosInstance, id: EntityId): Promise<Waybill> {
    return requestData(client, { method: "POST", url: `/waybills/${id}/confirm-receipt` });
  },
};

export const memberPurchases = {
  submitManual(client: AxiosInstance, payload: RequestBody): Promise<PurchaseOrder> {
    return requestData(client, { method: "POST", url: "/purchase-orders/manual", data: payload });
  },
  list(client: AxiosInstance, params?: QueryParams): Promise<PaginatedResponse<PurchaseOrder>> {
    return requestData(client, { method: "GET", url: "/purchase-orders", params });
  },
  getById(client: AxiosInstance, id: EntityId): Promise<PurchaseOrder> {
    return requestData(client, { method: "GET", url: `/purchase-orders/${id}` });
  },
  pay(client: AxiosInstance, id: EntityId, payload?: RequestBody): Promise<PurchaseOrder> {
    return requestData(client, { method: "POST", url: `/purchase-orders/${id}/pay`, data: payload });
  },
  parseLink(client: AxiosInstance, payload: RequestBody): Promise<ParsedPurchaseLink> {
    return requestData(client, { method: "POST", url: "/purchase-links/parse", data: payload });
  },
};

export const memberFinance = {
  getWallet(client: AxiosInstance): Promise<WalletInfo> {
    return requestData(client, { method: "GET", url: "/wallet" });
  },
  getTransactions(client: AxiosInstance, params?: QueryParams): Promise<PaginatedResponse<WalletTransaction>> {
    return requestData(client, { method: "GET", url: "/wallet/transactions", params });
  },
  submitRemittance(client: AxiosInstance, payload: RequestBody): Promise<Remittance> {
    return requestData(client, { method: "POST", url: "/remittances", data: payload });
  },
  listRemittances(client: AxiosInstance, params?: QueryParams): Promise<PaginatedResponse<Remittance>> {
    return requestData(client, { method: "GET", url: "/remittances", params });
  },
};

export const memberTickets = {
  create(client: AxiosInstance, payload: RequestBody): Promise<Ticket> {
    return requestData(client, { method: "POST", url: "/tickets", data: payload });
  },
  list(client: AxiosInstance, params?: QueryParams): Promise<PaginatedResponse<Ticket>> {
    return requestData(client, { method: "GET", url: "/tickets", params });
  },
  getById(client: AxiosInstance, id: EntityId): Promise<Ticket> {
    return requestData(client, { method: "GET", url: `/tickets/${id}` });
  },
  sendMessage(client: AxiosInstance, id: EntityId, payload: RequestBody): Promise<TicketMessage> {
    return requestData(client, { method: "POST", url: `/tickets/${id}/messages`, data: payload });
  },
};

export const memberContent = {
  async listPages(client: AxiosInstance, params?: QueryParams): Promise<ContentPage[]> {
    const payload = await requestData<ItemsResponse<ContentPage>>(client, {
      method: "GET",
      url: "/content/pages",
      params,
    });
    return unwrapItemsResponse(payload, "memberContent.listPages");
  },
  getPage(client: AxiosInstance, slug: string): Promise<ContentPage> {
    return requestData(client, { method: "GET", url: `/content/pages/${slug}` });
  },
};
