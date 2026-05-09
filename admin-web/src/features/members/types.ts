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

export type GrowthSummary = {
  points_balance: number;
  referral_code: string;
  invited_count: number;
  active_invited_count: number;
  confirmed_reward_points: number;
  confirmed_rebate_amount: string;
  pending_rebate_amount: string;
  currency: string;
  points_rule_note: string;
  rebate_rule_note: string;
};

export type PointLedger = {
  id: number;
  user: number;
  user_email: string;
  operator_name: string | null;
  type: string;
  direction: "EARN" | "SPEND";
  points: number;
  balance_after: number;
  business_type: string;
  business_id: number | null;
  remark: string;
  created_at: string;
};

export type ReferralRelation = {
  id: number;
  inviter: number;
  inviter_email: string;
  inviter_member_no: string;
  invitee: number;
  invitee_email: string;
  invitee_member_no: string;
  invitation_code: string;
  status: "PENDING" | "ACTIVE" | "INVALID";
  created_by_admin_name: string | null;
  remark: string;
  activated_at: string | null;
  created_at: string;
  updated_at: string;
};

export type RebateRecord = {
  id: number;
  user: number;
  user_email: string;
  referral_relation: number | null;
  invitee_email: string | null;
  amount: string;
  reward_points: number;
  currency: string;
  status: "PENDING" | "CONFIRMED" | "CANCELLED";
  business_type: string;
  business_id: number | null;
  remark: string;
  created_by_admin_name: string | null;
  created_at: string;
  updated_at: string;
};

export type MemberGrowthDetail = {
  summary: GrowthSummary;
  point_ledgers: PointLedger[];
  referrals: ReferralRelation[];
  referral_source: ReferralRelation | null;
  rebates: RebateRecord[];
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

export type PointAdjustmentPayload = {
  points_delta: number;
  type?: string;
  business_type?: string;
  business_id?: number | null;
  remark?: string;
};

export type ServiceAdminUser = {
  id: number;
  email: string;
  name: string;
};
