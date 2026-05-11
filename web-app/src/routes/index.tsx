import { lazy, Suspense } from "react";
import type { ReactNode } from "react";
import { createBrowserRouter } from "react-router-dom";
import { Spin } from "antd";
import { PublicShell } from "../shells/PublicShell";
import { MemberShell } from "../shells/MemberShell";
import { AdminShell } from "../shells/AdminShell";

/* ---------- lazy imports ---------- */
const HomePage = lazy(() => import("../pages/HomePage").then(m => ({ default: m.HomePage })));
const LoginPage = lazy(() => import("../pages/LoginPage").then(m => ({ default: m.LoginPage })));
const RegisterPage = lazy(() => import("../pages/RegisterPage").then(m => ({ default: m.RegisterPage })));
const ForgotPasswordPage = lazy(() => import("../pages/ForgotPasswordPage").then(m => ({ default: m.ForgotPasswordPage })));
const PlaceholderPage = lazy(() => import("../pages/PlaceholderPage").then(m => ({ default: m.PlaceholderPage })));
const WarehouseAddressPage = lazy(() => import("../pages/WarehouseAddressPage").then(m => ({ default: m.WarehouseAddressPage })));
const ParcelForecastPage = lazy(() => import("../pages/ParcelForecastPage").then(m => ({ default: m.ParcelForecastPage })));
const ParcelsPage = lazy(() => import("../pages/ParcelsPage").then(m => ({ default: m.ParcelsPage })));
const ParcelDetailPage = lazy(() => import("../pages/ParcelDetailPage").then(m => ({ default: m.ParcelDetailPage })));
const WaybillsPage = lazy(() => import("../pages/WaybillsPage").then(m => ({ default: m.WaybillsPage })));
const WaybillCreatePage = lazy(() => import("../pages/WaybillCreatePage").then(m => ({ default: m.WaybillCreatePage })));
const WaybillDetailPage = lazy(() => import("../pages/WaybillDetailPage").then(m => ({ default: m.WaybillDetailPage })));
const PurchaseManualPage = lazy(() => import("../pages/PurchaseManualPage").then(m => ({ default: m.PurchaseManualPage })));
const PurchasesPage = lazy(() => import("../pages/PurchasesPage").then(m => ({ default: m.PurchasesPage })));
const PurchaseDetailPage = lazy(() => import("../pages/PurchaseDetailPage").then(m => ({ default: m.PurchaseDetailPage })));
const WalletPage = lazy(() => import("../pages/WalletPage").then(m => ({ default: m.WalletPage })));
const RemittanceNewPage = lazy(() => import("../pages/RemittanceNewPage").then(m => ({ default: m.RemittanceNewPage })));
const AccountPage = lazy(() => import("../pages/AccountPage").then(m => ({ default: m.AccountPage })));
const AccountAddressesPage = lazy(() => import("../pages/AccountAddressesPage").then(m => ({ default: m.AccountAddressesPage })));
const TicketsPage = lazy(() => import("../pages/TicketsPage").then(m => ({ default: m.TicketsPage })));

const AdminLoginPage = lazy(() => import("../pages/admin/AdminLoginPage").then(m => ({ default: m.AdminLoginPage })));
const AdminDashboardPage = lazy(() => import("../pages/admin/AdminDashboardPage").then(m => ({ default: m.AdminDashboardPage })));
const AdminInboundPage = lazy(() => import("../pages/admin/AdminInboundPage").then(m => ({ default: m.AdminInboundPage })));
const AdminParcelsPage = lazy(() => import("../pages/admin/AdminParcelsPage").then(m => ({ default: m.AdminParcelsPage })));
const AdminUnclaimedPage = lazy(() => import("../pages/admin/AdminUnclaimedPage").then(m => ({ default: m.AdminUnclaimedPage })));
const AdminWaybillsPage = lazy(() => import("../pages/admin/AdminWaybillsPage").then(m => ({ default: m.AdminWaybillsPage })));
const AdminShippingBatchesPage = lazy(() => import("../pages/admin/AdminShippingBatchesPage").then(m => ({ default: m.AdminShippingBatchesPage })));
const AdminPurchasesPage = lazy(() => import("../pages/admin/AdminPurchasesPage").then(m => ({ default: m.AdminPurchasesPage })));
const AdminFinancePage = lazy(() => import("../pages/admin/AdminFinancePage").then(m => ({ default: m.AdminFinancePage })));
const AdminMembersPage = lazy(() => import("../pages/admin/AdminMembersPage").then(m => ({ default: m.AdminMembersPage })));
const AdminAuditLogsPage = lazy(() => import("../pages/admin/AdminAuditLogsPage").then(m => ({ default: m.AdminAuditLogsPage })));
const AdminRolesPage = lazy(() => import("../pages/admin/AdminRolesPage").then(m => ({ default: m.AdminRolesPage })));
const AdminAdminUsersPage = lazy(() => import("../pages/admin/AdminAdminUsersPage").then(m => ({ default: m.AdminAdminUsersPage })));

