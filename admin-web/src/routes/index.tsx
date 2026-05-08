import { createBrowserRouter, Navigate } from "react-router-dom";

import { AdminLayout } from "../components/layout/AdminLayout";
import { WorkspacePage } from "../components/layout/WorkspacePage";
import { ForbiddenPage } from "../pages/ForbiddenPage";
import { LoginPage } from "../pages/LoginPage";
import { NotFoundPage } from "../pages/NotFoundPage";
import { adminRouteMeta } from "../features/auth/menu";
import { ParcelWmsPage } from "../features/parcels/ParcelWmsPage";
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
              ) : route.resource === "parcels" ? (
                <ParcelWmsPage />
              ) : route.resource === "waybills" ? (
                <WaybillOpsPage />
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
