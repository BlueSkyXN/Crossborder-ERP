import { ArrowLeftOutlined, ReloadOutlined } from "@ant-design/icons";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo } from "react";
import { useNavigate } from "react-router-dom";

import { fetchGrowthOverview, fetchPointLedgers } from "./api";
import type { PointLedger } from "./types";
import styles from "./GrowthPages.module.css";

const pointTypeText: Record<string, string> = {
  REFERRAL_REWARD: "邀请奖励",
  REBATE_REWARD: "返利奖励",
  MANUAL_ADJUSTMENT: "人工调整",
  CONSUME: "积分消费",
};

function formatDate(value?: string | null) {
  return value ? new Date(value).toLocaleString("zh-CN", { hour12: false }) : "-";
}

function directionMeta(direction: PointLedger["direction"]) {
  return direction === "INCREASE"
    ? { label: "增加", tone: "increase", prefix: "+" }
    : { label: "扣减", tone: "decrease", prefix: "-" };
}

export function PointsPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const overviewQuery = useQuery({
    queryKey: ["member", "growth-summary"],
    queryFn: fetchGrowthOverview,
  });
  const ledgersQuery = useQuery({
    queryKey: ["member", "growth-point-ledgers"],
    queryFn: fetchPointLedgers,
  });

  const ledgers = useMemo(() => ledgersQuery.data ?? [], [ledgersQuery.data]);
  const totalIncrease = ledgers
    .filter((ledger) => ledger.direction === "INCREASE")
    .reduce((total, ledger) => total + Number(ledger.points || 0), 0);
  const totalDecrease = ledgers
    .filter((ledger) => ledger.direction === "DECREASE")
    .reduce((total, ledger) => total + Number(ledger.points || 0), 0);

  return (
    <main className={styles.page}>
      <header className={styles.header}>
        <div className={styles.brand}>
          <div className={styles.logo}>CB</div>
          <div>
            <strong>积分明细</strong>
            <span>Points Ledger</span>
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

      {(overviewQuery.isError || ledgersQuery.isError) && (
        <div className={styles.alert}>积分数据加载失败，请刷新或稍后再试。</div>
      )}

      <section className={styles.summary}>
        <article className={styles.metric}>
          <span>当前积分</span>
          <strong>{overviewQuery.data?.points_balance ?? 0}</strong>
        </article>
        <article className={styles.metric}>
          <span>累计增加</span>
          <strong>{totalIncrease}</strong>
        </article>
        <article className={styles.metric}>
          <span>累计扣减</span>
          <strong>{totalDecrease}</strong>
        </article>
        <article className={styles.metric}>
          <span>积分规则</span>
          <strong>{overviewQuery.data?.points_rule_note || "以平台规则为准"}</strong>
        </article>
      </section>

      <section className={styles.workspace}>
        <aside className={styles.panel}>
          <div className={styles.sectionTitle}>
            <div>
              <h1>积分账户</h1>
              <p>积分可用于平台活动和会员权益，具体抵扣规则以后续配置为准。</p>
            </div>
          </div>
        </aside>
        <section className={styles.panel}>
          <div className={styles.sectionTitle}>
            <div>
              <h2>积分流水</h2>
              <p>展示积分增加、扣减及对应业务说明。</p>
            </div>
          </div>
          <div className={styles.records}>
            {ledgers.map((ledger) => {
              const meta = directionMeta(ledger.direction);
              return (
                <article className={styles.recordCard} key={ledger.id}>
                  <div className={styles.recordHead}>
                    <strong>{pointTypeText[ledger.type] || ledger.type}</strong>
                    <span className={`${styles.statusBadge} ${styles[meta.tone]}`}>
                      {meta.label} {meta.prefix}
                      {ledger.points}
                    </span>
                  </div>
                  <p className={styles.recordMeta}>
                    余额 {ledger.balance_after} · {ledger.business_type || "无关联业务"} #{ledger.business_id || "-"} ·{" "}
                    {formatDate(ledger.created_at)}
                  </p>
                  {ledger.remark && <p className={styles.recordMeta}>备注：{ledger.remark}</p>}
                </article>
              );
            })}
            {!ledgers.length && <div className={styles.empty}>暂无积分流水</div>}
          </div>
        </section>
      </section>
    </main>
  );
}
