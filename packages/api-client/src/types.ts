export type EntityId = string | number;

export type ApiEnvelope<T> = {
  code: string;
  message: string;
  data: T;
};

export class ApiError extends Error {
  code: string;
  status?: number;
  data?: unknown;

  constructor(message: string, code: string, status?: number, data?: unknown) {
    super(message);
    this.name = "ApiError";
    this.code = code;
    this.status = status;
    this.data = data;
  }
}

export type PaginatedResponse<T> = {
  items: T[];
  pagination: {
    page: number;
    page_size: number;
    total: number;
    total_pages: number;
  };
};

// ── Member / User ──

export type MemberProfile = {
  member_no: string;
  display_name: string;
  level: string;
  warehouse_code: string;
};

export type Member = {
  id: EntityId;
  email: string;
  phone: string | null;
  status: string;
  profile: MemberProfile;
};

// ── Warehouse ──

export type WarehouseAddress = {
  address_line: string;
  receiver_name: string;
  phone: string;
  postal_code: string;
};

export type Warehouse = {
  id: EntityId;
  code: string;
  name: string;
  country: string;
  city: string;
  status: string;
  address: WarehouseAddress;
};

export type MemberWarehouseAddress = {
  warehouse_code: string;
  warehouse_name: string;
  member_warehouse_code: string;
  receiver_name: string;
  phone: string;
  postal_code: string;
  address_line: string;
  full_address: string;
};

// ── Member Addresses ──

export type Address = {
  id: EntityId;
  user: EntityId;
  recipient_name: string;
  phone: string;
  country: string;
  region: string;
  city: string;
  postal_code: string;
  address_line: string;
  company: string;
  is_default: boolean;
  status: string;
  full_address: string;
  created_at: string;
  updated_at: string;
};

// ── Parcel ──

export type ParcelItem = {
  id: EntityId;
  name: string;
  quantity: number;
  declared_value: number;
  product_url: string;
  remark: string;
};

export type ParcelPhoto = {
  id: EntityId;
  file_id: string;
  photo_type: string;
  file_name: string;
  content_type: string;
  download_url: string;
  created_at: string;
};

export type Parcel = {
  id: EntityId;
  parcel_no: string;
  user_email: string;
  warehouse: EntityId;
  warehouse_name: string;
  tracking_no: string;
  carrier: string;
  status: string;
  weight_kg: number | null;
  length_cm: number | null;
  width_cm: number | null;
  height_cm: number | null;
  remark: string;
  inbound_at: string | null;
  items: ParcelItem[];
  photos: ParcelPhoto[];
  created_at: string;
  updated_at: string;
};

// ── Waybill ──

export type TrackingEvent = {
  id: EntityId;
  waybill: EntityId;
  event_time: string;
  location: string | null;
  status_text: string;
  description: string;
  source: string;
  operator_name: string | null;
  created_at: string;
};

export type WaybillParcel = {
  id: EntityId;
  parcel_id: EntityId;
  parcel_no: string;
  tracking_no: string;
  parcel_status: string;
  weight_kg: number | null;
  created_at: string;
};

