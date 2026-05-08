import { DotLoading, ErrorBlock } from "antd-mobile";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";

import {
  createRemittance,
  fetchFinanceWallet,
  fetchFinanceWalletTransactions,
  fetchRemittances,
} from "../features/finance/api";
import type { RemittanceStatus, WalletTransaction } from "../features/finance/types";
import { memberFilesApi } from "../features/files/api";
import styles from "./FinanceMobilePage.module.css";

const remittanceStatusMeta: Record<RemittanceStatus, { label: string; tone: string }> = {
  PENDING: { label: "待审核", tone: "pending" },
  COMPLETED: { label: "已入账", tone: "success" },
  CANCELLED: { label: "已取消", tone: "muted" },
};

function formatMoney(value?: string | null, currency = "CNY") {
  return `${currency} ${value || "0.00"}`;
}

function formatDate(value?: string | null) {
  if (!value) {
    return "-";
  }
  return new Date(value).toLocaleString("zh-CN", { hour12: false });
}

function statusBadge(status: RemittanceStatus) {
  const meta = remittanceStatusMeta[status];
  return <span className={`${styles.badge} ${styles[meta.tone]}`}>{meta.label}</span>;
}

function transactionLabel(transaction: WalletTransaction) {
  if (transaction.type === "OFFLINE_REMITTANCE") {
    return "线下汇款";
  }
  if (transaction.type === "WAYBILL_PAYMENT") {
    return "运费支付";
  }
  if (transaction.type === "PURCHASE_PAYMENT") {
    return "代购支付";
  }
  if (transaction.type === "ADMIN_RECHARGE") {
    return "后台充值";
  }
  return transaction.type;
}

