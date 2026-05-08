import { requestData } from "../../api/client";
import type { Parcel, ParcelForecastPayload } from "./types";

type ListResponse<T> = {
  items: T[];
};

export function fetchParcels() {
  return requestData<ListResponse<Parcel>>({
    method: "GET",
    url: "/parcels",
  }).then((result) => result.items);
}

export function createParcelForecast(payload: ParcelForecastPayload) {
  return requestData<Parcel>({
    method: "POST",
    url: "/parcels/forecast",
    data: payload,
  });
}
