export type { Wallet, WalletTransaction } from "../waybills/types";

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

export type OfflineRemittanceCreatePayload = {
  amount: string;
  currency?: string;
  proof_file_id: string;
  remark?: string;
};
