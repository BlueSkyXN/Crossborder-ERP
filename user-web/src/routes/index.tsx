import { createBrowserRouter, Navigate } from "react-router-dom";

import { DashboardPage } from "../pages/DashboardPage";
import { LoginPage } from "../pages/LoginPage";
import { ParcelsPage } from "../pages/ParcelsPage";
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
      { path: "/parcels", element: <ParcelsPage /> },
    ],
  },
  { path: "*", element: <Navigate to="/dashboard" replace /> },
]);
