import { useState } from "react";
import { Button, Card, Form, Input, Typography, message } from "antd";
import { LockOutlined, MailOutlined } from "@ant-design/icons";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { memberAuth } from "@crossborder-erp/api-client";
import { useMemberAuthStore } from "../stores/auth";
import { memberClient } from "../api/client";

const { Title, Paragraph } = Typography;

type LoginForm = {
  email: string;
  password: string;
};

export function LoginPage() {
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const setAuth = useMemberAuthStore((s) => s.setAuth);

  const onFinish = async (values: LoginForm) => {
    setLoading(true);
    try {
      const data = await memberAuth.login(memberClient, values);
      setAuth(data.access_token, data.user);
      message.success("登录成功");
      navigate(searchParams.get("redirect") || "/", { replace: true });
    } catch (err) {
      message.error(err instanceof Error ? err.message : "登录失败");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ maxWidth: 400, margin: "60px auto" }}>
      <Card style={{ borderRadius: "var(--radius-card)" }}>
        <Title level={3} style={{ textAlign: "center", marginBottom: 4 }}>
          会员登录
        </Title>
        <Paragraph style={{ textAlign: "center", color: "#999", marginBottom: 24 }}>
          登录您的跨境代购与集运账户
        </Paragraph>
        <Form layout="vertical" onFinish={onFinish} autoComplete="off">
          <Form.Item
            name="email"
            rules={[
              { required: true, message: "请输入邮箱" },
              { type: "email", message: "邮箱格式不正确" },
            ]}
          >
            <Input prefix={<MailOutlined />} placeholder="邮箱" size="large" />
          </Form.Item>
          <Form.Item
            name="password"
            rules={[{ required: true, message: "请输入密码" }]}
          >
            <Input.Password prefix={<LockOutlined />} placeholder="密码" size="large" />
          </Form.Item>
          <Form.Item>
            <Button type="primary" htmlType="submit" loading={loading} block size="large">
              登录
            </Button>
          </Form.Item>
        </Form>
        <div style={{ textAlign: "center" }}>
          <Link to="/register">注册新账户</Link>
          <span style={{ margin: "0 8px", color: "#ddd" }}>|</span>
          <Link to="/forgot-password">忘记密码</Link>
          <span style={{ margin: "0 8px", color: "#ddd" }}>|</span>
          <Link to="/admin/login" style={{ fontSize: 12, color: "#bbb" }}>
            后台入口
          </Link>
        </div>
      </Card>
    </div>
  );
}
