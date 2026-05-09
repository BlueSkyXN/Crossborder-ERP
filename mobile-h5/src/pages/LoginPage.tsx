import { Button, Form, Input } from "antd-mobile";
import { useMutation } from "@tanstack/react-query";
import { useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";

import { ApiError } from "../api/types";
import { loginMember, registerMember } from "../features/auth/api";
import { useAuthStore } from "../features/auth/store";
import type { LoginPayload, RegisterPayload } from "../features/auth/types";
import { safeRedirect } from "../routes/redirect";
import styles from "./LoginPage.module.css";

type AuthMode = "login" | "register";

async function registerThenLogin(payload: RegisterPayload) {
  await registerMember(payload);
  return loginMember({ email: payload.email, password: payload.password });
}

export function LoginPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const setSession = useAuthStore((state) => state.setSession);
  const [mode, setMode] = useState<AuthMode>("login");
  const [errorMessage, setErrorMessage] = useState("");

  const loginMutation = useMutation({
    mutationFn: (payload: LoginPayload | RegisterPayload) =>
      mode === "register" ? registerThenLogin(payload as RegisterPayload) : loginMember(payload as LoginPayload),
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

  const handleFinish = (values: LoginPayload | RegisterPayload) => {
    setErrorMessage("");
    loginMutation.mutate({
      ...values,
      email: values.email.trim(),
      display_name: "display_name" in values ? values.display_name?.trim() : undefined,
      phone: "phone" in values ? values.phone?.trim() : undefined,
    });
  };

  return (
    <main className={styles.page}>
      <section className={styles.header}>
        <div className={styles.brand}>CB</div>
        <p>CrossBorder ERP</p>
        <h1>移动寄件中心</h1>
      </section>

      <section className={styles.card}>
        <div className={styles.modeSwitch} aria-label="登录注册切换">
          <button className={mode === "login" ? styles.activeMode : ""} type="button" onClick={() => setMode("login")}>
            登录
          </button>
          <button className={mode === "register" ? styles.activeMode : ""} type="button" onClick={() => setMode("register")}>
            注册
          </button>
        </div>
        <Form
          key={mode}
          layout="vertical"
          requiredMarkStyle="none"
          initialValues={
            mode === "login"
              ? { email: "user@example.com", password: "password123" }
              : { email: "", password: "", display_name: "", phone: "" }
          }
          onFinish={handleFinish}
          footer={
            <Button
              block
              color="primary"
              loading={loginMutation.isPending}
              type="submit"
              className={styles.submit}
            >
              {mode === "register" ? "注册并登录" : "登录"}
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
          {mode === "register" && (
            <>
              <Form.Item name="display_name" label="昵称">
                <Input clearable autoComplete="name" placeholder="用于会员中心展示" />
              </Form.Item>
              <Form.Item name="phone" label="手机号">
                <Input clearable autoComplete="tel" placeholder="可选" />
              </Form.Item>
            </>
          )}
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
