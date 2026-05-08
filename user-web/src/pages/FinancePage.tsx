import {
  ArrowLeftOutlined,
  FileTextOutlined,
  ReloadOutlined,
  UploadOutlined,
  WalletOutlined,
} from "@ant-design/icons";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { FormEvent, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";

import {
  createOfflineRemittance,
  fetchFinanceTransactions,
  fetchFinanceWallet,
  fetchRemittances,
  uploadRemittanceProof,
} from "../features/finance/api";
import type { RechargeRequest, RemittanceStatus, WalletTransaction } from "../features/finance/types";
import styles from "./FinancePage.module.css";

type RemittanceFilter = "ALL" | RemittanceStatus;

const filterOptions: Array<{ label: string; value: RemittanceFilter }> = [
  { label: "全部", value: "ALL" },
  { label: "待审核", value: "PENDING" },
  { label: "已入账", value: "COMPLETED" },
  { label: "已取消", value: "CANCELLED" },
];

const statusMeta: Record<RemittanceStatus, { label: string; tone: string }> = {
  PENDING: { label: "待审核", tone: "pending" },
  COMPLETED: { label: "已入账", tone: "completed" },
  CANCELLED: { label: "已取消", tone: "cancelled" },
};

const transactionTypeText: Record<string, string> = {
  ADMIN_RECHARGE: "后台充值",
  ADMIN_DEDUCT: "后台扣减",
  OFFLINE_REMITTANCE: "线下汇款",
  WAYBILL_PAYMENT: "运费支付",
  PURCHASE_PAYMENT: "代购支付",
  REFUND: "退款",
  ADJUSTMENT: "余额调整",
};

function formatDate(value?: string | null) {
  if (!value) {
    return "-";
  }
  return new Date(value).toLocaleString("zh-CN", { hour12: false });
}

function formatMoney(value?: string | number | null, currency = "CNY") {
  const normalized = typeof value === "number" ? value.toFixed(2) : value || "0.00";
  return `${currency} ${normalized}`;
}

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : "";
}

function statusBadge(status: RemittanceStatus) {
  const meta = statusMeta[status];
  return <span className={`${styles.statusBadge} ${styles[meta.tone]}`}>{meta.label}</span>;
}

function transactionName(transaction: WalletTransaction) {
  return transactionTypeText[transaction.type] || transaction.type;
}

