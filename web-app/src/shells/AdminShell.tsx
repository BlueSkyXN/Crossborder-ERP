import { Outlet, Link, useNavigate, Navigate, useLocation } from "react-router-dom";
import { Layout, Menu, Button, theme } from "antd";
import {
  DashboardOutlined,
  InboxOutlined,
  FileTextOutlined,
  ShoppingCartOutlined,
  DollarOutlined,
  TeamOutlined,
  ShopOutlined,
  ReadOutlined,
  SettingOutlined,
  AuditOutlined,
  SafetyOutlined,
  UserOutlined,
  SendOutlined,
} from "@ant-design/icons";
import { useAdminAuthStore } from "../stores/auth";

const { Header, Sider, Content } = Layout;

const adminMenuItems = [
  { key: "/admin", icon: <DashboardOutlined />, label: <Link to="/admin">控制台</Link> },
  { key: "/admin/parcels/inbound", icon: <InboxOutlined />, label: <Link to="/admin/parcels/inbound">包裹入库</Link> },
  { key: "/admin/parcels", icon: <InboxOutlined />, label: <Link to="/admin/parcels">包裹管理</Link> },
  { key: "/admin/unclaimed", icon: <InboxOutlined />, label: <Link to="/admin/unclaimed">无主包裹</Link> },
  { key: "/admin/waybills", icon: <FileTextOutlined />, label: <Link to="/admin/waybills">运单处理</Link> },
  { key: "/admin/shipping-batches", icon: <SendOutlined />, label: <Link to="/admin/shipping-batches">发货批次</Link> },
  { key: "/admin/purchases", icon: <ShoppingCartOutlined />, label: <Link to="/admin/purchases">代购订单</Link> },
  { key: "/admin/finance", icon: <DollarOutlined />, label: <Link to="/admin/finance">财务中心</Link> },
  { key: "/admin/members", icon: <TeamOutlined />, label: <Link to="/admin/members">会员管理</Link> },
  { key: "/admin/products", icon: <ShopOutlined />, label: <Link to="/admin/products">商品管理</Link> },
  { key: "/admin/content", icon: <ReadOutlined />, label: <Link to="/admin/content">内容管理</Link> },
  { key: "/admin/settings", icon: <SettingOutlined />, label: <Link to="/admin/settings">基础设置</Link> },
  { key: "/admin/audit-logs", icon: <AuditOutlined />, label: <Link to="/admin/audit-logs">审计日志</Link> },
  { key: "/admin/roles", icon: <SafetyOutlined />, label: <Link to="/admin/roles">角色权限</Link> },
  { key: "/admin/admin-users", icon: <UserOutlined />, label: <Link to="/admin/admin-users">管理员账号</Link> },
];

export function AdminShell() {
  const token = useAdminAuthStore((s) => s.token);
  const admin = useAdminAuthStore((s) => s.admin);
  const logout = useAdminAuthStore((s) => s.logout);
  const navigate = useNavigate();
  const location = useLocation();
  const { token: antToken } = theme.useToken();

  if (!token) {
    return <Navigate to="/admin/login" replace />;
  }

  return (
    <Layout style={{ minHeight: "100vh" }}>
      <Sider width={220} theme="light" style={{ borderRight: `1px solid ${antToken.colorBorderSecondary}` }}>
        <div
          style={{
            height: 64,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontWeight: 700,
            fontSize: 16,
            color: antToken.colorPrimary,
          }}
        >
          CrossBorder 后台
        </div>
        <Menu
          mode="inline"
          selectedKeys={[location.pathname]}
          items={adminMenuItems}
          style={{ borderRight: "none" }}
        />
      </Sider>
      <Layout>
        <Header
          style={{
            background: "#fff",
            display: "flex",
            alignItems: "center",
            justifyContent: "flex-end",
            padding: "0 24px",
            borderBottom: `1px solid ${antToken.colorBorderSecondary}`,
          }}
        >
          <span style={{ marginRight: 16 }}>{admin?.username || admin?.email}</span>
          <Button
            size="small"
            onClick={() => {
              logout();
              navigate("/admin/login");
            }}
          >
            退出
          </Button>
        </Header>
        <Content style={{ padding: 24, background: antToken.colorBgLayout }}>
          <Outlet />
        </Content>
      </Layout>
    </Layout>
  );
}
