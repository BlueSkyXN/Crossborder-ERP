import type { PaymentOrder, Wallet, WalletTransaction } from "../waybills/types";

export type CatalogStatus = "ACTIVE" | "DISABLED";

export type ProductSku = {
  id: number;
  product: number;
  product_title: string;
  sku_code: string;
  spec_json: Record<string, unknown>;
  price: string;
  stock: number;
  status: CatalogStatus;
  created_at: string;
  updated_at: string;
};

export type Product = {
  id: number;
  category: number | null;
  category_name: string | null;
  title: string;
  description: string;
  status: CatalogStatus;
  main_image_file_id: string;
  skus: ProductSku[];
  created_at: string;
  updated_at: string;
};

export type CartItem = {
  id: number;
  product: number;
  product_title: string;
  sku: number;
  sku_code: string;
  sku_spec_json: Record<string, unknown>;
  sku_price: string;
  quantity: number;
  line_amount: string;
  created_at: string;
  updated_at: string;
};

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

export type ProcurementTask = {
  id: number;
  assignee_name: string | null;
  status: string;
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
  procurement_task: ProcurementTask | null;
  created_at: string;
  updated_at: string;
};

export type AddCartItemPayload = {
  sku_id: number;
  quantity: number;
};

export type UpdateCartItemPayload = {
  quantity: number;
};

export type PurchaseOrderCreatePayload = {
  cart_item_ids?: number[];
  service_fee?: string;
};

export type ManualPurchaseOrderCreatePayload = {
  service_fee?: string;
  items: Array<{
    name: string;
    quantity: number;
    unit_price: string;
    actual_price?: string | null;
    product_url?: string;
    remark?: string;
  }>;
};

export type ParsedPurchaseLink = {
  source_url: string;
  normalized_url: string;
  provider: string;
  provider_label: string;
  external_item_id: string;
  name: string;
  quantity: number;
  unit_price: string;
  product_url: string;
  remark: string;
};

export type PurchaseLinkParsePayload = {
  source_url: string;
};

export type PurchasePayPayload = {
  idempotency_key: string;
};

export type PurchasePayResult = {
  payment_order: PaymentOrder;
  wallet: Wallet;
  purchase_order: PurchaseOrder;
  already_paid: boolean;
};

export type PurchaseWalletSnapshot = {
  wallet: Wallet;
  transactions: WalletTransaction[];
};