export function FinancePage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [amount, setAmount] = useState("");
  const [remark, setRemark] = useState("");
  const [proofFile, setProofFile] = useState<File | null>(null);
  const [filter, setFilter] = useState<RemittanceFilter>("ALL");
  const [keyword, setKeyword] = useState("");
  const [notice, setNotice] = useState("");

  const walletQuery = useQuery({
    queryKey: ["member", "finance-wallet"],
    queryFn: fetchFinanceWallet,
  });
  const transactionsQuery = useQuery({
    queryKey: ["member", "finance-transactions"],
    queryFn: fetchFinanceTransactions,
  });
  const remittancesQuery = useQuery({
    queryKey: ["member", "remittances"],
    queryFn: fetchRemittances,
  });

  const remittances = useMemo(() => remittancesQuery.data ?? [], [remittancesQuery.data]);
  const transactions = useMemo(() => transactionsQuery.data ?? [], [transactionsQuery.data]);
  const filteredRemittances = useMemo(() => {
    const normalized = keyword.trim().toLowerCase();
    return remittances.filter((remittance) => {
      const matchesStatus = filter === "ALL" || remittance.status === filter;
      const matchesKeyword =
        !normalized ||
        [
          remittance.request_no,
          remittance.proof_file_id,
          remittance.proof_file_name,
          remittance.remark,
          remittance.review_remark,
        ]
          .join(" ")
          .toLowerCase()
          .includes(normalized);
      return matchesStatus && matchesKeyword;
    });
  }, [filter, keyword, remittances]);

  const pendingRemittances = remittances.filter((item) => item.status === "PENDING");
  const pendingAmount = pendingRemittances.reduce((total, item) => total + Number(item.amount || 0), 0);
  const completedAmount = remittances
    .filter((item) => item.status === "COMPLETED")
    .reduce((total, item) => total + Number(item.amount || 0), 0);

  const showNotice = (message: string) => {
    setNotice(message);
    window.setTimeout(() => setNotice(""), 2600);
  };

  const invalidateFinance = () => {
    queryClient.invalidateQueries({ queryKey: ["member", "finance-wallet"] });
    queryClient.invalidateQueries({ queryKey: ["member", "finance-transactions"] });
    queryClient.invalidateQueries({ queryKey: ["member", "remittances"] });
    queryClient.invalidateQueries({ queryKey: ["member", "wallet"] });
    queryClient.invalidateQueries({ queryKey: ["member", "wallet-transactions"] });
  };

  const submitMutation = useMutation({
    mutationFn: async () => {
      const numericAmount = Number(amount);
      if (!Number.isFinite(numericAmount) || numericAmount <= 0) {
        throw new Error("请输入大于 0 的汇款金额");
      }
      if (!proofFile) {
        throw new Error("请上传汇款凭证");
      }
      const uploaded = await uploadRemittanceProof(proofFile);
      return createOfflineRemittance({
        amount: numericAmount.toFixed(2),
        currency: "CNY",
        proof_file_id: uploaded.file_id,
        remark: remark.trim(),
      });
    },
    onSuccess: (remittance) => {
      invalidateFinance();
      setAmount("");
      setRemark("");
      setProofFile(null);
      showNotice(`${remittance.request_no} 已提交，等待财务审核。`);
    },
  });

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    submitMutation.mutate();
  };

  const error = [
    walletQuery.error,
    transactionsQuery.error,
    remittancesQuery.error,
    submitMutation.error,
  ].find((item) => item instanceof Error);
  const isLoading = walletQuery.isLoading || transactionsQuery.isLoading || remittancesQuery.isLoading;

  return (
    <main className={styles.page}>
      <header className={styles.header}>
        <button className={styles.backButton} type="button" onClick={() => navigate("/dashboard")}>
          <ArrowLeftOutlined />
          控制台
        </button>
        <div className={styles.brand}>
          <div className={styles.logo}>CB</div>
          <div>
            <strong>财务中心</strong>
            <span>线下汇款、余额和钱包流水</span>
          </div>
        </div>
        <button className={styles.iconButton} type="button" aria-label="刷新财务数据" onClick={invalidateFinance}>
          <ReloadOutlined />
        </button>
      </header>

      {notice && <div className={styles.notice}>{notice}</div>}
      {error && <div className={styles.alert}>{getErrorMessage(error) || "财务数据加载失败"}</div>}

      <section className={styles.summary}>
        <article className={styles.metric}>
          <span>账户余额</span>
          <strong>{formatMoney(walletQuery.data?.balance, walletQuery.data?.currency || "CNY")}</strong>
        </article>
        <article className={styles.metric}>
          <span>待审核汇款</span>
          <strong>{pendingRemittances.length}</strong>
        </article>
        <article className={styles.metric}>
          <span>待审核金额</span>
          <strong>{formatMoney(pendingAmount)}</strong>
        </article>
        <article className={styles.metric}>
          <span>已入账金额</span>
          <strong>{formatMoney(completedAmount)}</strong>
        </article>
      </section>

      <section className={styles.workspace}>
        <form className={styles.formPanel} onSubmit={handleSubmit}>
          <div className={styles.sectionTitle}>
            <div>
              <h1>提交线下汇款</h1>
              <p>财务审核通过后自动入账到余额。</p>
            </div>
            <UploadOutlined />
          </div>
          <label>
            <span>汇款金额 CNY</span>
            <input
              required
              min="0.01"
              step="0.01"
              type="number"
              value={amount}
              onChange={(event) => setAmount(event.target.value)}
            />
          </label>
          <label>
            <span>汇款凭证</span>
            <input
              key={proofFile?.name || "empty-proof"}
              required
              type="file"
              accept="image/*,application/pdf"
              onChange={(event) => setProofFile(event.target.files?.[0] ?? null)}
            />
          </label>
          <label>
            <span>备注</span>
            <textarea
              value={remark}
              onChange={(event) => setRemark(event.target.value)}
              placeholder="银行流水号、转账账号尾号或其他说明"
            />
          </label>
          <button className={styles.primaryButton} type="submit" disabled={submitMutation.isPending}>
            <UploadOutlined />
            {submitMutation.isPending ? "提交中" : "提交汇款单"}
          </button>
        </form>

        <div className={styles.listPanel}>
          <div className={styles.listHead}>
            <div>
              <h2>汇款记录</h2>
              <p>{filteredRemittances.length} 条记录</p>
            </div>
            <WalletOutlined />
          </div>

          <div className={styles.filterBar}>
            <input
              value={keyword}
              onChange={(event) => setKeyword(event.target.value)}
              placeholder="搜索单号、凭证或备注"
            />
            {filterOptions.map((option) => (
              <button
                key={option.value}
                className={filter === option.value ? styles.activeFilter : ""}
                type="button"
                onClick={() => setFilter(option.value)}
              >
                {option.label}
              </button>
            ))}
          </div>

          {isLoading && <div className={styles.loading}>加载财务数据...</div>}
          {!isLoading && filteredRemittances.length === 0 && <div className={styles.empty}>暂无汇款记录</div>}
          {!isLoading && filteredRemittances.length > 0 && (
            <div className={styles.records}>
              {filteredRemittances.map((remittance) => (
                <RemittanceCard key={remittance.id} remittance={remittance} />
              ))}
            </div>
          )}

          <div className={styles.listHead} style={{ marginTop: 20 }}>
            <div>
              <h2>钱包流水</h2>
              <p>最近 {Math.min(transactions.length, 6)} 条</p>
            </div>
            <FileTextOutlined />
          </div>
          {transactions.length === 0 ? (
            <div className={styles.empty}>暂无钱包流水</div>
          ) : (
            <div className={styles.transactions}>
              {transactions.slice(0, 6).map((transaction) => (
                <article className={styles.transactionCard} key={transaction.id}>
                  <div className={styles.transactionLine}>
                    <div>
                      <strong>{transactionName(transaction)}</strong>
                      <span>{formatDate(transaction.created_at)}</span>
                    </div>
                    <strong>
                      {transaction.direction === "INCREASE" ? "+" : "-"}
                      {formatMoney(transaction.amount)}
                    </strong>
                  </div>
                  <div className={styles.transactionLine}>
                    <span>{transaction.remark || transaction.business_type || "-"}</span>
                    <span>余额 {formatMoney(transaction.balance_after)}</span>
                  </div>
                </article>
              ))}
            </div>
          )}
        </div>
      </section>
    </main>
  );
}

function RemittanceCard({ remittance }: { remittance: RechargeRequest }) {
  return (
    <article className={styles.recordCard}>
      <div className={styles.recordHead}>
        <div>
          <strong>{remittance.request_no}</strong>
          <span>{formatDate(remittance.created_at)}</span>
        </div>
        <div className={styles.recordAmount}>{formatMoney(remittance.amount, remittance.currency)}</div>
      </div>
      <div className={styles.recordMeta}>
        {statusBadge(remittance.status)}
        <span> 凭证 {remittance.proof_file_name || remittance.proof_file_id}</span>
      </div>
      {(remittance.remark || remittance.review_remark) && (
        <p className={styles.recordMeta}>{remittance.review_remark || remittance.remark}</p>
      )}
      {remittance.proof_download_url && (
        <a className={styles.proofButton} href={remittance.proof_download_url} target="_blank" rel="noreferrer">
          <FileTextOutlined />
          查看凭证
        </a>
      )}
    </article>
  );
}
