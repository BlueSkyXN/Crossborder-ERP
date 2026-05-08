import { LockOutlined, MailOutlined } from "@ant-design/icons";
import { useMutation } from "@tanstack/react-query";
import { Alert, Button, Card, Form, Input, Typography } from "antd";
import { useMemo } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";

import { ApiError } from "../api/types";
import { loginAdmin } from "../features/auth/api";
import { useAuthStore } from "../features/auth/store";

type LoginFormValues = {
  email: string;
  password: string;
};

export function LoginPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const setSession = useAuthStore((state) => state.setSession);
  const redirect = useMemo(() => searchParams.get("redirect") || "/dashboard", [searchParams]);

  const loginMutation = useMutation({
    mutationFn: loginAdmin,
    onSuccess: (result) => {
      setSession(result.access_token, result.admin_user);
      navigate(redirect, { replace: true });
    },
  });

  const handleFinish = (values: LoginFormValues) => {
    loginMutation.mutate(values);
  };

  const errorMessage =
    loginMutation.error instanceof ApiError ? loginMutation.error.message : "登录失败";

  return (
    <main className="login-page">
      <section className="login-panel">
        <div className="login-copy">
          <div className="login-badge">CrossBorder ERP</div>
          <Typography.Title>跨境集运运营后台</Typography.Title>
          <Typography.Paragraph>
            用统一工作台处理会员、仓库、包裹、运单和财务配置。
          </Typography.Paragraph>
          <div className="login-proof">
            <span>集运运营</span>
            <span>权限隔离</span>
            <span>配置中心</span>
          </div>
        </div>
        <Card className="login-card">
          <Typography.Title level={2}>管理员登录</Typography.Title>
          <Typography.Paragraph>权限登录入口</Typography.Paragraph>
          {loginMutation.isError && (
            <Alert className="login-error" type="error" showIcon message={errorMessage} />
          )}
          <Form<LoginFormValues>
            layout="vertical"
            requiredMark={false}
            initialValues={{ email: "admin@example.com", password: "password123" }}
            onFinish={handleFinish}
          >
            <Form.Item
              label="邮箱"
              name="email"
              rules={[{ required: true, message: "请输入邮箱" }, { type: "email" }]}
            >
              <Input prefix={<MailOutlined />} autoComplete="email" size="large" />
            </Form.Item>
            <Form.Item label="密码" name="password" rules={[{ required: true, message: "请输入密码" }]}>
              <Input.Password prefix={<LockOutlined />} autoComplete="current-password" size="large" />
            </Form.Item>
            <Button
              block
              size="large"
              type="primary"
              htmlType="submit"
              loading={loginMutation.isPending}
            >
              登录
            </Button>
          </Form>
        </Card>
      </section>
    </main>
  );
}
