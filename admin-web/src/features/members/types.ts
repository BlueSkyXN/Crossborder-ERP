export type MemberStatus = "ACTIVE" | "FROZEN";

export type MemberProfile = {
  member_no: string;
  display_name: string;
  level: string;
  warehouse_code: string;
  assigned_admin_id: number | null;
  assigned_admin_name: string | null;
  service_note: string;
};

export type MemberServiceSummary = {
  ticket_count: number;
  open_ticket_count: number;
  last_ticket_at: string | null;
};

export type MemberUser = {
  id: number;
  email: string;
  phone: string;
  status: MemberStatus;
  last_login_at: string | null;
  created_at: string;
  updated_at: string;
  profile: MemberProfile;
  service_summary: MemberServiceSummary;
};

export type MemberQuery = {
  keyword?: string;
  status?: MemberStatus;
  level?: string;
  assigned_admin_id?: number;
};

export type MemberUpdatePayload = {
  display_name?: string;
  phone?: string;
  level?: string;
  assigned_admin_id?: number | null;
  service_note?: string;
};

export type ResetPasswordPayload = {
  password?: string;
};

export type ServiceAdminUser = {
  id: number;
  email: string;
  name: string;
};
