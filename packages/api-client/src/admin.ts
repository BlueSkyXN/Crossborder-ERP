import type { AxiosInstance } from "axios";

import { requestData, unwrapItemsResponse } from "./client.js";
import type { ItemsResponse } from "./client.js";
import type {
  AdminAccount,
  AdminMember,
  AdminPermission,
  AdminRole,
  AuditLogEntry,
  ContentPage,
  DashboardData,
  EntityId,
  PaginatedResponse,
  Parcel,
  PurchaseOrder,
  Remittance,
  TrackingEvent,
  UnclaimedParcel,
  WalletTransaction,
  Warehouse,
  Waybill,
} from "./types.js";

export type AdminQueryParams = Record<string, string | number | boolean | null | undefined>;
export type AdminRequestBody = Record<string, unknown>;
export type DeleteResponse = { deleted_id: EntityId };

export type AdminSession = {
  access_token: string;
  token_type: string;
  admin_user: Record<string, unknown>;
};

export type ScanInboundResponse = {
  parcel: Parcel | null;
  unclaimed_parcel: UnclaimedParcel | null;
  created_unclaimed: boolean;
};

export type AdminUnclaimedParcelApproveResponse = {
  parcel: Parcel;
  unclaimed_parcel: UnclaimedParcel;
};

export type ShippingBatch = {
  id: EntityId;
  batch_no?: string;
  batch_number?: string;
  status: string;
  waybill_count?: number;
  created_at?: string;
};

export type Payable = {
  id: EntityId;
  amount: number;
  currency: string;
  status: string;
  created_at?: string;
};

export type ShippingChannel = {
  id: EntityId;
  name: string;
  code?: string;
  status?: string;
};

export type PackagingMethod = {
  id: EntityId;
  name: string;
  fee?: number;
  status?: string;
};

export type ValueAddedService = {
  id: EntityId;
  name: string;
  fee?: number;
  status?: string;
};

export type Product = {
  id: EntityId;
  name: string;
  sku?: string;
  status?: string;
};

export type ConfigResourceApi<T> = {
  list(client: AxiosInstance, params?: AdminQueryParams): Promise<PaginatedResponse<T> | T[]>;
  getById(client: AxiosInstance, id: EntityId): Promise<T>;
  create(client: AxiosInstance, payload: AdminRequestBody): Promise<T>;
  update(client: AxiosInstance, id: EntityId, payload: AdminRequestBody): Promise<T>;
};

export const adminAuth = {
  login(client: AxiosInstance, payload: AdminRequestBody): Promise<AdminSession> {
    return requestData(client, { method: "POST", url: "/admin/auth/login", data: payload });
  },
  getDashboard(client: AxiosInstance): Promise<DashboardData> {
    return requestData(client, { method: "GET", url: "/admin/dashboard" });
  },
};

export const adminParcels = {
  list(client: AxiosInstance, params?: AdminQueryParams): Promise<PaginatedResponse<Parcel>> {
    return requestData(client, { method: "GET", url: "/admin/parcels", params });
  },
  scanInbound(client: AxiosInstance, payload: AdminRequestBody): Promise<ScanInboundResponse> {
    return requestData(client, { method: "POST", url: "/admin/parcels/scan-inbound", data: payload });
  },
  listUnclaimed(client: AxiosInstance, params?: AdminQueryParams): Promise<PaginatedResponse<UnclaimedParcel>> {
    return requestData(client, { method: "GET", url: "/admin/unclaimed-parcels", params });
  },
  approveClaim(
    client: AxiosInstance,
    id: EntityId,
    payload?: AdminRequestBody,
  ): Promise<AdminUnclaimedParcelApproveResponse> {
    return requestData(client, { method: "POST", url: `/admin/unclaimed-parcels/${id}/approve`, data: payload });
  },
  rejectClaim(client: AxiosInstance, id: EntityId, payload?: AdminRequestBody): Promise<UnclaimedParcel> {
    return requestData(client, { method: "POST", url: `/admin/unclaimed-parcels/${id}/reject`, data: payload });
  },
};

export const adminWaybills = {
  list(client: AxiosInstance, params?: AdminQueryParams): Promise<PaginatedResponse<Waybill>> {
    return requestData(client, { method: "GET", url: "/admin/waybills", params });
  },
  review(client: AxiosInstance, id: EntityId, payload: AdminRequestBody): Promise<Waybill> {
    return requestData(client, { method: "POST", url: `/admin/waybills/${id}/review`, data: payload });
  },
  setFee(client: AxiosInstance, id: EntityId, payload: AdminRequestBody): Promise<Waybill> {
    return requestData(client, { method: "POST", url: `/admin/waybills/${id}/set-fee`, data: payload });
  },
  ship(client: AxiosInstance, id: EntityId, payload?: AdminRequestBody): Promise<Waybill> {
    return requestData(client, { method: "POST", url: `/admin/waybills/${id}/ship`, data: payload });
  },
  addTrackingEvent(client: AxiosInstance, id: EntityId, payload: AdminRequestBody): Promise<TrackingEvent> {
    return requestData(client, { method: "POST", url: `/admin/waybills/${id}/tracking-events`, data: payload });
  },
};

