import { apiClient, requestData } from "../../api/client";
import type {
  Parcel,
  ParcelForecastPayload,
  ParcelImportJob,
  PublicUnclaimedParcel,
  UnclaimedClaimPayload,
} from "./types";

type ListResponse<T> = {
  items: T[];
};

export function fetchParcels() {
  return requestData<ListResponse<Parcel>>({
    method: "GET",
    url: "/parcels",
  }).then((result) => result.items);
}

export function fetchParcel(parcelId: number) {
  return requestData<Parcel>({
    method: "GET",
    url: `/parcels/${parcelId}`,
  });
}

export function createParcelForecast(payload: ParcelForecastPayload) {
  return requestData<Parcel>({
    method: "POST",
    url: "/parcels/forecast",
    data: payload,
  });
}

export function downloadParcelImportTemplate() {
  return apiClient
    .request<Blob>({
      method: "GET",
      url: "/parcels/import-template",
      responseType: "blob",
    })
    .then((response) => response.data);
}

export function importParcelForecasts(fileId: string) {
  return requestData<ParcelImportJob>({
    method: "POST",
    url: "/parcels/imports",
    data: { file_id: fileId },
  });
}

export function fetchParcelImportJobs() {
  return requestData<ListResponse<ParcelImportJob>>({
    method: "GET",
    url: "/parcels/imports",
  }).then((result) => result.items);
}

export function exportParcelsCsv() {
  return apiClient
    .request<Blob>({
      method: "GET",
      url: "/parcels/export",
      responseType: "blob",
    })
    .then((response) => response.data);
}

export function fetchPackableParcels() {
  return requestData<ListResponse<Parcel>>({
    method: "GET",
    url: "/parcels/packable",
  }).then((result) => result.items);
}

export function fetchUnclaimedParcels(keyword: string) {
  return requestData<ListResponse<PublicUnclaimedParcel>>({
    method: "GET",
    url: "/unclaimed-parcels",
    params: keyword.trim() ? { keyword: keyword.trim() } : undefined,
  }).then((result) => result.items);
}

export function claimUnclaimedParcel(unclaimedId: number, payload: UnclaimedClaimPayload) {
  return requestData<PublicUnclaimedParcel>({
    method: "POST",
    url: `/unclaimed-parcels/${unclaimedId}/claim`,
    data: payload,
  });
}
