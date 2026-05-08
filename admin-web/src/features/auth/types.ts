export type AdminUser = {
  id: number;
  email: string;
  name: string;
  status: "ACTIVE" | "DISABLED";
  is_super_admin: boolean;
  roles: Array<{
    code: string;
    name: string;
  }>;
};

export type LoginPayload = {
  email: string;
  password: string;
};

export type LoginResult = {
  access_token: string;
  token_type: "Bearer";
  admin_user: AdminUser;
};

export type AdminMenuItem = {
  code: string;
  name: string;
  resource: string;
};
