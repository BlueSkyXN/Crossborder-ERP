import { requestData } from "../../api/client";
import type { Warehouse, WarehouseAddress } from "./types";

export function fetchWarehouses() {
  return requestData<{ items: Warehouse[] }>({
    method: "GET",
    url: "/warehouses",
  }).then((result) => result.items);
}

export function fetchWarehouseAddress(id: number) {
  return requestData<WarehouseAddress>({
    method: "GET",
    url: `/warehouses/${id}/address`,
  });
}