export const adminShippingBatches = {
  list(client: AxiosInstance, params?: AdminQueryParams): Promise<PaginatedResponse<ShippingBatch>> {
    return requestData(client, { method: "GET", url: "/admin/shipping-batches", params });
  },
  create(client: AxiosInstance, payload: AdminRequestBody): Promise<ShippingBatch> {
    return requestData(client, { method: "POST", url: "/admin/shipping-batches", data: payload });
  },
  addWaybills(client: AxiosInstance, id: EntityId, payload: AdminRequestBody): Promise<ShippingBatch> {
    return requestData(client, { method: "POST", url: `/admin/shipping-batches/${id}/waybills`, data: payload });
  },
  lock(client: AxiosInstance, id: EntityId): Promise<ShippingBatch> {
    return requestData(client, { method: "POST", url: `/admin/shipping-batches/${id}/lock` });
  },
  ship(client: AxiosInstance, id: EntityId, payload?: AdminRequestBody): Promise<ShippingBatch> {
    return requestData(client, { method: "POST", url: `/admin/shipping-batches/${id}/ship`, data: payload });
  },
  getPrintPreview(client: AxiosInstance, id: EntityId): Promise<unknown> {
    return requestData(client, { method: "GET", url: `/admin/shipping-batches/${id}/print-preview` });
  },
};

export const adminPurchases = {
  list(client: AxiosInstance, params?: AdminQueryParams): Promise<PaginatedResponse<PurchaseOrder>> {
    return requestData(client, { method: "GET", url: "/admin/purchase-orders", params });
  },
  review(client: AxiosInstance, id: EntityId, payload: AdminRequestBody): Promise<PurchaseOrder> {
    return requestData(client, { method: "POST", url: `/admin/purchase-orders/${id}/review`, data: payload });
  },
  markProcured(client: AxiosInstance, id: EntityId, payload?: AdminRequestBody): Promise<PurchaseOrder> {
    return requestData(client, { method: "POST", url: `/admin/purchase-orders/${id}/procure`, data: payload });
  },
  markArrived(client: AxiosInstance, id: EntityId, payload?: AdminRequestBody): Promise<PurchaseOrder> {
    return requestData(client, { method: "POST", url: `/admin/purchase-orders/${id}/mark-arrived`, data: payload });
  },
  convertToParcel(client: AxiosInstance, id: EntityId, payload: AdminRequestBody): Promise<PurchaseOrder> {
    return requestData(client, { method: "POST", url: `/admin/purchase-orders/${id}/convert-to-parcel`, data: payload });
  },
};

export const adminFinance = {
  listRemittances(client: AxiosInstance, params?: AdminQueryParams): Promise<PaginatedResponse<Remittance>> {
    return requestData(client, { method: "GET", url: "/admin/remittances", params });
  },
  approveRemittance(client: AxiosInstance, id: EntityId, payload?: AdminRequestBody): Promise<WalletTransaction> {
    return requestData(client, { method: "POST", url: `/admin/remittances/${id}/approve`, data: payload });
  },
  cancelRemittance(client: AxiosInstance, id: EntityId, payload?: AdminRequestBody): Promise<Remittance> {
    return requestData(client, { method: "POST", url: `/admin/remittances/${id}/cancel`, data: payload });
  },
  rechargeWallet(client: AxiosInstance, userId: EntityId, payload: AdminRequestBody): Promise<unknown> {
    return requestData(client, { method: "POST", url: `/admin/users/${userId}/wallet/recharge`, data: payload });
  },
  deductWallet(client: AxiosInstance, userId: EntityId, payload: AdminRequestBody): Promise<unknown> {
    return requestData(client, { method: "POST", url: `/admin/users/${userId}/wallet/deduct`, data: payload });
  },
  listPayables(client: AxiosInstance, params?: AdminQueryParams): Promise<PaginatedResponse<Payable>> {
    return requestData(client, { method: "GET", url: "/admin/payables", params });
  },
  listTransactions(client: AxiosInstance, params?: AdminQueryParams): Promise<PaginatedResponse<WalletTransaction>> {
    return requestData(client, { method: "GET", url: "/admin/wallet-transactions", params });
  },
};

export const adminMembers = {
  list(client: AxiosInstance, params?: AdminQueryParams): Promise<PaginatedResponse<AdminMember>> {
    return requestData(client, { method: "GET", url: "/admin/members", params });
  },
  getById(client: AxiosInstance, userId: EntityId): Promise<AdminMember> {
    return requestData(client, { method: "GET", url: `/admin/members/${userId}` });
  },
  freeze(client: AxiosInstance, userId: EntityId): Promise<unknown> {
    return requestData(client, { method: "POST", url: `/admin/members/${userId}/freeze` });
  },
  unfreeze(client: AxiosInstance, userId: EntityId): Promise<unknown> {
    return requestData(client, { method: "POST", url: `/admin/members/${userId}/unfreeze` });
  },
  resetPassword(client: AxiosInstance, userId: EntityId): Promise<unknown> {
    return requestData(client, { method: "POST", url: `/admin/members/${userId}/reset-password` });
  },
};

