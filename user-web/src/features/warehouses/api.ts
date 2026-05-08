import { requestData } from "../../api/client";
import type { MemberWarehouseAddress, Warehouse } from "./types";

export function fetchWarehouses() {
  return requestData<{ items: Warehouse[] }>({
    method: "GET",
    url: "/warehouses",
  }).then((result) => result.items);
}

export function fetchWarehouseAddress(warehouseId: number) {
  return requestData<MemberWarehouseAddress>({
    method: "GET",
    url: `/warehouses/${warehouseId}/address`,
  });
}
