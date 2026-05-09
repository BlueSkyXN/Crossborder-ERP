import { ArrowLeftOutlined, ReloadOutlined } from "@ant-design/icons";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo } from "react";
import { useNavigate } from "react-router-dom";

import { fetchGrowthOverview, fetchRebateRecords } from "./api";
import type { RebateRecord } from "./types";
import styles from "./GrowthPages.module.css";

const rebateStatusText: Record<RebateRecord["status"], { label: string; tone: string }> = {
  PENDING: { label: "待确认", tone: "pending" },
  CONFIRMED: { label: "已确认", tone: "confirmed" },
  CANCELLED: { label: "已取消", tone: "cancelled" },
};

function formatDate(value?: string | null) {
  return value ? new Date(value).toLocaleString("zh-CN", { hour12: false }) : "-";
}

function formatMoney(value?: string | number | null, currency = "CNY") {
  const normalized = typeof value === "number" ? value.toFixed(2) : value || "0.00";
  return `${currency} ${normalized}`;
}

export function RebatePage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const overviewQuery = useQuery({
    queryKey: ["member", "growth-summary"],
    queryFn: fetchGrowthOverview,
  });
  const rebatesQuery = useQuery({
    queryKey: ["member", "growth-rebates"],
    queryFn: fetchRebateRecords,
  });

  const rebates = useMemo(() => rebatesQuery.data ?? [], [rebatesQuery.data]);
  const confirmedAmount = rebates
    .filter((rebate) => rebate.status === "CONFIRMED")
    .reduce((total, rebate) => total + Number(rebate.amount || 0), 0);
  const pendingAmount = rebates
    .filter((rebate) => rebate.status === "PENDING")
    .reduce((total, rebate) => total + Number(rebate.amount || 0), 0);
  const currency = overviewQuery.data?.currency || rebates[0]?.currency || "CNY";

  return (
    <main className={styles.page}>
      <header className={styles.header}>
        <div className={styles.brand}>
          <div className={styles.logo}>CB</div>
          <div>
            <strong>返利记录</strong>
            <span>Rebate Records</span>
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

      {(overviewQuery.isError || rebatesQuery.isError) && (
        <div className={styles.alert}>返利数据加载失败，请刷新或稍后再试。</div>
      )}

      <section className={styles.summary}>
        <article className={styles.metric}>
          <span>已确认返利</span>
          <strong>{formatMoney(overviewQuery.data?.confirmed_rebate_amount ?? confirmedAmount, currency)}</strong>
        </article>
        <article className={styles.metric}>
          <span>待确认返利</span>
          <strong>{formatMoney(overviewQuery.data?.pending_rebate_amount ?? pendingAmount, currency)}</strong>
        </article>
        <article className={styles.metric}>
          <span>奖励积分</span>
          <strong>{overviewQuery.data?.confirmed_reward_points ?? 0}</strong>
        </article>
        <article className={styles.metric}>
          <span>返利规则</span>
          <strong>{overviewQuery.data?.rebate_rule_note || "以平台规则为准"}</strong>
        </article>
      </section>

      <section className={styles.workspace}>
        <aside className={styles.panel}>
          <div className={styles.sectionTitle}>
            <div>
              <h1>返利概览</h1>
              <p>返利由平台审核确认后计入会员推广收益。</p>
            </div>
          </div>
        </aside>
        <section className={styles.panel}>
          <div className={styles.sectionTitle}>
            <div>
              <h2>返利明细</h2>
              <p>展示返利金额、奖励积分和关联业务。</p>
            </div>
          </div>
          <div className={styles.records}>
            {rebates.map((rebate) => {
              const meta = rebateStatusText[rebate.status] || { label: rebate.status, tone: "" };
              return (
                <article className={styles.recordCard} key={rebate.id}>
                  <div className={styles.recordHead}>
                    <strong>{formatMoney(rebate.amount, rebate.currency)}</strong>
                    <span className={`${styles.statusBadge} ${styles[meta.tone]}`}>{meta.label}</span>
                  </div>
                  <p className={styles.recordMeta}>
                    被邀请人 {rebate.invitee_email || "-"} · 奖励积分 {rebate.reward_points} · {formatDate(rebate.created_at)}
                  </p>
                  <p className={styles.recordMeta}>
                    业务 {rebate.business_type || "-"} #{rebate.business_id || "-"}
                    {rebate.remark ? ` · ${rebate.remark}` : ""}
                  </p>
                </article>
              );
            })}
            {!rebates.length && <div className={styles.empty}>暂无返利记录</div>}
          </div>
        </section>
      </section>
    </main>
  );
}
