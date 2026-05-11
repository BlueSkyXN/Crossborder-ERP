import { useState } from "react";
import { Button, Card, Form, Input, Result, Typography, message } from "antd";
import { MailOutlined } from "@ant-design/icons";
import { Link } from "react-router-dom";
import { memberAuth } from "@crossborder-erp/api-client";
import { memberClient } from "../api/client";

const { Title, Paragraph } = Typography;

type ForgotPasswordForm = {
  email: string;
};

export function ForgotPasswordPage() {
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  const onFinish = async (values: ForgotPasswordForm) => {
    setLoading(true);
    try {
      await memberAuth.requestPasswordReset(memberClient, values);
      setSent(true);
    } catch (err) {
      message.error(err instanceof Error ? err.message : "请求失败");
    } finally {
      setLoading(false);
    }
  };

  if (sent) {
    return (
      <div style={{ maxWidth: 400, margin: "60px auto" }}>
        <Card style={{ borderRadius: "var(--radius-card)" }}>
          <Result
            status="success"
            title="重置邮件已发送"
            subTitle="请查收您的邮箱，按照邮件中的提示重置密码。"
            extra={(
              <Link to="/login">
                <Button type="primary">返回登录</Button>
              </Link>
            )}
          />
        </Card>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: 400, margin: "60px auto" }}>
      <Card style={{ borderRadius: "var(--radius-card)" }}>
        <Title level={3} style={{ textAlign: "center", marginBottom: 4 }}>
          找回密码
        </Title>
        <Paragraph style={{ textAlign: "center", color: "#999", marginBottom: 24 }}>
          输入您的注册邮箱，我们将发送密码重置链接
        </Paragraph>
        <Form layout="vertical" onFinish={onFinish} autoComplete="off">
          <Form.Item
            name="email"
            rules={[
              { required: true, message: "请输入邮箱" },
              { type: "email", message: "邮箱格式不正确" },
            ]}
          >
            <Input prefix={<MailOutlined />} placeholder="注册邮箱" size="large" />
          </Form.Item>
          <Form.Item>
            <Button type="primary" htmlType="submit" loading={loading} block size="large">
              发送重置邮件
            </Button>
          </Form.Item>
        </Form>
        <div style={{ textAlign: "center" }}>
          <Link to="/login">返回登录</Link>
        </div>
      </Card>
    </div>
  );
}
