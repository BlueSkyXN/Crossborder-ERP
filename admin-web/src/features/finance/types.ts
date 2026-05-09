export type RemittanceStatus = "PENDING" | "COMPLETED" | "CANCELLED";
export type MasterDataStatus = "ACTIVE" | "DISABLED";
export type PayableStatus = "PENDING_REVIEW" | "CONFIRMED" | "SETTLED" | "CANCELLED";

export type RechargeRequest = {
  id: number;
  request_no: string;
  user: number;
  user_email: string;
  wallet: number;
  operator_name: string | null;
  amount: string;
  currency: string;
  proof_file_id: string;
  proof_file_name: string;
  proof_download_url: string;
  status: RemittanceStatus;
  remark: string;
  review_remark: string;
  reviewed_at: string | null;
  completed_at: string | null;
  created_at: string;
};

export type RemittanceReviewPayload = {
  review_remark?: string;
};

export type Supplier = {
  id: number;
  code: string;
  name: string;
  status: MasterDataStatus;
  contact_name: string;
  phone: string;
  email: string;
  address: string;
  bank_account: string;
  remark: string;
  created_at: string;
  updated_at: string;
};

export type SupplierPayload = {
  code: string;
  name: string;
  status?: MasterDataStatus;
  contact_name?: string;
  phone?: string;
  email?: string;
  address?: string;
  bank_account?: string;
  remark?: string;
};

export type CostType = {
  id: number;
  code: string;
  name: string;
  category: string;
  status: MasterDataStatus;
  remark: string;
  created_at: string;
  updated_at: string;
};

export type CostTypePayload = {
  code: string;
  name: string;
  category?: string;
  status?: MasterDataStatus;
  remark?: string;
};

export type Payable = {
  id: number;
  payable_no: string;
  supplier: number;
  supplier_code: string;
  supplier_name: string;
  cost_type: number;
  cost_type_code: string;
  cost_type_name: string;
  status: PayableStatus;
  amount: string;
  currency: string;
  source_type: string;
  source_id: number | null;
  description: string;
  due_date: string | null;
  created_by_name: string | null;
  confirmed_by_name: string | null;
  settled_by_name: string | null;
  cancelled_by_name: string | null;
  confirmed_at: string | null;
  settled_at: string | null;
  cancelled_at: string | null;
  settlement_reference: string;
  settlement_note: string;
  cancel_reason: string;
  created_at: string;
  updated_at: string;
};

export type PayablePayload = {
  supplier_id: number;
  cost_type_id: number;
  amount: string;
  currency?: string;
  source_type?: string;
  source_id?: number | null;
  description?: string;
  due_date?: string | null;
};

export type PayableSettlePayload = {
  settlement_reference?: string;
  settlement_note?: string;
};

export type PayableCancelPayload = {
  cancel_reason?: string;
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
