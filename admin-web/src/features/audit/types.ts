export type AuditOperatorType = "ADMIN" | "SYSTEM" | "UNKNOWN";

export type AuditLog = {
  id: number;
  operator_type: AuditOperatorType;
  operator_id: number | null;
  operator_label: string;
  action: string;
  target_type: string;
  target_id: string;
  request_method: string;
  request_path: string;
  status_code: number;
  ip_address: string;
  user_agent: string;
  request_data: Record<string, unknown>;
  response_data: Record<string, unknown>;
  created_at: string;
};

export type AuditLogListResult = {
  items: AuditLog[];
  pagination?: {
    page: number;
    page_size: number;
    total: number;
  };
};

export type AuditLogQuery = {
  keyword?: string;
  method?: string;
  target_type?: string;
  action?: string;
  page?: number;
  page_size?: number;
};

