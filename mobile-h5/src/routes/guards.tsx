import { Navigate, Outlet, useLocation, useSearchParams } from "react-router-dom";

import { useAuthStore } from "../features/auth/store";
import { safeRedirect } from "./redirect";

export function RequireAuth() {
  const token = useAuthStore((state) => state.token);
  const location = useLocation();

  if (!token) {
    const redirect = encodeURIComponent(`${location.pathname}${location.search}`);
    return <Navigate to={`/login?redirect=${redirect}`} replace />;
  }

  return <Outlet />;
}

export function PublicOnly() {
  const token = useAuthStore((state) => state.token);
  const [searchParams] = useSearchParams();

  if (token) {
    return <Navigate to={safeRedirect(searchParams.get("redirect"))} replace />;
  }

  return <Outlet />;
}
