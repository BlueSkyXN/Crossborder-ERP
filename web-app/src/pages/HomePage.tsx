import { Button, Card, Col, Row, Space, Typography } from "antd";
import {
  InboxOutlined,
  ShoppingCartOutlined,
  EnvironmentOutlined,
  CalculatorOutlined,
  WalletOutlined,
} from "@ant-design/icons";
import { useNavigate } from "react-router-dom";
import { useMemberAuthStore } from "../stores/auth";

const { Title, Paragraph } = Typography;

const steps = [
  { title: "获取仓库地址", desc: "复制您的专属仓库地址" },
  { title: "国内下单寄仓库", desc: "在电商平台下单寄到仓库" },
  { title: "包裹入库", desc: "包裹到仓后系统自动通知" },
  { title: "合箱付款", desc: "选择包裹申请打包并支付运费" },
  { title: "国际发货", desc: "仓库打包发出，查看物流轨迹" },
];

const quickEntries = [
  {
    title: "仓库地址",
    icon: <EnvironmentOutlined style={{ fontSize: 28 }} />,
    path: "/warehouse-address",
    auth: true,
  },
  {
    title: "包裹预报",
    icon: <InboxOutlined style={{ fontSize: 28 }} />,
    path: "/parcels/forecast",
    auth: true,
  },
  {
    title: "我的包裹",
    icon: <InboxOutlined style={{ fontSize: 28 }} />,
    path: "/parcels",
    auth: true,
  },
  {
    title: "运费估算",
    icon: <CalculatorOutlined style={{ fontSize: 28 }} />,
    path: "/estimate",
    auth: false,
  },
  {
    title: "财务充值",
    icon: <WalletOutlined style={{ fontSize: 28 }} />,
    path: "/wallet",
    auth: true,
  },
  {
    title: "万能代购",
    icon: <ShoppingCartOutlined style={{ fontSize: 28 }} />,
    path: "/purchase/manual",
    auth: true,
  },
];

export function HomePage() {
  const navigate = useNavigate();
  const token = useMemberAuthStore((s) => s.token);

  const handleNav = (path: string, auth: boolean) => {
    if (auth && !token) {
      navigate(`/login?redirect=${encodeURIComponent(path)}`);
    } else {
      navigate(path);
    }
  };

  return (
    <div>
      {/* Hero */}
      <Card
        style={{
          textAlign: "center",
          borderRadius: "var(--radius-card)",
          background: "linear-gradient(135deg, #1677ff 0%, #4096ff 100%)",
          color: "#fff",
          marginBottom: 24,
        }}
        styles={{ body: { padding: "48px 24px" } }}
      >
        <Title level={2} style={{ color: "#fff", marginBottom: 8 }}>
          跨境代购与集运，一站式处理
        </Title>
        <Paragraph
          style={{ color: "rgba(255,255,255,0.85)", fontSize: 16, marginBottom: 24 }}
        >
          简单、快速、透明的跨境物流服务
        </Paragraph>
        <Space size="middle">
          <Button
            type="primary"
            size="large"
            ghost
            onClick={() => handleNav("/parcels/forecast", true)}
          >
            立即预报包裹
          </Button>
          <Button
            size="large"
            style={{ background: "rgba(255,255,255,0.15)", color: "#fff", border: "none" }}
            onClick={() => handleNav("/purchase/manual", true)}
          >
            提交代购需求
          </Button>
        </Space>
      </Card>

      {/* 流程说明 */}
      <Card style={{ borderRadius: "var(--radius-card)", marginBottom: 24 }} title="操作流程">
        <Row gutter={[16, 16]} justify="center">
          {steps.map((step, i) => (
            <Col key={i} xs={12} sm={8} md={4} style={{ textAlign: "center" }}>
              <div
                style={{
                  width: 40,
                  height: 40,
                  borderRadius: "50%",
                  background: "var(--color-primary)",
                  color: "#fff",
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontWeight: 700,
                  marginBottom: 8,
                }}
              >
                {i + 1}
              </div>
              <div style={{ fontWeight: 600, marginBottom: 4 }}>{step.title}</div>
              <div style={{ fontSize: 12, color: "#999" }}>{step.desc}</div>
            </Col>
          ))}
        </Row>
      </Card>

      {/* 常用入口 */}
      <Row gutter={[16, 16]}>
        {quickEntries.map((entry) => (
          <Col key={entry.path} xs={12} sm={8} md={4}>
            <Card
              hoverable
              style={{ textAlign: "center", borderRadius: "var(--radius-card)" }}
              onClick={() => handleNav(entry.path, entry.auth)}
            >
              <div style={{ color: "var(--color-primary)", marginBottom: 8 }}>{entry.icon}</div>
              <div style={{ fontWeight: 500 }}>{entry.title}</div>
            </Card>
          </Col>
        ))}
      </Row>
    </div>
  );
}
