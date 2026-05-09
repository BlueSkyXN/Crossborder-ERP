import { ArrowLeftOutlined, CopyOutlined, ReloadOutlined } from "@ant-design/icons";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";

import { useAuthStore } from "../auth/store";
import { fetchGrowthOverview, fetchReferralRelations } from "./api";
import type { ReferralRelation } from "./types";
import styles from "./GrowthPages.module.css";

const referralStatusText: Record<ReferralRelation["status"], { label: string; tone: string }> = {
  PENDING: { label: "待激活", tone: "pending" },
  ACTIVE: { label: "已生效", tone: "active" },
  INVALID: { label: "无效", tone: "invalid" },
};

function formatDate(value?: string | null) {
  return value ? new Date(value).toLocaleString("zh-CN", { hour12: false }) : "-";
}

function copyWithTextarea(value: string) {
  const textarea = document.createElement("textarea");
  textarea.value = value;
  textarea.setAttribute("readonly", "true");
  textarea.style.position = "fixed";
  textarea.style.top = "-9999px";
  document.body.appendChild(textarea);
  textarea.select();
  const copied = document.execCommand("copy");
  document.body.removeChild(textarea);
  return copied;
}

export function ReferralPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const user = useAuthStore((state) => state.user);
  const [notice, setNotice] = useState("");

  const overviewQuery = useQuery({
    queryKey: ["member", "growth-summary"],
    queryFn: fetchGrowthOverview,
  });
  const referralsQuery = useQuery({
    queryKey: ["member", "growth-referrals"],
    queryFn: fetchReferralRelations,
  });

  const referrals = useMemo(() => referralsQuery.data ?? [], [referralsQuery.data]);
  const referralCode = overviewQuery.data?.referral_code || user?.profile?.member_no || "";
  const referralLink = referralCode
    ? `${window.location.origin}/login?ref=${encodeURIComponent(referralCode)}`
    : "-";

  const showNotice = (message: string) => {
    setNotice(message);
    window.setTimeout(() => setNotice(""), 1800);
  };

  const copyReferralLink = () => {
    if (!referralCode) {
      return;
    }
    try {
      if (navigator.clipboard?.writeText) {
        navigator.clipboard.writeText(referralLink).then(
          () => showNotice("推广链接已复制。"),
          () => {
            copyWithTextarea(referralLink);
            showNotice("推广链接已复制。");
          },
        );
      } else {
        copyWithTextarea(referralLink);
        showNotice("推广链接已复制。");
      }
    } catch {
      showNotice("复制失败，请手动复制推广链接。");
    }
  };

  const hasError = overviewQuery.isError || referralsQuery.isError;

  return (
    <main className={styles.page}>
      <header className={styles.header}>
        <div className={styles.brand}>
          <div className={styles.logo}>CB</div>
          <div>
            <strong>推广邀请</strong>
            <span>Referral Center</span>
          </div>
        </div>
        <div className={styles.actions}>
          <button className={styles.backButton} type="button" onClick={() => navigate("/dashboard")}>
            <ArrowLeftOutlined />
            返回首页
          </button>
          <button className={styles.iconButton} type="button" onClick={() => queryClient.invalidateQueries()}>
            <ReloadOutlined />
          </button>
        </div>
      </header>

      {notice && <div className={styles.notice}>{notice}</div>}
      {hasError && <div className={styles.alert}>推广数据加载失败，请刷新或稍后再试。</div>}

      <section className={styles.summary}>
        <article className={styles.metric}>
          <span>邀请码</span>
          <strong>{referralCode || "-"}</strong>
        </article>
        <article className={styles.metric}>
          <span>累计邀请</span>
          <strong>{overviewQuery.data?.invited_count ?? referrals.length}</strong>
        </article>
        <article className={styles.metric}>
          <span>有效邀请</span>
          <strong>{overviewQuery.data?.active_invited_count ?? 0}</strong>
        </article>
        <article className={styles.metric}>
          <span>奖励积分</span>
          <strong>{overviewQuery.data?.confirmed_reward_points ?? 0}</strong>
        </article>
      </section>

      <section className={styles.workspace}>
        <aside className={styles.panel}>
          <div className={styles.sectionTitle}>
            <div>
              <h1>我的推广链接</h1>
              <p>分享给好友注册，邀请生效后可获得积分和返利。</p>
            </div>
          </div>
          <div className={styles.linkBox}>
            <code>{referralLink}</code>
          </div>
          <button className={styles.primaryButton} type="button" onClick={copyReferralLink}>
            <CopyOutlined />
            复制推广链接
          </button>
        </aside>

        <section className={styles.panel}>
          <div className={styles.sectionTitle}>
            <div>
              <h2>邀请记录</h2>
              <p>查看被邀请会员、状态和激活时间。</p>
            </div>
          </div>
          <div className={styles.records}>
            {referrals.map((referral) => {
              const meta = referralStatusText[referral.status] || { label: referral.status, tone: "" };
              return (
                <article className={styles.recordCard} key={referral.id}>
                  <div className={styles.recordHead}>
                    <strong>{referral.invitee_email || referral.invitee_member_no || "-"}</strong>
                    <span className={`${styles.statusBadge} ${styles[meta.tone]}`}>{meta.label}</span>
                  </div>
                  <p className={styles.recordMeta}>
                    邀请码 {referral.invitation_code || "-"} · 创建 {formatDate(referral.created_at)} · 激活{" "}
                    {formatDate(referral.activated_at)}
                  </p>
                </article>
              );
            })}
            {!referrals.length && <div className={styles.empty}>暂无邀请记录</div>}
          </div>
        </section>
      </section>
    </main>
  );
}
