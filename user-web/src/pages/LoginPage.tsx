import { LockOutlined, MailOutlined, PhoneOutlined, UserOutlined } from "@ant-design/icons";
import { useMutation } from "@tanstack/react-query";
import { FormEvent, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";

import { ApiError } from "../api/types";
import { loginMember, registerMember } from "../features/auth/api";
import { useAuthStore } from "../features/auth/store";
import type { LoginPayload, RegisterPayload } from "../features/auth/types";
import styles from "./LoginPage.module.css";

type AuthMode = "login" | "register";

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

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
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
            <h2>{mode === "register" ? "会员注册" : "会员登录"}</h2>
            <p>{mode === "register" ? "创建会员号后自动进入集运工作台。" : "进入你的集运工作台。"}</p>
          </div>
          <div className={styles.modeSwitch} aria-label="登录注册切换">
            <button className={mode === "login" ? styles.activeMode : ""} type="button" onClick={() => setMode("login")}>
              登录
            </button>
            <button className={mode === "register" ? styles.activeMode : ""} type="button" onClick={() => setMode("register")}>
              注册
            </button>
          </div>
          {authMutation.isError && <div className={styles.error}>{errorMessage}</div>}
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
          <button className={styles.submit} type="submit" disabled={authMutation.isPending}>
            {authMutation.isPending ? "处理中" : mode === "register" ? "注册并登录" : "登录"}
          </button>
        </form>
      </section>
    </main>
  );
}
