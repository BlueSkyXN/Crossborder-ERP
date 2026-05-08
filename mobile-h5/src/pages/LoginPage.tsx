import { Button, Form, Input } from "antd-mobile";
import { useMutation } from "@tanstack/react-query";
import { useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";

import { ApiError } from "../api/types";
import { loginMember } from "../features/auth/api";
import { useAuthStore } from "../features/auth/store";
import type { LoginPayload } from "../features/auth/types";
import { safeRedirect } from "../routes/redirect";
import styles from "./LoginPage.module.css";

export function LoginPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const setSession = useAuthStore((state) => state.setSession);
  const [errorMessage, setErrorMessage] = useState("");

  const loginMutation = useMutation({
    mutationFn: loginMember,
    onSuccess: (result) => {
      setErrorMessage("");
      setSession(result.access_token, result.user);
      navigate(safeRedirect(searchParams.get("redirect")), { replace: true });
    },
    onError: (error) => {
      const message = error instanceof ApiError ? error.message : "登录失败";
      setErrorMessage(message);
    },
  });

  const handleFinish = (values: LoginPayload) => {
    setErrorMessage("");
    loginMutation.mutate(values);
  };

  return (
    <main className={styles.page}>
      <section className={styles.header}>
        <div className={styles.brand}>CB</div>
        <p>CrossBorder ERP</p>
        <h1>移动寄件中心</h1>
      </section>

      <section className={styles.card}>
        <Form
          layout="vertical"
          requiredMarkStyle="none"
          initialValues={{ email: "user@example.com", password: "password123" }}
          onFinish={handleFinish}
          footer={
            <Button
              block
              color="primary"
              loading={loginMutation.isPending}
              type="submit"
              className={styles.submit}
            >
              登录
            </Button>
          }
        >
          {errorMessage && <div className={styles.error}>{errorMessage}</div>}
          <Form.Item
            name="email"
            label="邮箱"
            rules={[{ required: true, message: "请输入邮箱" }]}
          >
            <Input clearable type="email" autoComplete="email" placeholder="user@example.com" />
          </Form.Item>
          <Form.Item
            name="password"
            label="密码"
            rules={[{ required: true, message: "请输入密码" }]}
          >
            <Input clearable type="password" autoComplete="current-password" placeholder="password123" />
          </Form.Item>
        </Form>
      </section>
    </main>
  );
}
