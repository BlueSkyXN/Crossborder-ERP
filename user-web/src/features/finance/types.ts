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

export type RemittanceStatus = "PENDING" | "COMPLETED" | "CANCELLED";

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

export type OfflineRemittancePayload = {
  amount: string;
  currency?: string;
  proof_file_id: string;
  remark?: string;
};