const routeFallback = (
  <div style={{ display: "flex", justifyContent: "center", paddingTop: 120 }}>
    <Spin size="large" />
  </div>
);

function sw(el: ReactNode) {
  return <Suspense fallback={routeFallback}>{el}</Suspense>;
}

export const router = createBrowserRouter([
  {
    element: <PublicShell />,
    children: [
      { path: "/", element: sw(<HomePage />) },
      { path: "/login", element: sw(<LoginPage />) },
      { path: "/register", element: sw(<RegisterPage />) },
      { path: "/forgot-password", element: sw(<ForgotPasswordPage />) },
      { path: "/help", element: sw(<PlaceholderPage title="帮助中心" />) },
      { path: "/estimate", element: sw(<PlaceholderPage title="运费估算" />) },

      // Member-authenticated routes
      {
        element: <MemberShell />,
        children: [
          { path: "/warehouse-address", element: sw(<WarehouseAddressPage />) },
          { path: "/parcels/forecast", element: sw(<ParcelForecastPage />) },
          { path: "/parcels", element: sw(<ParcelsPage />) },
          { path: "/parcels/:id", element: sw(<ParcelDetailPage />) },
          { path: "/waybills", element: sw(<WaybillsPage />) },
          { path: "/waybills/create", element: sw(<WaybillCreatePage />) },
          { path: "/waybills/:id", element: sw(<WaybillDetailPage />) },
          { path: "/purchase/manual", element: sw(<PurchaseManualPage />) },
          { path: "/purchases", element: sw(<PurchasesPage />) },
          { path: "/purchases/:id", element: sw(<PurchaseDetailPage />) },
          { path: "/wallet", element: sw(<WalletPage />) },
          { path: "/remittances/new", element: sw(<RemittanceNewPage />) },
          { path: "/tickets", element: sw(<TicketsPage />) },
          { path: "/account", element: sw(<AccountPage />) },
          { path: "/account/addresses", element: sw(<AccountAddressesPage />) },
        ],
      },
    ],
  },

  // Admin login (no shell)
  { path: "/admin/login", element: sw(<AdminLoginPage />) },

  // Admin authenticated routes
  {
    element: <AdminShell />,
    children: [
      { path: "/admin", element: sw(<AdminDashboardPage />) },
      { path: "/admin/parcels/inbound", element: sw(<AdminInboundPage />) },
      { path: "/admin/parcels", element: sw(<AdminParcelsPage />) },
      { path: "/admin/unclaimed", element: sw(<AdminUnclaimedPage />) },
      { path: "/admin/waybills", element: sw(<AdminWaybillsPage />) },
      {
        path: "/admin/shipping-batches",
        element: sw(<AdminShippingBatchesPage />),
      },
      { path: "/admin/purchases", element: sw(<AdminPurchasesPage />) },
      { path: "/admin/finance", element: sw(<AdminFinancePage />) },
      { path: "/admin/members", element: sw(<AdminMembersPage />) },
      { path: "/admin/products", element: sw(<PlaceholderPage title="商品管理" />) },
      { path: "/admin/content", element: sw(<PlaceholderPage title="内容管理" />) },
      { path: "/admin/settings", element: sw(<PlaceholderPage title="基础设置" />) },
      { path: "/admin/audit-logs", element: sw(<AdminAuditLogsPage />) },
      { path: "/admin/roles", element: sw(<AdminRolesPage />) },
      {
        path: "/admin/admin-users",
        element: sw(<AdminAdminUsersPage />),
      },
    ],
  },
]);
