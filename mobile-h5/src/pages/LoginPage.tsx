import { Button, Form, Input } from "antd-mobile";
import { useMutation } from "@tanstack/react-query";
import { useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";

import { ApiError } from "../api/types";
import { confirmPasswordReset, loginMember, registerMember, requestPasswordReset } from "../features/auth/api";
import { useAuthStore } from "../features/auth/store";
import type { LoginPayload, PasswordResetConfirmPayload, RegisterPayload } from "../features/auth/types";
import { safeRedirect } from "../routes/redirect";
import styles from "./LoginPage.module.css";

type AuthMode = "login" | "register" | "reset";
type ResetFormValues = {
  email: string;
  token?: string;
  new_password?: string;
};

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
  const [resetNotice, setResetNotice] = useState("");
  const [resetToken, setResetToken] = useState("");
  const [resetDone, setResetDone] = useState(false);

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

  const resetRequestMutation = useMutation({
    mutationFn: requestPasswordReset,
    onSuccess: (result) => {
      setErrorMessage("");
      setResetDone(false);
      if (result.dev_reset_token) {
        setResetToken(result.dev_reset_token);
        setResetNotice(`重置令牌已生成，${result.expires_in_minutes} 分钟内有效。`);
        return;
      }
      setResetNotice("重置请求已受理，请查看预留通知渠道。");
    },
    onError: (error) => {
      const message = error instanceof ApiError ? error.message : "重置密码失败";
      setErrorMessage(message);
    },
  });

  const resetConfirmMutation = useMutation({
    mutationFn: (payload: PasswordResetConfirmPayload) => confirmPasswordReset(payload),
    onSuccess: () => {
      setErrorMessage("");
      setResetToken("");
      setResetDone(true);
      setResetNotice("密码已重置，可以返回登录。");
      loginMutation.reset();
    },
    onError: (error) => {
      const message = error instanceof ApiError ? error.message : "重置密码失败";
      setErrorMessage(message);
    },
  });

  const handleFinish = (values: LoginPayload | RegisterPayload | ResetFormValues) => {
    setErrorMessage("");
    if (mode === "reset") {
      const resetValues = values as ResetFormValues;
      const token = resetValues.token?.trim() || resetToken;
      if (!token) {
        resetRequestMutation.mutate({ email: resetValues.email.trim() });
        return;
      }
      resetConfirmMutation.mutate({
        email: resetValues.email.trim(),
        token,
        new_password: resetValues.new_password || "",
      });
      return;
    }
    const authValues = values as LoginPayload | RegisterPayload;
    loginMutation.mutate({
      ...authValues,
      email: authValues.email.trim(),
      display_name: "display_name" in authValues ? authValues.display_name?.trim() : undefined,
      phone: "phone" in authValues ? authValues.phone?.trim() : undefined,
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
          <button className={mode === "reset" ? styles.activeMode : ""} type="button" onClick={() => setMode("reset")}>
            找回密码
          </button>
        </div>
        <Form
          key={`${mode}-${resetToken ? "token" : "empty"}`}
          layout="vertical"
          requiredMarkStyle="none"
          initialValues={
            mode === "login"
              ? { email: "user@example.com", password: "password123" }
              : mode === "register"
                ? { email: "", password: "", display_name: "", phone: "" }
                : { email: "user@example.com", token: resetToken, new_password: "" }
          }
          onFinish={handleFinish}
          footer={
            <>
              {resetDone && mode === "reset" && (
                <Button block fill="outline" className={styles.secondary} onClick={() => setMode("login")}>
                  返回登录
                </Button>
              )}
              <Button
                block
                color="primary"
                loading={
                  mode === "reset"
                    ? resetRequestMutation.isPending || resetConfirmMutation.isPending
                    : loginMutation.isPending
                }
                type="submit"
                className={styles.submit}
              >
                {mode === "reset" ? (resetToken ? "重置密码" : "获取重置令牌") : mode === "register" ? "注册并登录" : "登录"}
              </Button>
            </>
          }
        >
          {errorMessage && <div className={styles.error}>{errorMessage}</div>}
          {mode === "reset" && resetNotice && <div className={styles.notice}>{resetNotice}</div>}
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
          {mode === "reset" ? (
            <>
              <Form.Item name="token" label="重置令牌" initialValue={resetToken}>
                <Input clearable autoComplete="one-time-code" placeholder="先提交邮箱获取" onChange={setResetToken} />
              </Form.Item>
              <Form.Item
                name="new_password"
                label="新密码"
                rules={resetToken ? [{ required: true, message: "请输入新密码" }] : []}
              >
                <Input clearable type="password" autoComplete="new-password" placeholder="至少 8 位" />
              </Form.Item>
            </>
          ) : (
            <Form.Item
              name="password"
              label="密码"
              rules={[{ required: true, message: "请输入密码" }]}
            >
              <Input clearable type="password" autoComplete="current-password" placeholder="password123" />
            </Form.Item>
          )}
        </Form>
      </section>
    </main>
  );
}
