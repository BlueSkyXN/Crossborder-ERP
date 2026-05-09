import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { FormEvent, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";

import { ApiError } from "../api/types";
import { changePassword, fetchMe, updateProfile } from "../features/auth/api";
import { useAuthStore } from "../features/auth/store";
import styles from "./PurchaseMobile.module.css";

function apiMessage(error: unknown, fallback: string) {
  if (error instanceof ApiError) {
    const fieldErrors = (error.data as { field_errors?: Record<string, string[]> } | undefined)?.field_errors;
    const firstFieldError = fieldErrors ? Object.values(fieldErrors).flat()[0] : "";
    return firstFieldError || error.message || fallback;
  }
  return fallback;
}

export function AccountSettingsMobilePage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const setUser = useAuthStore((state) => state.setUser);
  const [notice, setNotice] = useState("");
  const [passwordFormVersion, setPasswordFormVersion] = useState(0);

  const meQuery = useQuery({
    queryKey: ["mobile", "member", "me"],
    queryFn: fetchMe,
  });

  useEffect(() => {
    if (meQuery.data) {
      setUser(meQuery.data);
    }
  }, [meQuery.data, setUser]);

  const showNotice = (message: string) => {
    setNotice(message);
    window.setTimeout(() => setNotice(""), 2200);
  };

  const profileMutation = useMutation({
    mutationFn: updateProfile,
    onSuccess: (user) => {
      setUser(user);
      queryClient.setQueryData(["mobile", "member", "me"], user);
      showNotice("账户资料已保存");
    },
  });

  const passwordMutation = useMutation({
    mutationFn: changePassword,
    onSuccess: () => {
      setPasswordFormVersion((current) => current + 1);
      showNotice("密码已更新");
    },
  });

  const handleProfileSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    profileMutation.mutate({
      display_name: String(formData.get("display_name") || "").trim(),
      phone: String(formData.get("phone") || "").trim(),
    });
  };

  const handlePasswordSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    passwordMutation.mutate({
      current_password: String(formData.get("current_password") || ""),
      new_password: String(formData.get("new_password") || ""),
    });
  };

  const member = meQuery.data;
  const profileFormKey = `profile-${member?.id || "loading"}-${member?.profile.display_name || ""}-${member?.phone || ""}`;

  return (
    <main className={styles.page}>
      <header className={styles.top}>
        <button type="button" onClick={() => navigate("/me")}>
          我的
        </button>
        <div>
          <span>Account</span>
          <h1>账户设置</h1>
        </div>
        <button type="button" onClick={() => meQuery.refetch()}>
          刷新
        </button>
      </header>

      {notice && <div className={styles.notice}>{notice}</div>}
      {meQuery.isError && <div className={styles.error}>账户资料加载失败，请刷新后重试</div>}

      <section className={styles.summary}>
        <div>
          <span>会员号</span>
          <strong>{member?.profile.member_no || "-"}</strong>
        </div>
        <div>
          <span>仓库标识</span>
          <strong>{member?.profile.warehouse_code || "-"}</strong>
        </div>
        <div>
          <span>状态</span>
          <strong>{member?.status || "-"}</strong>
        </div>
      </section>

      <form key={profileFormKey} className={styles.panel} onSubmit={handleProfileSubmit}>
        <div className={styles.sectionHead}>
          <span>Profile</span>
          <h2>基本资料</h2>
          <p>昵称和手机号会同步到会员中心与客服识别信息。</p>
        </div>
        {profileMutation.isError && <div className={styles.error}>{apiMessage(profileMutation.error, "账户资料保存失败")}</div>}
        <div className={styles.form}>
          <label>
            <span>登录邮箱</span>
            <input value={member?.email || ""} disabled />
          </label>
          <label>
            <span>显示昵称</span>
            <input name="display_name" defaultValue={member?.profile.display_name || ""} />
          </label>
          <label>
            <span>手机号</span>
            <input name="phone" defaultValue={member?.phone || ""} />
          </label>
        </div>
        <button className={styles.primaryButton} type="submit" disabled={profileMutation.isPending || meQuery.isLoading}>
          {profileMutation.isPending ? "保存中" : "保存资料"}
        </button>
      </form>

      <form key={passwordFormVersion} className={styles.panel} onSubmit={handlePasswordSubmit}>
        <div className={styles.sectionHead}>
          <span>Password</span>
          <h2>登录密码</h2>
          <p>修改后下次登录需使用新密码，当前 token 保持本次会话。</p>
        </div>
        {passwordMutation.isError && <div className={styles.error}>{apiMessage(passwordMutation.error, "密码更新失败")}</div>}
        <div className={styles.form}>
          <label>
            <span>当前密码</span>
            <input
              name="current_password"
              type="password"
              autoComplete="current-password"
              required
            />
          </label>
          <label>
            <span>新密码</span>
            <input
              name="new_password"
              type="password"
              autoComplete="new-password"
              minLength={8}
              required
            />
          </label>
        </div>
        <button className={styles.primaryButton} type="submit" disabled={passwordMutation.isPending}>
          {passwordMutation.isPending ? "更新中" : "更新密码"}
        </button>
      </form>
    </main>
  );
}
