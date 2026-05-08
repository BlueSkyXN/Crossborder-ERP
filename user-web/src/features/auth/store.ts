import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

import type { MemberUser } from "./types";

type AuthState = {
  token: string | null;
  user: MemberUser | null;
  setSession: (token: string, user: MemberUser) => void;
  setUser: (user: MemberUser) => void;
  logout: () => void;
};

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      token: null,
      user: null,
      setSession: (token, user) => set({ token, user }),
      setUser: (user) => set({ user }),
      logout: () => set({ token: null, user: null }),
    }),
    {
      name: "crossborder-user-auth",
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({ token: state.token, user: state.user }),
    },
  ),
);
