import { lazy, Suspense, type ReactElement } from "react";
import { createBrowserRouter, Navigate } from "react-router-dom";

import { AdminLayout } from "../components/layout/AdminLayout";
import { WorkspacePage } from "../components/layout/WorkspacePage";
import { ForbiddenPage } from "../pages/ForbiddenPage";
import { LoginPage } from "../pages/LoginPage";
import { NotFoundPage } from "../pages/NotFoundPage";
import { adminRouteMeta, type AdminRouteMeta } from "../features/auth/menu";
import { PublicOnly, RequireAuth } from "./guards";

const AdminDashboardPage = lazy(() =>
  import("../features/dashboard/AdminDashboardPage").then((module) => ({ default: module.AdminDashboardPage })),
);
const WarehouseConfigPage = lazy(() =>
  import("../features/warehouses/WarehouseConfigPage").then((module) => ({ default: module.WarehouseConfigPage })),
);
const MemberOpsPage = lazy(() =>
  import("../features/members/MemberOpsPage").then((module) => ({ default: module.MemberOpsPage })),
);
const ParcelWmsPage = lazy(() =>
  import("../features/parcels/ParcelWmsPage").then((module) => ({ default: module.ParcelWmsPage })),
);
const WaybillOpsPage = lazy(() =>
  import("../features/waybills/WaybillOpsPage").then((module) => ({ default: module.WaybillOpsPage })),
);
const FinancePage = lazy(() =>
  import("../features/finance/FinancePage").then((module) => ({ default: module.FinancePage })),
);
const PurchaseOpsPage = lazy(() =>
  import("../features/purchases/PurchaseOpsPage").then((module) => ({ default: module.PurchaseOpsPage })),
);
const ProductCatalogPage = lazy(() =>
  import("../features/products/ProductCatalogPage").then((module) => ({ default: module.ProductCatalogPage })),
);
const RegionManagePage = lazy(() =>
  import("../features/regions/RegionManagePage").then((module) => ({ default: module.RegionManagePage })),
);
const TicketOpsPage = lazy(() =>
  import("../features/tickets/TicketOpsPage").then((module) => ({ default: module.TicketOpsPage })),
);
const ContentCmsPage = lazy(() =>
  import("../features/content/ContentCmsPage").then((module) => ({ default: module.ContentCmsPage })),
);
const AuditLogPage = lazy(() =>
  import("../features/audit/AuditLogPage").then((module) => ({ default: module.AuditLogPage })),
);
const RolePermissionPage = lazy(() =>
  import("../features/auth/RolePermissionPage").then((module) => ({ default: module.RolePermissionPage })),
);
const AdminUserManagementPage = lazy(() =>
  import("../features/auth/AdminUserManagementPage").then((module) => ({ default: module.AdminUserManagementPage })),
);

function lazyPage(element: ReactElement) {
  return <Suspense fallback={<div className="app-loading" aria-label="加载中" />}>{element}</Suspense>;
}

function renderAdminRoutePage(route: AdminRouteMeta) {
  switch (route.resource) {
    case "dashboard":
      return lazyPage(<AdminDashboardPage />);
    case "warehouses":
      return lazyPage(<WarehouseConfigPage />);
    case "members":
      return lazyPage(<MemberOpsPage />);
    case "parcels":
      return lazyPage(<ParcelWmsPage />);
    case "waybills":
      return lazyPage(<WaybillOpsPage />);
    case "finance":
      return lazyPage(<FinancePage />);
    case "purchases":
      return lazyPage(<PurchaseOpsPage />);
    case "products":
      return lazyPage(<ProductCatalogPage />);
    case "regions":
      return lazyPage(<RegionManagePage />);
    case "tickets":
      return lazyPage(<TicketOpsPage />);
    case "content":
      return lazyPage(<ContentCmsPage />);
    case "audit":
      return lazyPage(<AuditLogPage />);
    case "roles":
      return lazyPage(<RolePermissionPage />);
    case "admin-users":
      return lazyPage(<AdminUserManagementPage />);
    default:
      return <WorkspacePage route={route} />;
  }
}

export const router = createBrowserRouter([
  {
    element: <PublicOnly />,
    children: [{ path: "/login", element: <LoginPage /> }],
  },
  {
    element: <RequireAuth />,
    children: [
      {
        element: <AdminLayout />,
        children: [
          { index: true, element: <Navigate to="/dashboard" replace /> },
          ...adminRouteMeta.map((route) => ({
            path: route.path.slice(1),
            element: renderAdminRoutePage(route),
          })),
          { path: "403", element: <ForbiddenPage /> },
          { path: "*", element: <NotFoundPage /> },
        ],
      },
    ],
  },
  { path: "*", element: <NotFoundPage /> },
]);
