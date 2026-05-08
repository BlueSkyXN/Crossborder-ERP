import type { ParcelStatus } from "../parcels/types";

export type WaybillStatus =
  | "PENDING_REVIEW"
  | "PENDING_PACKING"
  | "PENDING_PAYMENT"
  | "PENDING_SHIPMENT"
  | "SHIPPED"
  | "SIGNED"
  | "CANCELLED"
  | "PROBLEM";

export type TrackingEventSource = "MANUAL" | "MEMBER" | "SYSTEM";

export type WaybillParcel = {
  id: number;
  parcel_id: number;
  parcel_no: string;
  tracking_no: string;
  parcel_status: ParcelStatus;
  weight_kg: string | null;
  created_at: string;
};

export type TrackingEvent = {
  id: number;
  waybill: number;
  event_time: string;
  location: string;
  status_text: string;
  description: string;
  source: TrackingEventSource;
  operator_name: string | null;
  created_at: string;
};

export type Waybill = {
  id: number;
  waybill_no: string;
  user: number;
  user_email: string;
  warehouse: number;
  warehouse_name: string;
  channel: number | null;
  channel_name: string | null;
  status: WaybillStatus;
  destination_country: string;
  recipient_snapshot: Record<string, unknown>;
  fee_total: string;
  fee_detail_json: Record<string, unknown>;
  remark: string;
  review_remark: string;
  fee_remark: string;
  cancel_reason: string;
  reviewed_by_name: string | null;
  fee_set_by_name: string | null;
  reviewed_at: string | null;
  fee_set_at: string | null;
  paid_at: string | null;
  shipped_at: string | null;
  signed_at: string | null;
  parcels: WaybillParcel[];
  tracking_events: TrackingEvent[];
  created_at: string;
  updated_at: string;
};

export type WaybillCreatePayload = {
  parcel_ids: number[];
  address_id?: number;
  destination_country?: string;
  recipient_name?: string;
  recipient_phone?: string;
  recipient_address?: string;
  postal_code?: string;
  remark?: string;
};

export type WaybillPayPayload = {
  idempotency_key: string;
};

export type Wallet = {
  id: number;
  user: number;
  user_email: string;
  currency: string;
  balance: string;
  frozen_balance: string;
  created_at: string;
  updated_at: string;
};

export type WalletTransaction = {
  id: number;
  wallet: number;
  user: number;
  user_email: string;
  payment_order: number | null;
  payment_no: string | null;
  operator_name: string | null;
  type: string;
  direction: "INCREASE" | "DECREASE";
  amount: string;
  balance_after: string;
  business_type: string;
  business_id: number | null;
  remark: string;
  created_at: string;
};

export type PaymentOrder = {
  id: number;
  payment_no: string;
  user: number;
  user_email: string;
  business_type: string;
  business_id: number;
  status: string;
  amount: string;
  currency: string;
  idempotency_key: string | null;
  remark: string;
  paid_at: string | null;
  created_at: string;
  updated_at: string;
};

export type WaybillPayResult = {
  payment_order: PaymentOrder;
  wallet: Wallet;
  waybill: Waybill;
  already_paid: boolean;
};
