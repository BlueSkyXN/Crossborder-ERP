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

export type InboundPayload = {
  weight_kg: string;
  length_cm?: string;
  width_cm?: string;
  height_cm?: string;
  photo_file_ids?: string[];
  remark?: string;
};

export type ScanInboundPayload = InboundPayload & {
  warehouse_id: number;
  tracking_no: string;
};

export type UnclaimedParcel = {
  id: number;
  warehouse: number;
  warehouse_name: string;
  tracking_no: string;
  status: UnclaimedParcelStatus;
  description: string;
  claimed_by_email: string | null;
  claim_note: string;
  claim_contact: string;
  claimed_at: string | null;
  reviewed_by_name: string | null;
  review_note: string;
  reviewed_at: string | null;
  weight_kg: string | null;
  dimensions_json: Record<string, string>;
  created_at: string;
  updated_at: string;
};

export type ScanInboundResponse = {
  parcel: Parcel | null;
  unclaimed_parcel: UnclaimedParcel | null;
  created_unclaimed?: boolean;
};

export type UnclaimedParcelCreatePayload = {
  warehouse_id: number;
  tracking_no: string;
  description?: string;
  weight_kg?: string;
};

export type UnclaimedParcelReviewPayload = {
  review_note?: string;
};

export type UnclaimedParcelApproveResponse = {
  parcel: Parcel;
  unclaimed_parcel: UnclaimedParcel;
};
