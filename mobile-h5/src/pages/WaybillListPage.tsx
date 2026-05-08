import { DotLoading, Empty, ErrorBlock } from "antd-mobile";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";

import {
  confirmWaybillReceipt,
  fetchTrackingEvents,
  fetchWallet,
  fetchWalletTransactions,
  fetchWaybills,
  payWaybill,
} from "../features/waybills/api";
import type { TrackingEvent, Waybill, WaybillStatus } from "../features/waybills/types";
import styles from "./WaybillListPage.module.css";

type StatusFilter = "ALL" | WaybillStatus;

const statusMeta: Record<WaybillStatus, { label: string; tone: string }> = {
  PENDING_REVIEW: { label: "待审核", tone: "warning" },
  PENDING_PACKING: { label: "待打包", tone: "info" },
  PENDING_PAYMENT: { label: "待付款", tone: "danger" },
  PENDING_SHIPMENT: { label: "待发货", tone: "primary" },
  SHIPPED: { label: "已发货", tone: "primary" },
  SIGNED: { label: "已签收", tone: "success" },
  CANCELLED: { label: "已取消", tone: "muted" },
  PROBLEM: { label: "问题单", tone: "danger" },
};

const filters: Array<{ label: string; value: StatusFilter }> = [
  { label: "全部", value: "ALL" },
  { label: "待审核", value: "PENDING_REVIEW" },
  { label: "待付款", value: "PENDING_PAYMENT" },
  { label: "待发货", value: "PENDING_SHIPMENT" },
  { label: "已发货", value: "SHIPPED" },
  { label: "已签收", value: "SIGNED" },
];

function formatDate(value?: string | null) {
  if (!value) {
    return "-";
  }
  return new Date(value).toLocaleString("zh-CN", { hour12: false });
}

function formatMoney(value?: string | null, currency = "CNY") {
  return `${currency} ${value || "0.00"}`;
}

function formatWeight(value?: string | null) {
  return value ? `${value} kg` : "-";
}

function compareMoney(left: string, right: string) {
  return Number(left || 0) - Number(right || 0);
}

function snapshotValue(snapshot: Record<string, unknown>, key: string) {
  const value = snapshot[key];
  return value === undefined || value === null || value === "" ? "-" : String(value);
}

function trackingSource(source: TrackingEvent["source"]) {
  if (source === "MEMBER") {
    return "会员";
  }
  if (source === "SYSTEM") {
    return "系统";
  }
  return "人工";
}

function initialWaybillId() {
  const waybillId = Number(new URLSearchParams(window.location.search).get("waybill_id"));
  return waybillId || null;
}

function StatusPill({ status }: { status: WaybillStatus }) {
  const meta = statusMeta[status];
  return <span className={`${styles.statusPill} ${styles[meta.tone]}`}>{meta.label}</span>;
}

