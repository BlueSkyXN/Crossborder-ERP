import { createBrowserRouter, Navigate } from "react-router-dom";

import { MobileShell } from "../components/MobileShell";
import { CartPage } from "../pages/CartPage";
import { LoginPage } from "../pages/LoginPage";
import { ManualPurchasePage } from "../pages/ManualPurchasePage";
import { MePage } from "../pages/MePage";
import { ParcelForecastPage } from "../pages/ParcelForecastPage";
import { ParcelListPage } from "../pages/ParcelListPage";
import { ProductHomePage } from "../pages/ProductHomePage";
import { PurchaseOrdersPage } from "../pages/PurchaseOrdersPage";
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
          { path: "/home", element: <ProductHomePage /> },
          { path: "/category", element: <ProductHomePage mode="category" /> },
          { path: "/ship", element: <ShipHomePage /> },
          { path: "/ship/forecast", element: <ParcelForecastPage /> },
          { path: "/ship/parcels", element: <ParcelListPage /> },
          { path: "/ship/packing", element: <WaybillPackingPage /> },
          { path: "/ship/waybills", element: <WaybillListPage /> },
          { path: "/cart", element: <CartPage /> },
          { path: "/me", element: <MePage /> },
          { path: "/me/purchases", element: <PurchaseOrdersPage /> },
          { path: "/me/purchases/manual", element: <ManualPurchasePage /> },
        ],
      },
    ],
  },
  { path: "*", element: <Navigate to="/ship" replace /> },
]);
