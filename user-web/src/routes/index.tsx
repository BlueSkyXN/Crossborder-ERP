import { createBrowserRouter, Navigate } from "react-router-dom";

import { AddressesPage } from "../pages/AddressesPage";
import { DashboardPage } from "../pages/DashboardPage";
import { FinancePage } from "../pages/FinancePage";
import { LoginPage } from "../pages/LoginPage";
import { ParcelsPage } from "../pages/ParcelsPage";
import { PurchasesPage } from "../pages/PurchasesPage";
import { TicketsPage } from "../pages/TicketsPage";
import { UnclaimedParcelsPage } from "../pages/UnclaimedParcelsPage";
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
      { path: "/finance", element: <FinancePage /> },
      { path: "/parcels", element: <ParcelsPage /> },
      { path: "/unclaimed-parcels", element: <UnclaimedParcelsPage /> },
      { path: "/waybills", element: <WaybillsPage /> },
      { path: "/products", element: <PurchasesPage /> },
      { path: "/cart", element: <PurchasesPage /> },
      { path: "/purchases", element: <PurchasesPage /> },
      { path: "/tickets", element: <TicketsPage /> },
    ],
  },
  { path: "*", element: <Navigate to="/dashboard" replace /> },
]);
