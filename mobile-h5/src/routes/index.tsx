import { createBrowserRouter, Navigate } from "react-router-dom";

import { MobileShell } from "../components/MobileShell";
import { LoginPage } from "../pages/LoginPage";
import { ParcelForecastPage } from "../pages/ParcelForecastPage";
import { ParcelListPage } from "../pages/ParcelListPage";
import { PlaceholderPage } from "../pages/PlaceholderPage";
import { ShipHomePage } from "../pages/ShipHomePage";
import { WaybillListPage } from "../pages/WaybillListPage";
import { WaybillPackingPage } from "../pages/WaybillPackingPage";
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
        element: <MobileShell />,
        children: [
          { index: true, element: <Navigate to="/ship" replace /> },
          { path: "/home", element: <PlaceholderPage title="首页" /> },
          { path: "/category", element: <PlaceholderPage title="分类" /> },
          { path: "/ship", element: <ShipHomePage /> },
          { path: "/ship/forecast", element: <ParcelForecastPage /> },
          { path: "/ship/parcels", element: <ParcelListPage /> },
          { path: "/ship/packing", element: <WaybillPackingPage /> },
          { path: "/ship/waybills", element: <WaybillListPage /> },
          { path: "/cart", element: <PlaceholderPage title="购物车" /> },
          { path: "/me", element: <PlaceholderPage title="我的" /> },
        ],
      },
    ],
  },
  { path: "*", element: <Navigate to="/ship" replace /> },
]);
