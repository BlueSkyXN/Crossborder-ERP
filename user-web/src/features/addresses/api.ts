import { requestData } from "../../api/client";
import type { Address, AddressPayload } from "./types";

type ListResponse<T> = {
  items: T[];
};

export function fetchAddresses() {
  return requestData<ListResponse<Address>>({ method: "GET", url: "/addresses" }).then((result) => result.items);
}

export function createAddress(payload: AddressPayload) {
  return requestData<Address>({ method: "POST", url: "/addresses", data: payload });
}

export function updateAddress(addressId: number, payload: AddressPayload) {
  return requestData<Address>({ method: "PUT", url: `/addresses/${addressId}`, data: payload });
}

export function deleteAddress(addressId: number) {
  return requestData<Address>({ method: "DELETE", url: `/addresses/${addressId}` });
}

export function setDefaultAddress(addressId: number) {
  return requestData<Address>({ method: "POST", url: `/addresses/${addressId}/set-default` });
}
