import { useState } from "react";
import { LockOutlined, UserOutlined } from "@ant-design/icons";
import { adminAuth, type AdminSession } from "@crossborder-erp/api-client";
import { Button, Card, Form, Input, Typography, message } from "antd";
import { useNavigate } from "react-router-dom";
import { adminClient } from "../../api/client";
import { useAdminAuthStore } from "../../stores/auth";

const { Title } = Typography;

type LoginForm = {
  email: string;
  password: string;
};

export function AdminLoginPage() {
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const setAuth = useAdminAuthStore((s) => s.setAuth);

  const onFinish = async (values: LoginForm) => {
    setLoading(true);
    try {
      const data: AdminSession = await adminAuth.login(adminClient, values);
      setAuth(data.access_token, data.admin_user as Parameters<typeof setAuth>[1]);
      message.success("登录成功");
      navigate("/admin", { replace: true });
    } catch (err) {
      message.error(err instanceof Error ? err.message : "登录失败");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ maxWidth: 400, margin: "120px auto" }}>
      <Card style={{ borderRadius: "var(--radius-card)" }}>
        <Title level={3} style={{ textAlign: "center", marginBottom: 24 }}>
          后台管理登录
        </Title>
        <Form layout="vertical" onFinish={onFinish} autoComplete="off">
          <Form.Item name="email" rules={[{ required: true, message: "请输入邮箱" }]}>
            <Input prefix={<UserOutlined />} placeholder="邮箱" size="large" />
          </Form.Item>
          <Form.Item name="password" rules={[{ required: true, message: "请输入密码" }]}>
            <Input.Password prefix={<LockOutlined />} placeholder="密码" size="large" />
          </Form.Item>
          <Form.Item>
            <Button type="primary" htmlType="submit" loading={loading} block size="large">
              登录
            </Button>
          </Form.Item>
        </Form>
      </Card>
    </div>
  );
}
