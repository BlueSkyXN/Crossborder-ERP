import { requestData } from "../../api/client";
import type {
  InboundPayload,
  Parcel,
  ScanInboundPayload,
  ScanInboundResponse,
  UnclaimedParcel,
  UnclaimedParcelCreatePayload,
} from "./types";

type ListResponse<T> = {
  items: T[];
};

function listItems<T>(url: string) {
  return requestData<ListResponse<T>>({ method: "GET", url }).then((result) => result.items);
}

export const parcelWmsApi = {
  listParcels: () => listItems<Parcel>("/admin/parcels"),
  inboundParcel: (parcelId: number, payload: InboundPayload) =>
    requestData<Parcel>({ method: "POST", url: `/admin/parcels/${parcelId}/inbound`, data: payload }),
  scanInbound: (payload: ScanInboundPayload) =>
    requestData<ScanInboundResponse>({
      method: "POST",
      url: "/admin/parcels/scan-inbound",
      data: payload,
    }),
  listUnclaimedParcels: () => listItems<UnclaimedParcel>("/admin/unclaimed-parcels"),
  createUnclaimedParcel: (payload: UnclaimedParcelCreatePayload) =>
    requestData<UnclaimedParcel>({ method: "POST", url: "/admin/unclaimed-parcels", data: payload }),
};
