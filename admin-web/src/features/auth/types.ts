export type AdminUser = {
  id: number;
  email: string;
  name: string;
  status: "ACTIVE" | "DISABLED";
  is_super_admin: boolean;
  roles: string[];
  permission_codes: string[];
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

export type Permission = {
  id: number;
  code: string;
  name: string;
  type: "MENU" | "API" | "BUTTON";
  resource: string;
};

export type Role = {
  id: number;
  code: string;
  name: string;
  description: string;
  permissions: Permission[];
  permission_codes: string[];
};

export type RolePayload = {
  code?: string;
  name: string;
  description?: string;
  permission_codes: string[];
};
