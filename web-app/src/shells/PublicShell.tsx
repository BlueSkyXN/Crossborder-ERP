import { Outlet, Link, useNavigate } from "react-router-dom";
import { Layout, Menu, Button, Space } from "antd";
import {
  HomeOutlined,
  ShoppingCartOutlined,
  InboxOutlined,
  FileTextOutlined,
  WalletOutlined,
  QuestionCircleOutlined,
} from "@ant-design/icons";
import { useMemberAuthStore } from "../stores/auth";

const { Header, Content, Footer } = Layout;

const publicMenuItems = [
  { key: "/", icon: <HomeOutlined />, label: <Link to="/">首页</Link> },
  { key: "/estimate", icon: <ShoppingCartOutlined />, label: <Link to="/estimate">运费估算</Link> },
  { key: "/help", icon: <QuestionCircleOutlined />, label: <Link to="/help">帮助中心</Link> },
];

const memberMenuItems = [
  { key: "/", icon: <HomeOutlined />, label: <Link to="/">首页</Link> },
  { key: "/warehouse-address", icon: <InboxOutlined />, label: <Link to="/warehouse-address">仓库地址</Link> },
  { key: "/parcels", icon: <InboxOutlined />, label: <Link to="/parcels">我的包裹</Link> },
  { key: "/waybills", icon: <FileTextOutlined />, label: <Link to="/waybills">我的运单</Link> },
  { key: "/purchases", icon: <ShoppingCartOutlined />, label: <Link to="/purchases">我的代购</Link> },
  { key: "/wallet", icon: <WalletOutlined />, label: <Link to="/wallet">财务中心</Link> },
];

export function PublicShell() {
  const navigate = useNavigate();
  const token = useMemberAuthStore((s) => s.token);

  return (
    <Layout style={{ minHeight: "100vh" }}>
      <Header
        style={{
          background: "#fff",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "0 24px",
          borderBottom: "1px solid #f0f0f0",
        }}
      >
        <Link to="/" style={{ fontSize: 18, fontWeight: 700, color: "var(--color-primary)", textDecoration: "none" }}>
          CrossBorder
        </Link>
        <Menu
          mode="horizontal"
          items={token ? memberMenuItems : publicMenuItems}
          style={{ flex: 1, marginLeft: 40, border: "none" }}
        />
        <Space>
          {token ? (
            <Button onClick={() => navigate("/account")}>我的账户</Button>
          ) : (
            <>
              <Button onClick={() => navigate("/login")}>登录</Button>
              <Button type="primary" onClick={() => navigate("/register")}>
                注册
              </Button>
            </>
          )}
        </Space>
      </Header>
      <Content style={{ maxWidth: "var(--max-width-user)", width: "100%", margin: "0 auto", padding: "24px" }}>
        <Outlet />
      </Content>
      <Footer style={{ textAlign: "center", color: "#999" }}>
        CrossBorder 跨境代购与集运平台 ©{new Date().getFullYear()}
      </Footer>
    </Layout>
  );
}