export type Waybill = {
  id: EntityId;
  waybill_no: string;
  user: EntityId;
  user_email: string;
  warehouse: EntityId;
  warehouse_name: string;
  channel: EntityId | null;
  channel_name: string | null;
  status: string;
  destination_country: string;
  recipient_snapshot: Record<string, unknown> | null;
  fee_total: number;
  fee_detail_json: Record<string, unknown> | null;
  remark: string;
  review_remark: string;
  fee_remark: string;
  cancel_reason: string;
  shipping_batch: EntityId | null;
  shipping_batch_no: string | null;
  transfer_no: string | null;
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

// ── Purchase Order ──

export type PurchaseOrderItem = {
  id: EntityId;
  product: EntityId | null;
  product_title: string;
  sku: EntityId | null;
  sku_code: string;
  name: string;
  quantity: number;
  unit_price: number;
  actual_price: number | null;
  product_url: string;
  remark: string;
  created_at: string;
};

export type ProcurementTask = {
  id: EntityId;
  assignee_name: string | null;
  status: string;
  purchase_amount: number | null;
  external_order_no: string;
  tracking_no: string;
  remark: string;
  procured_at: string | null;
  arrived_at: string | null;
  created_at: string;
  updated_at: string;
};

export type ConvertedParcel = {
  id: EntityId;
  parcel_no: string;
  tracking_no: string;
  status: string;
  warehouse: EntityId;
  warehouse_name: string;
  inbound_at: string | null;
};

export type PurchaseOrder = {
  id: EntityId;
  order_no: string;
  user: EntityId;
  user_email: string;
  status: string;
  source_type: string;
  total_amount: number;
  service_fee: number;
  paid_at: string | null;
  reviewed_by_name: string | null;
  reviewed_at: string | null;
  review_remark: string;
  converted_parcel: ConvertedParcel | null;
  items: PurchaseOrderItem[];
  procurement_task: ProcurementTask | null;
  created_at: string;
  updated_at: string;
};

// ── Finance ──

export type WalletInfo = {
  id: EntityId;
  user: EntityId;
  user_email: string;
  currency: string;
  balance: number;
  frozen_balance: number;
  created_at: string;
  updated_at: string;
};

export type WalletTransaction = {
  id: EntityId;
  wallet: EntityId;
  user: EntityId;
  user_email: string;
  payment_order: EntityId | null;
  payment_no: string | null;
  operator_name: string | null;
  type: string;
  direction: string;
  amount: number;
  balance_after: number;
  business_type: string;
  business_id: EntityId | null;
  remark: string;
  created_at: string;
};

export type Remittance = {
  id: EntityId;
  request_no: string;
  user: EntityId;
  user_email: string;
  wallet: EntityId;
  operator_name: string | null;
  amount: number;
  currency: string;
  proof_file_id: string | null;
  proof_file_name: string | null;
  proof_download_url: string | null;
  status: string;
  remark: string;
  review_remark: string;
  reviewed_at: string | null;
  completed_at: string | null;
  created_at: string;
};

// ── Ticket ──

export type Ticket = {
  id: EntityId;
  subject: string;
  status: string;
  created_at: string;
};

// ── Content ──

export type ContentPage = {
  id: EntityId;
  slug: string;
  title: string;
  body: string;
  category: string;
  is_published: boolean;
};

// ── Dashboard ──

export type SummaryCard = {
  key: string;
  label: string;
  value: number;
  hint?: string;
  path?: string;
  tone?: string;
};

export type WorkQueueItem = {
  key: string;
  label: string;
  value: number;
  path?: string;
  tone?: string;
};

export type AuditLogEntry = {
  id: number;
  action: string;
  operator_label: string;
  target_type: string;
  status_code: number;
  created_at: string;
};

export type DashboardData = {
  generated_at: string;
  summary_cards: SummaryCard[];
  work_queue: WorkQueueItem[];
  modules: { key: string; label: string; path: string; metrics: unknown[] }[];
  recent_audit_logs: AuditLogEntry[];
};

// ── Admin IAM ──

export type AdminPermission = {
  id: EntityId;
  code: string;
  name: string;
  type: string;
  resource: string;
};

export type AdminRole = {
  id: EntityId;
  code: string;
  name: string;
  description: string;
  permissions: AdminPermission[];
  permission_codes: string[];
};

export type AdminAccount = {
  id: EntityId;
  email: string;
  name: string;
  status: string;
  is_super_admin: boolean;
  roles: string[];
  permission_codes: string[];
  last_login_at: string | null;
  created_at: string;
};

// ── Unclaimed Parcel ──

export type UnclaimedParcel = {
  id: EntityId;
  warehouse: EntityId;
  warehouse_name: string;
  tracking_no: string;
  status: string;
  description: string;
  claimed_by_email: string | null;
  claim_note: string | null;
  claim_contact: string | null;
  claimed_at: string | null;
  reviewed_by_name: string | null;
  review_note: string | null;
  reviewed_at: string | null;
  weight_kg: number | null;
  dimensions_json: Record<string, unknown> | null;
  created_at: string;
  updated_at: string;
};

// ── Admin Member ──

export type AdminMember = {
  id: EntityId;
  email: string;
  phone: string | null;
  status: string;
  last_login_at: string | null;
  created_at: string;
  updated_at: string;
  profile: MemberProfile;
};
