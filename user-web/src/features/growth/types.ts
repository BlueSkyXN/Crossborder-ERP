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
  direction: "INCREASE" | "DECREASE";
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
