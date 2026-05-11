import { useState } from "react";
import { Button, Card, Form, Input, Typography, message } from "antd";
import { LockOutlined, MailOutlined, UserOutlined } from "@ant-design/icons";
import { Link, useNavigate } from "react-router-dom";
import { memberAuth } from "@crossborder-erp/api-client";
import { memberClient } from "../api/client";

const { Title, Paragraph } = Typography;

type RegisterForm = {
  email: string;
  password: string;
  nickname: string;
};

export function RegisterPage() {
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const onFinish = async (values: RegisterForm) => {
    setLoading(true);
    try {
      await memberAuth.register(memberClient, {
        email: values.email,
        password: values.password,
        display_name: values.nickname,
      });
      message.success("注册成功，请登录");
      navigate("/login", { replace: true });
    } catch (err) {
      message.error(err instanceof Error ? err.message : "注册失败");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ maxWidth: 400, margin: "60px auto" }}>
      <Card style={{ borderRadius: "var(--radius-card)" }}>
        <Title level={3} style={{ textAlign: "center", marginBottom: 4 }}>
          注册账户
        </Title>
        <Paragraph style={{ textAlign: "center", color: "#999", marginBottom: 24 }}>
          创建您的跨境代购与集运账户
        </Paragraph>
        <Form layout="vertical" onFinish={onFinish} autoComplete="off">
          <Form.Item
            name="nickname"
            rules={[{ required: true, message: "请输入昵称" }]}
          >
            <Input prefix={<UserOutlined />} placeholder="昵称" size="large" />
          </Form.Item>
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
            rules={[
              { required: true, message: "请输入密码" },
              { min: 6, message: "密码至少 6 位" },
            ]}
          >
            <Input.Password prefix={<LockOutlined />} placeholder="密码" size="large" />
          </Form.Item>
          <Form.Item>
            <Button type="primary" htmlType="submit" loading={loading} block size="large">
              注册
            </Button>
          </Form.Item>
        </Form>
        <div style={{ textAlign: "center" }}>
          <span style={{ color: "#999" }}>已有账户？</span> <Link to="/login">立即登录</Link>
        </div>
      </Card>
    </div>
  );
}
