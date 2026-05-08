export type PurchaseOrderStatus =
  | "PENDING_PAYMENT"
  | "PENDING_REVIEW"
  | "PENDING_PROCUREMENT"
  | "PROCURED"
  | "ARRIVED"
  | "COMPLETED"
  | "CANCELLED"
  | "EXCEPTION";

export type PurchaseOrderSourceType = "PRODUCT" | "MANUAL";

export type ProcurementTaskStatus = "PENDING" | "PROCURED" | "ARRIVED" | "CANCELLED";

export type PurchaseOrderItem = {
  id: number;
  product: number | null;
  product_title: string | null;
  sku: number | null;
  sku_code: string | null;
  name: string;
  quantity: number;
  unit_price: string;
  actual_price: string;
  product_url: string;
  remark: string;
  created_at: string;
};

export type ProcurementTask = {
  id: number;
  assignee_name: string | null;
  status: ProcurementTaskStatus;
  purchase_amount: string;
  external_order_no: string;
  tracking_no: string;
  remark: string;
  procured_at: string | null;
  arrived_at: string | null;
  created_at: string;
  updated_at: string;
};

export type ConvertedParcel = {
  id: number;
  parcel_no: string;
  tracking_no: string;
  status: string;
  warehouse: number;
  warehouse_name: string;
  inbound_at: string | null;
};

export type PurchaseOrder = {
  id: number;
  order_no: string;
  user: number;
  user_email: string;
  status: PurchaseOrderStatus;
  source_type: PurchaseOrderSourceType;
  total_amount: string;
  service_fee: string;
  paid_at: string | null;
  reviewed_by_name: string | null;
  reviewed_at: string | null;
  review_remark: string;
  converted_parcel: ConvertedParcel | null;
  items: PurchaseOrderItem[];
  procurement_task?: ProcurementTask | null;
  created_at: string;
  updated_at: string;
};

export type PurchaseReviewPayload = {
  review_remark?: string;
};

export type PurchaseProcurePayload = {
  purchase_amount?: string;
  external_order_no?: string;
  tracking_no?: string;
  remark?: string;
};

export type PurchaseArrivedPayload = {
  tracking_no?: string;
  remark?: string;
};

export type PurchaseConvertPayload = {
  warehouse_id: number;
  tracking_no?: string;
  carrier?: string;
  weight_kg: string;
  length_cm?: string;
  width_cm?: string;
  height_cm?: string;
  remark?: string;
};

export type PurchaseExceptionPayload = {
  remark?: string;
};

export type PurchaseCancelPayload = {
  reason?: string;
};
