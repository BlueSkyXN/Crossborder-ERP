import { requestData } from "../../api/client";
import type { Warehouse } from "../warehouses/types";
import type {
  PurchaseArrivedPayload,
  PurchaseCancelPayload,
  PurchaseConvertPayload,
  PurchaseExceptionPayload,
  PurchaseOrder,
  PurchaseProcurePayload,
  PurchaseReviewPayload,
} from "./types";

type ListResponse<T> = {
  items: T[];
};

function listItems<T>(url: string) {
  return requestData<ListResponse<T>>({ method: "GET", url }).then((result) => result.items);
}

export const purchaseOpsApi = {
  listPurchaseOrders: () => listItems<PurchaseOrder>("/admin/purchase-orders"),
  listWarehouseOptions: () => listItems<Warehouse>("/admin/purchase-warehouses"),
  reviewPurchaseOrder: (orderId: number, payload: PurchaseReviewPayload) =>
    requestData<PurchaseOrder>({
      method: "POST",
      url: `/admin/purchase-orders/${orderId}/review`,
      data: payload,
    }),
  procurePurchaseOrder: (orderId: number, payload: PurchaseProcurePayload) =>
    requestData<PurchaseOrder>({
      method: "POST",
      url: `/admin/purchase-orders/${orderId}/procure`,
      data: payload,
    }),
  markPurchaseOrderArrived: (orderId: number, payload: PurchaseArrivedPayload) =>
    requestData<PurchaseOrder>({
      method: "POST",
      url: `/admin/purchase-orders/${orderId}/mark-arrived`,
      data: payload,
    }),
  convertPurchaseOrderToParcel: (orderId: number, payload: PurchaseConvertPayload) =>
    requestData<PurchaseOrder>({
      method: "POST",
      url: `/admin/purchase-orders/${orderId}/convert-to-parcel`,
      data: payload,
    }),
  markPurchaseOrderException: (orderId: number, payload: PurchaseExceptionPayload) =>
    requestData<PurchaseOrder>({
      method: "POST",
      url: `/admin/purchase-orders/${orderId}/mark-exception`,
      data: payload,
    }),
  cancelPurchaseOrder: (orderId: number, payload: PurchaseCancelPayload) =>
    requestData<PurchaseOrder>({
      method: "POST",
      url: `/admin/purchase-orders/${orderId}/cancel`,
      data: payload,
    }),
};
