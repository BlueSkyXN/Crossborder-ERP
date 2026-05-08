import { createBrowserRouter, Navigate } from "react-router-dom";

import { AddressesPage } from "../pages/AddressesPage";
import { DashboardPage } from "../pages/DashboardPage";
import { LoginPage } from "../pages/LoginPage";
import { ParcelsPage } from "../pages/ParcelsPage";
import { PurchasesPage } from "../pages/PurchasesPage";
import { WaybillsPage } from "../pages/WaybillsPage";
import { PublicOnly, RequireAuth } from "./guards";

export const router = createBrowserRouter([
  {
    element: <PublicOnly />,
    children: [{ path: "/login", element: <LoginPage /> }],
  },
  {
    element: <RequireAuth />,
    children: [
      { index: true, element: <Navigate to="/dashboard" replace /> },
      { path: "/dashboard", element: <DashboardPage /> },
      { path: "/addresses", element: <AddressesPage /> },
      { path: "/parcels", element: <ParcelsPage /> },
      { path: "/waybills", element: <WaybillsPage /> },
      { path: "/products", element: <PurchasesPage /> },
      { path: "/cart", element: <PurchasesPage /> },
      { path: "/purchases", element: <PurchasesPage /> },
    ],
  },
  { path: "*", element: <Navigate to="/dashboard" replace /> },
]);
