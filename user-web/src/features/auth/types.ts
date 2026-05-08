export type MemberProfile = {
  member_no: string;
  display_name: string;
  level: string;
  warehouse_code: string;
};

export type MemberUser = {
  id: number;
  email: string;
  phone: string;
  status: "ACTIVE" | "FROZEN";
  profile: MemberProfile;
};

export type LoginPayload = {
  email: string;
  password: string;
};

export type LoginResult = {
  access_token: string;
  token_type: "Bearer";
  user: MemberUser;
};
