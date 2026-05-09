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
  parcel_status: string;
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
  shipping_batch: number | null;
  shipping_batch_no: string | null;
  transfer_no: string;
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

export type WaybillReviewPayload = {
  review_remark?: string;
};

export type WaybillFeePayload = {
  fee_total: string;
  fee_detail_json?: Record<string, string>;
  fee_remark?: string;
};

export type WaybillTrackingPayload = {
  status_text: string;
  location?: string;
  description?: string;
  event_time?: string;
};

export type ShippingBatchStatus = "DRAFT" | "LOCKED" | "SHIPPED" | "CANCELLED";

export type ShippingBatchWaybill = {
  id: number;
  waybill_no: string;
  user_email: string;
  warehouse_name: string;
  channel_name: string | null;
  status: WaybillStatus;
  destination_country: string;
  recipient_snapshot: Record<string, unknown>;
  fee_total: string;
  transfer_no: string;
  parcels: WaybillParcel[];
  created_at: string;
  updated_at: string;
};

export type ShippingBatch = {
  id: number;
  batch_no: string;
  name: string;
  status: ShippingBatchStatus;
  warehouse: number | null;
  warehouse_name: string | null;
  channel: number | null;
  channel_name: string | null;
  carrier_batch_no: string;
  transfer_no: string;
  ship_note: string;
  created_by_name: string | null;
  locked_by_name: string | null;
  shipped_by_name: string | null;
  locked_at: string | null;
  shipped_at: string | null;
  waybills: ShippingBatchWaybill[];
  waybill_count: number;
  created_at: string;
  updated_at: string;
};

export type ShippingBatchPayload = {
  name?: string;
  carrier_batch_no?: string;
  transfer_no?: string;
  ship_note?: string;
  waybill_ids?: number[];
};

export type ShippingBatchWaybillIdsPayload = {
  waybill_ids: number[];
};

export type ShippingBatchPrintTemplate = "label" | "picking" | "handover";

export type ShippingBatchPrintPreview = {
  template: ShippingBatchPrintTemplate;
  batch: {
    id: number;
    batch_no: string;
    name: string;
    status: ShippingBatchStatus;
    warehouse_name: string;
    channel_name: string;
    carrier_batch_no: string;
    transfer_no: string;
    ship_note: string;
    waybill_count: number;
    parcel_count: number;
    total_weight_kg: string;
    generated_at: string;
  };
  items: Array<{
    waybill_no: string;
    transfer_no: string;
    status: WaybillStatus;
    user_email: string;
    warehouse_name: string;
    channel_name: string;
    destination_country: string;
    recipient: Record<string, unknown>;
    parcels: Array<{
      parcel_no: string;
      tracking_no: string;
      weight_kg: string | null;
      status: string;
    }>;
    parcel_count: number;
  }>;
};

export type WalletAdjustmentPayload = {
  amount: string;
  currency?: string;
  remark?: string;
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
