import { requestData } from "../../api/client";
import type {
  PackagingMethod,
  PackagingMethodPayload,
  RatePlan,
  RatePlanPayload,
  ShippingChannel,
  ShippingChannelPayload,
  ValueAddedService,
  ValueAddedServicePayload,
  Warehouse,
  WarehousePayload,
} from "./types";

type ListResponse<T> = {
  items: T[];
};

function listItems<T>(url: string) {
  return requestData<ListResponse<T>>({ method: "GET", url }).then((result) => result.items);
}

function createItem<T, TPayload>(url: string, payload: TPayload) {
  return requestData<T>({ method: "POST", url, data: payload });
}

function updateItem<T, TPayload>(url: string, id: number, payload: Partial<TPayload>) {
  return requestData<T>({ method: "PATCH", url: `${url}/${id}`, data: payload });
}

function deleteItem(url: string, id: number) {
  return requestData<{ deleted: boolean }>({ method: "DELETE", url: `${url}/${id}` });
}

const endpoints = {
  warehouses: "/admin/warehouses",
  shippingChannels: "/admin/shipping-channels",
  packagingMethods: "/admin/packaging-methods",
  valueAddedServices: "/admin/value-added-services",
  ratePlans: "/admin/rate-plans",
} as const;

export const warehouseConfigApi = {
  listWarehouses: () => listItems<Warehouse>(endpoints.warehouses),
  createWarehouse: (payload: WarehousePayload) =>
    createItem<Warehouse, WarehousePayload>(endpoints.warehouses, payload),
  updateWarehouse: (id: number, payload: Partial<WarehousePayload>) =>
    updateItem<Warehouse, WarehousePayload>(endpoints.warehouses, id, payload),
  deleteWarehouse: (id: number) => deleteItem(endpoints.warehouses, id),

  listShippingChannels: () => listItems<ShippingChannel>(endpoints.shippingChannels),
  createShippingChannel: (payload: ShippingChannelPayload) =>
    createItem<ShippingChannel, ShippingChannelPayload>(endpoints.shippingChannels, payload),
  updateShippingChannel: (id: number, payload: Partial<ShippingChannelPayload>) =>
    updateItem<ShippingChannel, ShippingChannelPayload>(endpoints.shippingChannels, id, payload),
  deleteShippingChannel: (id: number) => deleteItem(endpoints.shippingChannels, id),

  listPackagingMethods: () => listItems<PackagingMethod>(endpoints.packagingMethods),
  createPackagingMethod: (payload: PackagingMethodPayload) =>
    createItem<PackagingMethod, PackagingMethodPayload>(endpoints.packagingMethods, payload),
  updatePackagingMethod: (id: number, payload: Partial<PackagingMethodPayload>) =>
    updateItem<PackagingMethod, PackagingMethodPayload>(endpoints.packagingMethods, id, payload),
  deletePackagingMethod: (id: number) => deleteItem(endpoints.packagingMethods, id),

  listValueAddedServices: () => listItems<ValueAddedService>(endpoints.valueAddedServices),
  createValueAddedService: (payload: ValueAddedServicePayload) =>
    createItem<ValueAddedService, ValueAddedServicePayload>(endpoints.valueAddedServices, payload),
  updateValueAddedService: (id: number, payload: Partial<ValueAddedServicePayload>) =>
    updateItem<ValueAddedService, ValueAddedServicePayload>(endpoints.valueAddedServices, id, payload),
  deleteValueAddedService: (id: number) => deleteItem(endpoints.valueAddedServices, id),

  listRatePlans: () => listItems<RatePlan>(endpoints.ratePlans),
  createRatePlan: (payload: RatePlanPayload) =>
    createItem<RatePlan, RatePlanPayload>(endpoints.ratePlans, payload),
  updateRatePlan: (id: number, payload: Partial<RatePlanPayload>) =>
    updateItem<RatePlan, RatePlanPayload>(endpoints.ratePlans, id, payload),
  deleteRatePlan: (id: number) => deleteItem(endpoints.ratePlans, id),
};
