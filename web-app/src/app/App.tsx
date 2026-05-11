import { RouterProvider } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ConfigProvider, App as AntApp } from "antd";
import zhCN from "antd/locale/zh_CN";
import { router } from "../routes";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { retry: 1, refetchOnWindowFocus: false },
  },
});

const antTheme = {
  token: {
    colorPrimary: "#1677ff",
    borderRadius: 8,
  },
};

ConfigProvider.config({
  theme: antTheme,
  holderRender: (children) => (
    <ConfigProvider locale={zhCN} theme={antTheme}>
      {children}
    </ConfigProvider>
  ),
});

export function App() {
  return (
    <ConfigProvider
      locale={zhCN}
      theme={antTheme}
    >
      <QueryClientProvider client={queryClient}>
        <AntApp>
          <RouterProvider router={router} />
        </AntApp>
      </QueryClientProvider>
    </ConfigProvider>
  );
}
