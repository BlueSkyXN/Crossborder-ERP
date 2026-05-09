import {
  BellOutlined,
  LogoutOutlined,
  MenuFoldOutlined,
  MenuUnfoldOutlined,
  ReloadOutlined,
} from "@ant-design/icons";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  App as AntdApp,
  Avatar,
  Button,
  Drawer,
  Dropdown,
  Grid,
  Layout,
  Menu,
  Space,
  Spin,
  Typography,
} from "antd";
import type { MenuProps } from "antd";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Outlet, useLocation, useNavigate } from "react-router-dom";

import { fetchAdminMe, fetchAdminMenus } from "../../features/auth/api";
import { adminRouteMeta, fallbackMenus } from "../../features/auth/menu";
import { useAuthStore } from "../../features/auth/store";

const { Header, Sider, Content } = Layout;
const { useBreakpoint } = Grid;

export function AdminLayout() {
  const navigate = useNavigate();
  const location = useLocation();
  const queryClient = useQueryClient();
  const { message } = AntdApp.useApp();
  const screens = useBreakpoint();
  const isMobile = !screens.md;
  const [collapsed, setCollapsed] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const adminUser = useAuthStore((state) => state.adminUser);
  const setAdminUser = useAuthStore((state) => state.setAdminUser);
  const logout = useAuthStore((state) => state.logout);

  const meQuery = useQuery({
    queryKey: ["admin", "me"],
    queryFn: fetchAdminMe,
  });
  const menusQuery = useQuery({
    queryKey: ["admin", "menus"],
    queryFn: fetchAdminMenus,
  });

  const menus = menusQuery.data?.items?.length ? menusQuery.data.items : fallbackMenus;
  const allowedCodes = useMemo(() => new Set(menus.map((item) => item.code)), [menus]);
  const permissionCodes = useMemo(
    () => new Set(meQuery.data?.permission_codes || menus.map((item) => item.code)),
    [meQuery.data?.permission_codes, menus],
  );
  const menuItems: MenuProps["items"] = adminRouteMeta
    .filter((route) => allowedCodes.has(route.permission))
    .map((route) => ({
      key: route.path,
      icon: route.icon,
      label: route.label,
    }));

  const selectedKey =
    adminRouteMeta.find((route) => location.pathname === route.path)?.path || "/dashboard";
  const handleMenuClick: MenuProps["onClick"] = ({ key }) => {
    navigate(String(key));
    setMobileMenuOpen(false);
  };

  const handleLogout = useCallback(() => {
    logout();
    queryClient.clear();
    navigate("/login", { replace: true });
  }, [logout, navigate, queryClient]);

  useEffect(() => {
    if (meQuery.data && meQuery.data.id !== adminUser?.id) {
      setAdminUser(meQuery.data);
    }
  }, [adminUser?.id, meQuery.data, setAdminUser]);

  useEffect(() => {
    if (meQuery.isError) {
      message.error("登录状态已失效，请重新登录");
      handleLogout();
    }
  }, [handleLogout, meQuery.isError, message]);

  if (meQuery.isLoading || menusQuery.isLoading) {
    return (
      <div className="app-loading">
        <Spin size="large" />
      </div>
    );
  }

  if (meQuery.isError) {
    return null;
  }

  return (
    <Layout className="admin-shell">
      {!isMobile && (
        <Sider className="admin-sider" collapsed={collapsed} width={248} collapsedWidth={72}>
          <div className="brand-block">
            <div className="brand-mark">CB</div>
            {!collapsed && (
              <div>
                <Typography.Text className="brand-title">CrossBorder ERP</Typography.Text>
                <Typography.Text className="brand-subtitle">Operations Console</Typography.Text>
              </div>
            )}
          </div>
          <Menu
            theme="dark"
            mode="inline"
            selectedKeys={[selectedKey]}
            items={menuItems}
            onClick={handleMenuClick}
          />
        </Sider>
      )}
      <Drawer
        title={
          <div className="drawer-brand">
            <div className="brand-mark">CB</div>
            <div>
              <Typography.Text className="brand-title">CrossBorder ERP</Typography.Text>
              <Typography.Text className="brand-subtitle">Operations Console</Typography.Text>
            </div>
          </div>
        }
        placement="left"
        size="default"
        open={mobileMenuOpen}
        onClose={() => setMobileMenuOpen(false)}
        styles={{ body: { padding: 0, background: "#111827" }, header: { background: "#111827" } }}
      >
        <Menu
          theme="dark"
          mode="inline"
          selectedKeys={[selectedKey]}
          items={menuItems}
          onClick={handleMenuClick}
        />
      </Drawer>
      <Layout>
        <Header className="admin-header">
          <Space size={12}>
            <Button
              aria-label={isMobile ? "打开菜单" : collapsed ? "展开菜单" : "收起菜单"}
              icon={isMobile ? <MenuUnfoldOutlined /> : collapsed ? <MenuUnfoldOutlined /> : <MenuFoldOutlined />}
              onClick={() => {
                if (isMobile) {
                  setMobileMenuOpen(true);
                } else {
                  setCollapsed((value) => !value);
                }
              }}
            />
            <div>
              <Typography.Text className="header-title">后台管理</Typography.Text>
              <Typography.Text className="header-subtitle">Operations Console</Typography.Text>
            </div>
          </Space>
          <Space size={8}>
            <Button
              aria-label="刷新数据"
              icon={<ReloadOutlined />}
              onClick={() => queryClient.invalidateQueries()}
            />
            <Button aria-label="通知" icon={<BellOutlined />} />
            <Dropdown
              menu={{
                items: [{ key: "logout", label: "退出登录", icon: <LogoutOutlined /> }],
                onClick: ({ key }) => {
                  if (key === "logout") {
                    handleLogout();
                  }
                },
              }}
            >
              <Button className="account-button">
                <Avatar size={24}>{(adminUser?.name || "A").slice(0, 1)}</Avatar>
                <span className="account-name">{adminUser?.name || adminUser?.email || "管理员"}</span>
              </Button>
            </Dropdown>
          </Space>
        </Header>
        <Content className="admin-content">
          <Outlet context={{ allowedCodes, permissionCodes }} />
        </Content>
      </Layout>
    </Layout>
  );
}
