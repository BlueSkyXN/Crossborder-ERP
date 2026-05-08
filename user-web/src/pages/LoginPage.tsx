import { LockOutlined, MailOutlined } from "@ant-design/icons";
import { useMutation } from "@tanstack/react-query";
import { FormEvent, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";

import { ApiError } from "../api/types";
import { loginMember } from "../features/auth/api";
import { useAuthStore } from "../features/auth/store";
import styles from "./LoginPage.module.css";

export function LoginPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [email, setEmail] = useState("user@example.com");
  const [password, setPassword] = useState("password123");
  const setSession = useAuthStore((state) => state.setSession);
  const redirect = useMemo(() => searchParams.get("redirect") || "/dashboard", [searchParams]);

  const loginMutation = useMutation({
    mutationFn: loginMember,
    onSuccess: (result) => {
      setSession(result.access_token, result.user);
      navigate(redirect, { replace: true });
    },
  });

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    loginMutation.mutate({ email, password });
  };

  const errorMessage =
    loginMutation.error instanceof ApiError ? loginMutation.error.message : "登录失败";

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
            <h2>会员登录</h2>
            <p>进入你的集运工作台。</p>
          </div>
          {loginMutation.isError && <div className={styles.error}>{errorMessage}</div>}
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
          <button className={styles.submit} type="submit" disabled={loginMutation.isPending}>
            {loginMutation.isPending ? "登录中" : "登录"}
          </button>
        </form>
      </section>
    </main>
  );
}
