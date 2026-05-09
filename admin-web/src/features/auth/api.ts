import { requestData } from "../../api/client";
import type { AdminMenuItem, AdminUser, LoginPayload, LoginResult, Role } from "./types";

export function loginAdmin(payload: LoginPayload) {
  return requestData<LoginResult>({
    method: "POST",
    url: "/admin/auth/login",
    data: payload,
  });
}

export function fetchAdminMe() {
  return requestData<AdminUser>({
    method: "GET",
    url: "/admin/me",
  });
}

export function fetchAdminMenus() {
  return requestData<{ items: AdminMenuItem[] }>({
    method: "GET",
    url: "/admin/menus",
  });
}

export function fetchAdminRoles() {
  return requestData<{ items: Role[] }>({
    method: "GET",
    url: "/admin/roles",
  }).then((result) => result.items);
}