export function WaybillListPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("ALL");
  const [selectedWaybillId, setSelectedWaybillId] = useState<number | null>(initialWaybillId);
  const [payWaybillId, setPayWaybillId] = useState<number | null>(null);
  const [notice, setNotice] = useState("");

  const waybillsQuery = useQuery({
    queryKey: ["mobile", "member", "waybills"],
    queryFn: fetchWaybills,
  });
  const walletQuery = useQuery({
    queryKey: ["mobile", "member", "wallet"],
    queryFn: fetchWallet,
  });
  const walletTransactionsQuery = useQuery({
    queryKey: ["mobile", "member", "wallet-transactions"],
    queryFn: fetchWalletTransactions,
  });

  const waybills = useMemo(() => waybillsQuery.data ?? [], [waybillsQuery.data]);
  const filteredWaybills = useMemo(
    () => waybills.filter((waybill) => statusFilter === "ALL" || waybill.status === statusFilter),
    [statusFilter, waybills],
  );
  const selectedWaybill = useMemo(
    () => waybills.find((waybill) => waybill.id === selectedWaybillId) ?? filteredWaybills[0] ?? null,
    [filteredWaybills, selectedWaybillId, waybills],
  );
  const paymentWaybill = useMemo(
    () => waybills.find((waybill) => waybill.id === payWaybillId) ?? null,
    [payWaybillId, waybills],
  );
  const trackingQuery = useQuery({
    queryKey: ["mobile", "member", "tracking-events", selectedWaybill?.id],
    queryFn: () => fetchTrackingEvents(Number(selectedWaybill?.id)),
    enabled: Boolean(selectedWaybill?.id),
  });

  const showNotice = (message: string) => {
    setNotice(message);
    window.setTimeout(() => setNotice(""), 2400);
  };

  const invalidateWaybillData = () => {
    queryClient.invalidateQueries({ queryKey: ["mobile", "member", "waybills"] });
    queryClient.invalidateQueries({ queryKey: ["mobile", "member", "wallet"] });
    queryClient.invalidateQueries({ queryKey: ["mobile", "member", "wallet-transactions"] });
  };

  const payMutation = useMutation({
    mutationFn: ({ waybillId, idempotencyKey }: { waybillId: number; idempotencyKey: string }) =>
      payWaybill(waybillId, { idempotency_key: idempotencyKey }),
    onSuccess: (result) => {
      queryClient.setQueryData(["mobile", "member", "wallet"], result.wallet);
      queryClient.setQueryData<Waybill[]>(["mobile", "member", "waybills"], (current = []) =>
        current.map((waybill) => (waybill.id === result.waybill.id ? result.waybill : waybill)),
      );
      invalidateWaybillData();
      setSelectedWaybillId(result.waybill.id);
      setPayWaybillId(null);
      showNotice(result.already_paid ? "该运单已完成支付" : `${result.waybill.waybill_no} 已支付`);
    },
  });

  const confirmMutation = useMutation({
    mutationFn: (waybillId: number) => confirmWaybillReceipt(waybillId, "用户在移动 H5 确认收货"),
    onSuccess: (waybill) => {
      queryClient.setQueryData<Waybill[]>(["mobile", "member", "waybills"], (current = []) =>
        current.map((item) => (item.id === waybill.id ? waybill : item)),
      );
      queryClient.invalidateQueries({ queryKey: ["mobile", "member", "tracking-events", waybill.id] });
      queryClient.invalidateQueries({ queryKey: ["mobile", "member", "waybills"] });
      setSelectedWaybillId(waybill.id);
      showNotice(`${waybill.waybill_no} 已确认收货`);
    },
  });

  const allErrors = [
    waybillsQuery.error,
    walletQuery.error,
    walletTransactionsQuery.error,
    payMutation.error,
    confirmMutation.error,
  ];
  const hasError =
    waybillsQuery.isError ||
    walletQuery.isError ||
    walletTransactionsQuery.isError ||
    payMutation.isError ||
    confirmMutation.isError;
  const errorMessage = allErrors.find((error) => error instanceof Error)?.message || "数据加载失败，请刷新后重试";
  const trackingEvents = trackingQuery.data ?? selectedWaybill?.tracking_events ?? [];
  const walletTransactions = walletTransactionsQuery.data ?? [];
  const canPay =
    paymentWaybill && walletQuery.data
      ? compareMoney(walletQuery.data.balance, paymentWaybill.fee_total) >= 0
      : false;

  return (
    <main className={styles.page}>
      <header className={styles.top}>
        <button type="button" onClick={() => navigate("/ship")}>
          返回
        </button>
        <div>
          <span>Waybill</span>
          <h1>我的运单</h1>
        </div>
        <button type="button" onClick={() => queryClient.invalidateQueries()}>
          刷新
        </button>
      </header>

      <section className={styles.summary}>
        <div>
          <span>待付款</span>
          <strong>{waybills.filter((waybill) => waybill.status === "PENDING_PAYMENT").length}</strong>
        </div>
        <div>
          <span>运输中</span>
          <strong>{waybills.filter((waybill) => waybill.status === "SHIPPED").length}</strong>
        </div>
        <div>
          <span>余额</span>
          <strong>{formatMoney(walletQuery.data?.balance || "0.00", walletQuery.data?.currency || "CNY")}</strong>
        </div>
      </section>

      {notice && <div className={styles.notice}>{notice}</div>}
      {hasError && <div className={styles.error}>{errorMessage}</div>}

      <div className={styles.filters}>
        {filters.map((filter) => (
          <button
            key={filter.value}
            type="button"
            className={filter.value === statusFilter ? styles.activeFilter : ""}
            onClick={() => setStatusFilter(filter.value)}
          >
            {filter.label}
          </button>
        ))}
      </div>

      {waybillsQuery.isLoading && (
        <div className={styles.loading}>
          <DotLoading />
          <span>加载运单</span>
        </div>
      )}

      {waybillsQuery.isError && (
        <ErrorBlock status="default" title="运单加载失败" description="请刷新后重试" />
      )}

      {!waybillsQuery.isLoading && !waybillsQuery.isError && filteredWaybills.length === 0 && (
        <Empty description="暂无运单" />
      )}

      {!waybillsQuery.isLoading && !waybillsQuery.isError && filteredWaybills.length > 0 && (
        <section className={styles.list}>
          {filteredWaybills.map((waybill) => (
            <button
              key={waybill.id}
              type="button"
              className={`${styles.waybillCard} ${selectedWaybill?.id === waybill.id ? styles.selected : ""}`}
              onClick={() => setSelectedWaybillId(waybill.id)}
            >
              <div>
                <strong>{waybill.waybill_no}</strong>
                <span>{waybill.parcels.map((parcel) => parcel.parcel_no).join(" / ")}</span>
              </div>
              <StatusPill status={waybill.status} />
              <small>{waybill.warehouse_name}</small>
              <em>{formatMoney(waybill.fee_total)}</em>
            </button>
          ))}
        </section>
      )}

      {selectedWaybill && (
        <section className={styles.detail}>
          <div className={styles.detailHead}>
            <div>
              <span>运单详情</span>
              <h2>{selectedWaybill.waybill_no}</h2>
            </div>
            <StatusPill status={selectedWaybill.status} />
          </div>

          <dl className={styles.detailGrid}>
            <div>
              <dt>费用</dt>
              <dd>{formatMoney(selectedWaybill.fee_total)}</dd>
            </div>
            <div>
              <dt>仓库</dt>
              <dd>{selectedWaybill.warehouse_name}</dd>
            </div>
            <div>
              <dt>收件人</dt>
              <dd>{snapshotValue(selectedWaybill.recipient_snapshot, "name")}</dd>
            </div>
            <div>
              <dt>电话</dt>
              <dd>{snapshotValue(selectedWaybill.recipient_snapshot, "phone")}</dd>
            </div>
            <div className={styles.wide}>
              <dt>地址</dt>
              <dd>{snapshotValue(selectedWaybill.recipient_snapshot, "address")}</dd>
            </div>
          </dl>

          <div className={styles.block}>
            <h3>包裹</h3>
            <ul className={styles.parcels}>
              {selectedWaybill.parcels.map((parcel) => (
                <li key={parcel.id}>
                  <span>{parcel.parcel_no}</span>
                  <strong>{parcel.tracking_no}</strong>
                  <small>{formatWeight(parcel.weight_kg)}</small>
                </li>
              ))}
            </ul>
          </div>

          <div className={styles.block}>
            <h3>物流轨迹</h3>
            {trackingQuery.isLoading && <p>加载轨迹...</p>}
            {!trackingQuery.isLoading && trackingEvents.length === 0 && <p>暂无物流轨迹</p>}
            {trackingEvents.length > 0 && (
              <ol className={styles.timeline}>
                {trackingEvents.map((event) => (
                  <li key={event.id}>
                    <i />
                    <div>
                      <strong>{event.status_text}</strong>
                      <span>{`${formatDate(event.event_time)} / ${event.location || "-"} / ${trackingSource(event.source)}`}</span>
                      {event.description && <p>{event.description}</p>}
                    </div>
                  </li>
                ))}
              </ol>
            )}
          </div>

          {(selectedWaybill.status === "PENDING_PAYMENT" || selectedWaybill.status === "SHIPPED") && (
            <div className={styles.actionBar}>
              {selectedWaybill.status === "PENDING_PAYMENT" && (
                <button type="button" onClick={() => setPayWaybillId(selectedWaybill.id)}>
                  余额支付
                </button>
              )}
              {selectedWaybill.status === "SHIPPED" && (
                <button
                  type="button"
                  disabled={confirmMutation.isPending}
                  onClick={() => confirmMutation.mutate(selectedWaybill.id)}
                >
                  {confirmMutation.isPending ? "确认中" : "确认收货"}
                </button>
              )}
            </div>
          )}
        </section>
      )}

      {paymentWaybill && (
        <div className={styles.modalOverlay} role="presentation">
          <div className={styles.paymentModal} role="dialog" aria-modal="true" aria-labelledby="mobile-pay-title">
            <header>
              <span>余额支付</span>
              <h2 id="mobile-pay-title">{paymentWaybill.waybill_no}</h2>
            </header>
            <dl className={styles.paymentSummary}>
              <div>
                <dt>应付金额</dt>
                <dd>{formatMoney(paymentWaybill.fee_total)}</dd>
              </div>
              <div>
                <dt>当前余额</dt>
                <dd>{formatMoney(walletQuery.data?.balance || "0.00", walletQuery.data?.currency || "CNY")}</dd>
              </div>
            </dl>
            {!canPay && <div className={styles.inlineWarning}>余额不足，请等待后台充值后再支付。</div>}
            <div className={styles.walletHistory}>
              <h3>最近流水</h3>
              {walletTransactions.length === 0 ? (
                <p>暂无钱包流水</p>
              ) : (
                walletTransactions.slice(0, 3).map((transaction) => (
                  <div key={transaction.id}>
                    <span>{transaction.type}</span>
                    <strong>{transaction.direction === "INCREASE" ? "+" : "-"}{transaction.amount}</strong>
                  </div>
                ))
              )}
            </div>
            <div className={styles.modalActions}>
              <button type="button" onClick={() => setPayWaybillId(null)}>
                取消
              </button>
              <button
                type="button"
                disabled={!canPay || payMutation.isPending}
                onClick={() =>
                  payMutation.mutate({
                    waybillId: paymentWaybill.id,
                    idempotencyKey: `mobile-waybill-${paymentWaybill.id}-${Date.now()}`,
                  })
                }
              >
                {payMutation.isPending ? "支付中" : "确认支付"}
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
