import { create } from "zustand";
import type { Member } from "@crossborder-erp/api-client";

interface MemberAuthState {
  token: string | null;
  member: Member | null;
  setAuth: (token: string, member: Member) => void;
  logout: () => void;
}

export const useMemberAuthStore = create<MemberAuthState>((set) => ({
  token: localStorage.getItem("member_token"),
  member: (() => {
    try {
      const s = localStorage.getItem("member_info");
      return s ? JSON.parse(s) : null;
    } catch {
      return null;
    }
  })(),
  setAuth: (token, member) => {
    localStorage.setItem("member_token", token);
    localStorage.setItem("member_info", JSON.stringify(member));
    set({ token, member });
  },
  logout: () => {
    localStorage.removeItem("member_token");
    localStorage.removeItem("member_info");
    set({ token: null, member: null });
  },
}));

interface AdminAuthState {
  token: string | null;
  admin: { id: number; email: string; username: string } | null;
  setAuth: (token: string, admin: AdminAuthState["admin"]) => void;
  logout: () => void;
}

export const useAdminAuthStore = create<AdminAuthState>((set) => ({
  token: localStorage.getItem("admin_token"),
  admin: (() => {
    try {
      const s = localStorage.getItem("admin_info");
      return s ? JSON.parse(s) : null;
    } catch {
      return null;
    }
  })(),
  setAuth: (token, admin) => {
    localStorage.setItem("admin_token", token);
    localStorage.setItem("admin_info", JSON.stringify(admin));
    set({ token, admin });
  },
  logout: () => {
    localStorage.removeItem("admin_token");
    localStorage.removeItem("admin_info");
    set({ token: null, admin: null });
  },
}));
