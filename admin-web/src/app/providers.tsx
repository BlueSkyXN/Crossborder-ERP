import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { App as AntdApp, ConfigProvider } from "antd";
import zhCN from "antd/locale/zh_CN";
import type { PropsWithChildren } from "react";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: false,
      staleTime: 30_000,
    },
  },
});

export function AppProviders({ children }: PropsWithChildren) {
  return (
    <ConfigProvider
      locale={zhCN}
      theme={{
        token: {
          colorPrimary: "#2563eb",
          colorSuccess: "#10b981",
          colorWarning: "#f59e0b",
          colorError: "#ef4444",
          colorBgLayout: "#f6f8fb",
          colorText: "#111827",
          colorTextSecondary: "#6b7280",
          borderRadius: 6,
          fontFamily:
            "ui-sans-serif, -apple-system, BlinkMacSystemFont, \"Segoe UI\", sans-serif",
        },
        components: {
          Button: {
            borderRadius: 6,
            controlHeight: 36,
          },
          Card: {
            borderRadiusLG: 8,
          },
          Layout: {
            siderBg: "#111827",
            triggerBg: "#111827",
          },
          Menu: {
            darkItemBg: "#111827",
            darkSubMenuItemBg: "#111827",
            darkItemSelectedBg: "#2563eb",
          },
        },
      }}
    >
      <AntdApp>
        <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
      </AntdApp>
    </ConfigProvider>
  );
}
