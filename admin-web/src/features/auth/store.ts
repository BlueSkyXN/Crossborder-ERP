import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

import type { AdminUser } from "./types";

type AuthState = {
  token: string | null;
  adminUser: AdminUser | null;
  setSession: (token: string, adminUser: AdminUser) => void;
  setAdminUser: (adminUser: AdminUser) => void;
  logout: () => void;
};

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      token: null,
      adminUser: null,
      setSession: (token, adminUser) => set({ token, adminUser }),
      setAdminUser: (adminUser) => set({ adminUser }),
      logout: () => set({ token: null, adminUser: null }),
    }),
    {
      name: "crossborder-admin-auth",
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({ token: state.token, adminUser: state.adminUser }),
    },
  ),
);
