import { requestData } from "../../api/client";
import type { AdminMenuItem, AdminUser, LoginPayload, LoginResult, Permission, Role, RolePayload } from "./types";

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

export function fetchAdminPermissions() {
  return requestData<{ items: Permission[] }>({
    method: "GET",
    url: "/admin/permissions",
  }).then((result) => result.items);
}

export function createAdminRole(payload: RolePayload) {
  return requestData<Role>({
    method: "POST",
    url: "/admin/roles",
    data: payload,
  });
}

export function updateAdminRole(roleId: number, payload: RolePayload) {
  return requestData<Role>({
    method: "PATCH",
    url: `/admin/roles/${roleId}`,
    data: payload,
  });
}
