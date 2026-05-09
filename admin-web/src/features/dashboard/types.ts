export type DashboardTone = "blue" | "green" | "gold" | "purple" | "cyan" | "magenta" | "lime" | "orange" | "warning" | "danger" | "default";

export type DashboardCard = {
  key: string;
  label: string;
  value: number | string;
  hint: string;
  path: string;
  tone: DashboardTone;
};

export type DashboardMetric = {
  label: string;
  value: number | string;
};

export type DashboardModule = {
  key: string;
  label: string;
  path: string;
  metrics: DashboardMetric[];
};

export type DashboardQueueItem = {
  key: string;
  label: string;
  value: number;
  path: string;
  tone: DashboardTone;
};

export type DashboardAuditLog = {
  id: number;
  action: string;
  operator_label: string;
  target_type: string;
  status_code: number;
  created_at: string;
};

export type AdminDashboardSnapshot = {
  generated_at: string;
  summary_cards: DashboardCard[];
  work_queue: DashboardQueueItem[];
  modules: DashboardModule[];
  recent_audit_logs: DashboardAuditLog[];
};
