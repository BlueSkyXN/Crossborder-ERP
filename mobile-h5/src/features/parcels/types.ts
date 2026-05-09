export type ParcelStatus =
  | "PENDING_INBOUND"
  | "IN_STOCK"
  | "PACKING_REQUESTED"
  | "PACKED"
  | "OUTBOUND"
  | "CANCELLED"
  | "PROBLEM";

export type UnclaimedParcelStatus = "UNCLAIMED" | "CLAIM_PENDING" | "CLAIMED";

export type ParcelItem = {
  id: number;
  name: string;
  quantity: number;
  declared_value: string;
  product_url: string;
  remark: string;
};

export type ParcelPhoto = {
  id: number;
  file_id: string;
  photo_type: string;
  file_name: string;
  content_type: string;
  download_url: string;
  created_at: string;
};

export type Parcel = {
  id: number;
  parcel_no: string;
  user_email: string;
  warehouse: number;
  warehouse_name: string;
  tracking_no: string;
  carrier: string;
  status: ParcelStatus;
  weight_kg: string | null;
  length_cm: string | null;
  width_cm: string | null;
  height_cm: string | null;
  remark: string;
  inbound_at: string | null;
  items: ParcelItem[];
  photos: ParcelPhoto[];
  created_at: string;
  updated_at: string;
};

export type ParcelForecastPayload = {
  warehouse_id: number;
  tracking_no: string;
  carrier?: string;
  remark?: string;
  items?: Array<{
    name: string;
    quantity: number;
    declared_value: string;
    product_url?: string;
    remark?: string;
  }>;
};

export type PublicUnclaimedParcel = {
  id: number;
  warehouse: number;
  warehouse_name: string;
  tracking_no_masked: string;
  status: UnclaimedParcelStatus;
  is_mine: boolean;
  weight_kg: string | null;
  created_at: string;
  updated_at: string;
};

export type UnclaimedClaimPayload = {
  claim_note?: string;
  claim_contact?: string;
};
