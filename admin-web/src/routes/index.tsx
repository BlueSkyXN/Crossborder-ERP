import { createBrowserRouter, Navigate } from "react-router-dom";

import { AdminLayout } from "../components/layout/AdminLayout";
import { WorkspacePage } from "../components/layout/WorkspacePage";
import { ForbiddenPage } from "../pages/ForbiddenPage";
import { LoginPage } from "../pages/LoginPage";
import { NotFoundPage } from "../pages/NotFoundPage";
import { AuditLogPage } from "../features/audit/AuditLogPage";
import { adminRouteMeta } from "../features/auth/menu";
import { ContentCmsPage } from "../features/content/ContentCmsPage";
import { FinancePage } from "../features/finance/FinancePage";
import { MemberOpsPage } from "../features/members/MemberOpsPage";
import { ParcelWmsPage } from "../features/parcels/ParcelWmsPage";
import { ProductCatalogPage } from "../features/products/ProductCatalogPage";
import { PurchaseOpsPage } from "../features/purchases/PurchaseOpsPage";
import { TicketOpsPage } from "../features/tickets/TicketOpsPage";
import { WaybillOpsPage } from "../features/waybills/WaybillOpsPage";
import { WarehouseConfigPage } from "../features/warehouses/WarehouseConfigPage";
import { PublicOnly, RequireAuth } from "./guards";

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
            element:
              route.resource === "warehouses" ? (
                <WarehouseConfigPage />
              ) : route.resource === "members" ? (
                <MemberOpsPage />
              ) : route.resource === "parcels" ? (
                <ParcelWmsPage />
              ) : route.resource === "waybills" ? (
                <WaybillOpsPage />
              ) : route.resource === "finance" ? (
                <FinancePage />
              ) : route.resource === "purchases" ? (
                <PurchaseOpsPage />
              ) : route.resource === "products" ? (
                <ProductCatalogPage />
              ) : route.resource === "tickets" ? (
                <TicketOpsPage />
              ) : route.resource === "content" ? (
                <ContentCmsPage />
              ) : route.resource === "audit" ? (
                <AuditLogPage />
              ) : (
                <WorkspacePage route={route} />
              ),
          })),
          { path: "403", element: <ForbiddenPage /> },
          { path: "*", element: <NotFoundPage /> },
        ],
      },
    ],
  },
  { path: "*", element: <NotFoundPage /> },
]);
