import { Outlet, useNavigate, Navigate } from "react-router-dom";
import { useMemberAuthStore } from "../stores/auth";

export function MemberShell() {
  const token = useMemberAuthStore((s) => s.token);
  const navigate = useNavigate();

  if (!token) {
    const redirect = window.location.pathname + window.location.search;
    return <Navigate to={`/login?redirect=${encodeURIComponent(redirect)}`} replace />;
  }

  void navigate;
  return <Outlet />;
}
