import { KeyOutlined, LockOutlined, MailOutlined, PhoneOutlined, UserOutlined } from "@ant-design/icons";
import { useMutation } from "@tanstack/react-query";
import { FormEvent, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";

import { ApiError } from "../api/types";
import { confirmPasswordReset, loginMember, registerMember, requestPasswordReset } from "../features/auth/api";
import { useAuthStore } from "../features/auth/store";
import type { LoginPayload, PasswordResetConfirmPayload, RegisterPayload } from "../features/auth/types";
import styles from "./LoginPage.module.css";

type AuthMode = "login" | "register" | "reset";

async function registerThenLogin(payload: RegisterPayload) {
  await registerMember(payload);
  return loginMember({ email: payload.email, password: payload.password });
}

export function LoginPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [mode, setMode] = useState<AuthMode>("login");
  const [email, setEmail] = useState("user@example.com");
  const [password, setPassword] = useState("password123");
  const [resetToken, setResetToken] = useState("");
  const [resetPassword, setResetPassword] = useState("");
  const [resetNotice, setResetNotice] = useState("");
  const [resetDone, setResetDone] = useState(false);
  const [displayName, setDisplayName] = useState("");
  const [phone, setPhone] = useState("");
  const setSession = useAuthStore((state) => state.setSession);
  const redirect = useMemo(() => searchParams.get("redirect") || "/dashboard", [searchParams]);

  const authMutation = useMutation({
    mutationFn: (payload: LoginPayload | RegisterPayload) =>
      mode === "register" ? registerThenLogin(payload as RegisterPayload) : loginMember(payload as LoginPayload),
    onSuccess: (result) => {
      setSession(result.access_token, result.user);
      navigate(redirect, { replace: true });
    },
  });

  const resetRequestMutation = useMutation({
    mutationFn: requestPasswordReset,
    onSuccess: (result) => {
      setResetDone(false);
      if (result.dev_reset_token) {
        setResetToken(result.dev_reset_token);
        setResetNotice(`重置令牌已生成，${result.expires_in_minutes} 分钟内有效。`);
        return;
      }
      setResetNotice("重置请求已受理，请查看预留通知渠道。");
    },
  });

  const resetConfirmMutation = useMutation({
    mutationFn: (payload: PasswordResetConfirmPayload) => confirmPasswordReset(payload),
    onSuccess: () => {
      setPassword(resetPassword);
      setResetPassword("");
      setResetToken("");
      setResetDone(true);
      setResetNotice("密码已重置，可以返回登录。");
    },
  });

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (mode === "reset") {
      setResetNotice("");
      if (!resetToken.trim()) {
        resetRequestMutation.mutate({ email: email.trim() });
        return;
      }
      resetConfirmMutation.mutate({
        email: email.trim(),
        token: resetToken,
        new_password: resetPassword,
      });
      return;
    }
    const basePayload = { email: email.trim(), password };
    authMutation.mutate(
      mode === "register"
        ? {
            ...basePayload,
            display_name: displayName.trim(),
            phone: phone.trim(),
          }
        : basePayload,
    );
  };

  const errorMessage =
    authMutation.error instanceof ApiError ? authMutation.error.message : mode === "register" ? "注册失败" : "登录失败";
  const resetError =
    resetRequestMutation.error instanceof ApiError
      ? resetRequestMutation.error.message
      : resetConfirmMutation.error instanceof ApiError
        ? resetConfirmMutation.error.message
        : "重置密码失败";
  const isResetPending = resetRequestMutation.isPending || resetConfirmMutation.isPending;

  return (
    <main className={styles.page}>
      <section className={styles.panel}>
        <div className={styles.brand}>
          <div className={styles.badge}>CrossBorder ERP</div>
          <h1>会员集运中心</h1>
          <p>查看专属仓库地址、包裹状态、运单进度和账户信息。</p>
          <div className={styles.metrics}>
            <span>仓库地址</span>
            <span>包裹预报</span>
            <span>运单支付</span>
          </div>
        </div>
        <form className={styles.card} onSubmit={handleSubmit}>
          <div>
            <h2>{mode === "register" ? "会员注册" : mode === "reset" ? "重置密码" : "会员登录"}</h2>
            <p>
              {mode === "register"
                ? "创建会员号后自动进入集运工作台。"
                : mode === "reset"
                  ? "找回会员账号访问权限。"
                  : "进入你的集运工作台。"}
            </p>
          </div>
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
          {mode !== "reset" && authMutation.isError && <div className={styles.error}>{errorMessage}</div>}
          {mode === "reset" && (resetRequestMutation.isError || resetConfirmMutation.isError) && (
            <div className={styles.error}>{resetError}</div>
          )}
          {mode === "reset" && resetNotice && <div className={styles.notice}>{resetNotice}</div>}
          <label>
            <span>邮箱</span>
            <div className={styles.inputWrap}>
              <MailOutlined />
              <input
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                type="email"
                autoComplete="email"
                required
              />
            </div>
          </label>
          {mode === "register" && (
            <>
              <label>
                <span>昵称</span>
                <div className={styles.inputWrap}>
                  <UserOutlined />
                  <input
                    value={displayName}
                    onChange={(event) => setDisplayName(event.target.value)}
                    autoComplete="name"
                    placeholder="用于会员中心展示"
                  />
                </div>
              </label>
              <label>
                <span>手机号</span>
                <div className={styles.inputWrap}>
                  <PhoneOutlined />
                  <input
                    value={phone}
                    onChange={(event) => setPhone(event.target.value)}
                    autoComplete="tel"
                    placeholder="可选"
                  />
                </div>
              </label>
            </>
          )}
          {mode === "reset" ? (
            <>
              <label>
                <span>重置令牌</span>
                <div className={styles.inputWrap}>
                  <KeyOutlined />
                  <input
                    value={resetToken}
                    onChange={(event) => setResetToken(event.target.value)}
                    autoComplete="one-time-code"
                    placeholder="先提交邮箱获取"
                  />
                </div>
              </label>
              <label>
                <span>新密码</span>
                <div className={styles.inputWrap}>
                  <LockOutlined />
                  <input
                    value={resetPassword}
                    onChange={(event) => setResetPassword(event.target.value)}
                    type="password"
                    autoComplete="new-password"
                    minLength={8}
                    required={Boolean(resetToken.trim())}
                  />
                </div>
              </label>
            </>
          ) : (
            <label>
              <span>密码</span>
              <div className={styles.inputWrap}>
                <LockOutlined />
                <input
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  type="password"
                  autoComplete="current-password"
                  required
                />
              </div>
            </label>
          )}
          {resetDone && mode === "reset" && (
            <button className={styles.secondary} type="button" onClick={() => setMode("login")}>
              返回登录
            </button>
          )}
          <button className={styles.submit} type="submit" disabled={mode === "reset" ? isResetPending : authMutation.isPending}>
            {mode === "reset"
              ? isResetPending
                ? "处理中"
                : resetToken.trim()
                  ? "重置密码"
                  : "获取重置令牌"
              : authMutation.isPending
                ? "处理中"
                : mode === "register"
                  ? "注册并登录"
                  : "登录"}
          </button>
        </form>
      </section>
    </main>
  );
}