export function FinanceMobilePage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [amount, setAmount] = useState("");
  const [remark, setRemark] = useState("");
  const [proofFile, setProofFile] = useState<File | null>(null);
  const [formError, setFormError] = useState("");

  const walletQuery = useQuery({
    queryKey: ["mobile", "member", "finance-wallet"],
    queryFn: fetchFinanceWallet,
  });
  const transactionsQuery = useQuery({
    queryKey: ["mobile", "member", "finance-wallet-transactions"],
    queryFn: fetchFinanceWalletTransactions,
  });
  const remittancesQuery = useQuery({
    queryKey: ["mobile", "member", "remittances"],
    queryFn: fetchRemittances,
  });

  const submitMutation = useMutation({
    mutationFn: async () => {
      const normalizedAmount = Number(amount);
      if (!Number.isFinite(normalizedAmount) || normalizedAmount <= 0) {
        throw new Error("金额必须大于 0");
      }
      if (!proofFile) {
        throw new Error("请上传汇款凭证");
      }
      const uploaded = await memberFilesApi.uploadFile(proofFile, "REMITTANCE_PROOF");
      return createRemittance({
        amount: normalizedAmount.toFixed(2),
        currency: "CNY",
        proof_file_id: uploaded.file_id,
        remark: remark.trim(),
      });
    },
    onSuccess: () => {
      setAmount("");
      setRemark("");
      setProofFile(null);
      setFormError("");
      queryClient.invalidateQueries({ queryKey: ["mobile", "member", "finance-wallet"] });
      queryClient.invalidateQueries({ queryKey: ["mobile", "member", "finance-wallet-transactions"] });
      queryClient.invalidateQueries({ queryKey: ["mobile", "member", "remittances"] });
      queryClient.invalidateQueries({ queryKey: ["mobile", "member", "purchase-wallet"] });
    },
    onError: (error) => setFormError(error instanceof Error ? error.message : "提交失败"),
  });

  const remittances = useMemo(() => remittancesQuery.data ?? [], [remittancesQuery.data]);
  const transactions = useMemo(() => transactionsQuery.data ?? [], [transactionsQuery.data]);
  const isLoading = walletQuery.isLoading || transactionsQuery.isLoading || remittancesQuery.isLoading;
  const hasError = walletQuery.isError || transactionsQuery.isError || remittancesQuery.isError;

  return (
    <main className={styles.page}>
      <header className={styles.top}>
        <button type="button" onClick={() => navigate("/me")}>
          我的
        </button>
        <div>
          <span>Finance</span>
          <h1>财务中心</h1>
        </div>
        <button
          type="button"
          onClick={() => {
            queryClient.invalidateQueries({ queryKey: ["mobile", "member", "finance-wallet"] });
            queryClient.invalidateQueries({ queryKey: ["mobile", "member", "finance-wallet-transactions"] });
            queryClient.invalidateQueries({ queryKey: ["mobile", "member", "remittances"] });
          }}
        >
          刷新
        </button>
      </header>

      {isLoading && (
        <div className={styles.loading}>
          <DotLoading />
          <span>加载财务数据</span>
        </div>
      )}
      {hasError && <ErrorBlock status="default" title="财务数据加载失败" description="请刷新后重试" />}

      <section className={styles.summary}>
        <div>
          <span>账户余额</span>
          <strong>{formatMoney(walletQuery.data?.balance, walletQuery.data?.currency)}</strong>
        </div>
        <div>
          <span>汇款记录</span>
          <strong>{remittances.length}</strong>
        </div>
        <div>
          <span>钱包流水</span>
          <strong>{transactions.length}</strong>
        </div>
      </section>

      <form
        className={styles.panel}
        onSubmit={(event) => {
          event.preventDefault();
          submitMutation.mutate();
        }}
      >
        <div className={styles.sectionHead}>
          <span>Remittance</span>
          <h2>提交线下汇款</h2>
          <p>凭证审核通过后，金额会进入钱包余额。</p>
        </div>
        {formError && <div className={styles.error}>{formError}</div>}
        <div className={styles.form}>
          <label>
            汇款金额
            <input
              type="number"
              min="0.01"
              step="0.01"
              value={amount}
              onChange={(event) => setAmount(event.target.value)}
              placeholder="0.00"
            />
          </label>
          <label>
            汇款凭证
            <input
              key={proofFile?.name || "empty-proof"}
              type="file"
              accept="image/jpeg,image/png,image/webp,image/gif,application/pdf"
              onChange={(event) => setProofFile(event.target.files?.[0] ?? null)}
            />
          </label>
          <label>
            备注
            <textarea
              rows={3}
              value={remark}
              onChange={(event) => setRemark(event.target.value)}
              placeholder="银行流水号或付款说明"
            />
          </label>
        </div>
        <button className={styles.primaryButton} type="submit" disabled={submitMutation.isPending}>
          {submitMutation.isPending ? "提交中..." : "提交汇款单"}
        </button>
      </form>

      <section className={styles.panel}>
        <div className={styles.sectionHead}>
          <span>History</span>
          <h2>汇款记录</h2>
        </div>
        {remittances.length === 0 ? (
          <div className={styles.empty}>暂无汇款记录</div>
        ) : (
          <div className={styles.list}>
            {remittances.map((item) => (
              <article key={item.id} className={styles.card}>
                <div className={styles.cardHead}>
                  <strong>{item.request_no}</strong>
                  {statusBadge(item.status)}
                </div>
                <dl>
                  <div>
                    <dt>金额</dt>
                    <dd>{formatMoney(item.amount, item.currency)}</dd>
                  </div>
                  <div>
                    <dt>凭证</dt>
                    <dd>{item.proof_file_name || item.proof_file_id}</dd>
                  </div>
                  <div>
                    <dt>时间</dt>
                    <dd>{formatDate(item.created_at)}</dd>
                  </div>
                </dl>
                {item.proof_download_url && (
                  <a className={styles.proofLink} href={item.proof_download_url} target="_blank" rel="noreferrer">
                    查看凭证
                  </a>
                )}
              </article>
            ))}
          </div>
        )}
      </section>

      <section className={styles.panel}>
        <div className={styles.sectionHead}>
          <span>Ledger</span>
          <h2>钱包流水</h2>
        </div>
        {transactions.length === 0 ? (
          <div className={styles.empty}>暂无钱包流水</div>
        ) : (
          <div className={styles.list}>
            {transactions.slice(0, 8).map((transaction) => (
              <article key={transaction.id} className={styles.card}>
                <div className={styles.cardHead}>
                  <strong>{transactionLabel(transaction)}</strong>
                  <span className={transaction.direction === "INCREASE" ? styles.increase : styles.decrease}>
                    {transaction.direction === "INCREASE" ? "+" : "-"}
                    {transaction.amount}
                  </span>
                </div>
                <p>{transaction.remark || transaction.business_type || "-"}</p>
                <small>{formatDate(transaction.created_at)} / 余额 {transaction.balance_after}</small>
              </article>
            ))}
          </div>
        )}
      </section>
    </main>
  );
}