export const adminTickets = {
  list(client: AxiosInstance, params?: AdminQueryParams): Promise<PaginatedResponse<unknown>> {
    return requestData(client, { method: "GET", url: "/admin/tickets", params });
  },
  markProcessing(client: AxiosInstance, id: EntityId): Promise<unknown> {
    return requestData(client, { method: "POST", url: `/admin/tickets/${id}/mark-processing` });
  },
  sendMessage(client: AxiosInstance, id: EntityId, payload: AdminRequestBody): Promise<unknown> {
    return requestData(client, { method: "POST", url: `/admin/tickets/${id}/messages`, data: payload });
  },
  close(client: AxiosInstance, id: EntityId): Promise<unknown> {
    return requestData(client, { method: "POST", url: `/admin/tickets/${id}/close` });
  },
};

export const adminAuditLogs = {
  list(client: AxiosInstance, params?: AdminQueryParams): Promise<PaginatedResponse<AuditLogEntry>> {
    return requestData(client, { method: "GET", url: "/admin/audit-logs", params });
  },
};

export const adminIam = {
  async listRoles(client: AxiosInstance, params?: AdminQueryParams): Promise<AdminRole[]> {
    const payload = await requestData<ItemsResponse<AdminRole>>(client, {
      method: "GET",
      url: "/admin/roles",
      params,
    });
    return unwrapItemsResponse(payload, "adminIam.listRoles");
  },
  async listPermissions(client: AxiosInstance): Promise<AdminPermission[]> {
    const payload = await requestData<ItemsResponse<AdminPermission>>(client, {
      method: "GET",
      url: "/admin/permissions",
    });
    return unwrapItemsResponse(payload, "adminIam.listPermissions");
  },
  createRole(client: AxiosInstance, payload: AdminRequestBody): Promise<AdminRole> {
    return requestData(client, { method: "POST", url: "/admin/roles", data: payload });
  },
  updateRole(client: AxiosInstance, id: EntityId, payload: AdminRequestBody): Promise<AdminRole> {
    return requestData(client, { method: "PATCH", url: `/admin/roles/${id}`, data: payload });
  },
  deleteRole(client: AxiosInstance, id: EntityId): Promise<DeleteResponse> {
    return requestData(client, { method: "DELETE", url: `/admin/roles/${id}` });
  },
  async listAdminAccounts(client: AxiosInstance, params?: AdminQueryParams): Promise<AdminAccount[]> {
    const payload = await requestData<ItemsResponse<AdminAccount>>(client, {
      method: "GET",
      url: "/admin/admin-users",
      params,
    });
    return unwrapItemsResponse(payload, "adminIam.listAdminAccounts");
  },
  createAdminAccount(client: AxiosInstance, payload: AdminRequestBody): Promise<AdminAccount> {
    return requestData(client, { method: "POST", url: "/admin/admin-users", data: payload });
  },
  updateAdminAccount(client: AxiosInstance, id: EntityId, payload: AdminRequestBody): Promise<AdminAccount> {
    return requestData(client, { method: "PATCH", url: `/admin/admin-users/${id}`, data: payload });
  },
  deleteAdminAccount(client: AxiosInstance, id: EntityId): Promise<DeleteResponse> {
    return requestData(client, { method: "DELETE", url: `/admin/admin-users/${id}` });
  },
};

export const adminConfig = {
  warehouses: configResource<Warehouse>("/admin/warehouses"),
  shippingChannels: configResource<ShippingChannel>("/admin/shipping-channels"),
  packagingMethods: configResource<PackagingMethod>("/admin/packaging-methods"),
  valueAddedServices: configResource<ValueAddedService>("/admin/value-added-services"),
  products: configResource<Product>("/admin/products"),
  contentPages: configResource<ContentPage>("/admin/content/pages"),
};

function configResource<T>(url: string): ConfigResourceApi<T> {
  return {
    list(client: AxiosInstance, params?: AdminQueryParams): Promise<PaginatedResponse<T> | T[]> {
      return requestData(client, { method: "GET", url, params });
    },
    getById(client: AxiosInstance, id: EntityId): Promise<T> {
      return requestData(client, { method: "GET", url: `${url}/${id}` });
    },
    create(client: AxiosInstance, payload: AdminRequestBody): Promise<T> {
      return requestData(client, { method: "POST", url, data: payload });
    },
    update(client: AxiosInstance, id: EntityId, payload: AdminRequestBody): Promise<T> {
      return requestData(client, { method: "PATCH", url: `${url}/${id}`, data: payload });
    },
  };
}
