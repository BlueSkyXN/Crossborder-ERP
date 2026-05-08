import { DotLoading, Empty, ErrorBlock } from "antd-mobile";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";

import {
  fetchPurchaseOrders,
  fetchPurchaseWallet,
  fetchPurchaseWalletTransactions,
  payPurchaseOrder,
} from "../features/purchases/api";
import type { PurchaseOrder, PurchaseOrderStatus } from "../features/purchases/types";
import { PurchasePaymentModal } from "./PurchasePaymentModal";
import styles from "./PurchaseMobile.module.css";

type StatusFilter = "ALL" | PurchaseOrderStatus;

const statusMeta: Record<PurchaseOrderStatus, { label: string; tone: string }> = {
  PENDING_PAYMENT: { label: "待付款", tone: "dangerTone" },
  PENDING_REVIEW: { label: "待审核", tone: "warningTone" },
  PENDING_PROCUREMENT: { label: "待采购", tone: "infoTone" },
  PROCURED: { label: "已采购", tone: "primaryTone" },
  ARRIVED: { label: "已到货", tone: "primaryTone" },
  COMPLETED: { label: "已完成", tone: "successTone" },
  CANCELLED: { label: "已取消", tone: "mutedTone" },
  EXCEPTION: { label: "异常单", tone: "dangerTone" },
};

const filters: Array<{ label: string; value: StatusFilter }> = [
  { label: "全部", value: "ALL" },
  { label: "待付款", value: "PENDING_PAYMENT" },
  { label: "待审核", value: "PENDING_REVIEW" },
  { label: "待采购", value: "PENDING_PROCUREMENT" },
  { label: "已完成", value: "COMPLETED" },
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

function initialOrderId() {
  const orderId = Number(new URLSearchParams(window.location.search).get("order_id"));
  return orderId || null;
}

function StatusPill({ status }: { status: PurchaseOrderStatus }) {
  const meta = statusMeta[status];
  return <span className={`${styles.statusPill} ${styles[meta.tone]}`}>{meta.label}</span>;
}

export function PurchaseOrdersPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("ALL");
  const [selectedOrderId, setSelectedOrderId] = useState<number | null>(initialOrderId);
  const [payOrderId, setPayOrderId] = useState<number | null>(null);
  const [notice, setNotice] = useState("");

  const ordersQuery = useQuery({
    queryKey: ["mobile", "member", "purchase-orders"],
    queryFn: fetchPurchaseOrders,
  });
  const walletQuery = useQuery({
    queryKey: ["mobile", "member", "purchase-wallet"],
    queryFn: fetchPurchaseWallet,
  });
  const walletTransactionsQuery = useQuery({
    queryKey: ["mobile", "member", "purchase-wallet-transactions"],
    queryFn: fetchPurchaseWalletTransactions,
  });

  const orders = useMemo(() => ordersQuery.data ?? [], [ordersQuery.data]);
  const filteredOrders = useMemo(
    () => orders.filter((order) => statusFilter === "ALL" || order.status === statusFilter),
    [orders, statusFilter],
  );
  const selectedOrder = useMemo(
    () => orders.find((order) => order.id === selectedOrderId) ?? filteredOrders[0] ?? null,
    [filteredOrders, orders, selectedOrderId],
  );
  const paymentOrder = useMemo(() => orders.find((order) => order.id === payOrderId) ?? null, [orders, payOrderId]);

  const showNotice = (message: string) => {
    setNotice(message);
    window.setTimeout(() => setNotice(""), 2400);
  };

  const invalidatePurchaseData = () => {
    queryClient.invalidateQueries({ queryKey: ["mobile", "member", "purchase-orders"] });
    queryClient.invalidateQueries({ queryKey: ["mobile", "member", "purchase-wallet"] });
    queryClient.invalidateQueries({ queryKey: ["mobile", "member", "purchase-wallet-transactions"] });
    queryClient.invalidateQueries({ queryKey: ["mobile", "member", "parcels"] });
  };

  const payMutation = useMutation({
    mutationFn: ({ orderId, idempotencyKey }: { orderId: number; idempotencyKey: string }) =>
      payPurchaseOrder(orderId, { idempotency_key: idempotencyKey }),
    onSuccess: (result) => {
      queryClient.setQueryData<PurchaseOrder[]>(["mobile", "member", "purchase-orders"], (current = []) =>
        current.map((order) => (order.id === result.purchase_order.id ? result.purchase_order : order)),
      );
      queryClient.setQueryData(["mobile", "member", "purchase-wallet"], result.wallet);
      invalidatePurchaseData();
      setSelectedOrderId(result.purchase_order.id);
      setPayOrderId(null);
      showNotice(result.already_paid ? "该代购单已完成支付" : `${result.purchase_order.order_no} 已支付`);
    },
  });

  return (
    <main className={styles.page}>
      <header className={styles.top}>
        <button type="button" onClick={() => navigate("/me")}>
          我的
        </button>
        <div>
          <span>Purchase</span>
          <h1>代购订单</h1>
        </div>
        <button type="button" onClick={() => queryClient.invalidateQueries()}>
          刷新
        </button>
      </header>

      <section className={styles.summary}>
        <div>
          <span>待付款</span>
          <strong>{orders.filter((order) => order.status === "PENDING_PAYMENT").length}</strong>
        </div>
        <div>
          <span>处理中</span>
          <strong>{orders.filter((order) => ["PENDING_REVIEW", "PENDING_PROCUREMENT", "PROCURED", "ARRIVED"].includes(order.status)).length}</strong>
        </div>
        <div>
          <span>已完成</span>
          <strong>{orders.filter((order) => order.status === "COMPLETED").length}</strong>
        </div>
      </section>

      {notice && <div className={styles.notice}>{notice}</div>}
      {payMutation.isError && <div className={styles.error}>{payMutation.error instanceof Error ? payMutation.error.message : "支付失败"}</div>}

      <div className={styles.heroActions}>
        <button className={styles.primaryButton} type="button" onClick={() => navigate("/home")}>
          继续选购
        </button>
        <button className={styles.secondaryButton} type="button" onClick={() => navigate("/me/purchases/manual")}>
          手工代购
        </button>
      </div>

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

      {ordersQuery.isLoading && (
        <div className={styles.loading}>
          <DotLoading />
          <span>加载代购订单</span>
        </div>
      )}
      {ordersQuery.isError && <ErrorBlock status="default" title="代购订单加载失败" description="请刷新后重试" />}
      {!ordersQuery.isLoading && !ordersQuery.isError && filteredOrders.length === 0 && <Empty description="暂无代购订单" />}

      {!ordersQuery.isLoading && !ordersQuery.isError && filteredOrders.length > 0 && (
        <section className={styles.orderList}>
          {filteredOrders.map((order) => (
            <button
              key={order.id}
              type="button"
              className={`${styles.orderCard} ${selectedOrder?.id === order.id ? styles.selected : ""}`}
              onClick={() => setSelectedOrderId(order.id)}
            >
              <div className={styles.orderMeta}>
                <div>
                  <strong>{order.order_no}</strong>
                  <span>{order.source_type === "PRODUCT" ? "自营商品" : "手工代购"} / {order.items.length} 件</span>
                </div>
                <StatusPill status={order.status} />
              </div>
              <em>{formatMoney(order.total_amount)}</em>
            </button>
          ))}
        </section>
      )}

      {selectedOrder && (
        <section className={styles.detail}>
          <div className={styles.detailHead}>
            <div>
              <span>订单详情</span>
              <h2>{selectedOrder.order_no}</h2>
            </div>
            <StatusPill status={selectedOrder.status} />
          </div>
          <dl className={styles.detailGrid}>
            <div>
              <dt>类型</dt>
              <dd>{selectedOrder.source_type === "PRODUCT" ? "自营商品" : "手工代购"}</dd>
            </div>
            <div>
              <dt>应付</dt>
              <dd>{formatMoney(selectedOrder.total_amount)}</dd>
            </div>
            <div>
              <dt>服务费</dt>
              <dd>{formatMoney(selectedOrder.service_fee)}</dd>
            </div>
            <div>
              <dt>支付时间</dt>
              <dd>{formatDate(selectedOrder.paid_at)}</dd>
            </div>
          </dl>
          <ul className={styles.items}>
            {selectedOrder.items.map((item) => (
              <li key={item.id}>
                <strong>{item.name}</strong>
                <span>{item.sku_code || item.product_url || "手工填写"}</span>
                <small>
                  x{item.quantity} / {formatMoney(item.actual_price || item.unit_price)}
                </small>
              </li>
            ))}
          </ul>
          {selectedOrder.procurement_task && (
            <dl className={styles.detailGrid}>
              <div>
                <dt>外部订单</dt>
                <dd>{selectedOrder.procurement_task.external_order_no || "-"}</dd>
              </div>
              <div>
                <dt>国内单号</dt>
                <dd>{selectedOrder.procurement_task.tracking_no || "-"}</dd>
              </div>
            </dl>
          )}
          {selectedOrder.converted_parcel && (
            <div className={styles.convertedParcel}>
              <strong>{selectedOrder.converted_parcel.parcel_no}</strong>
              <span>已转为 {selectedOrder.converted_parcel.warehouse_name} 在库包裹，可进入集运打包。</span>
              <button className={styles.primaryButton} type="button" onClick={() => navigate("/ship/parcels")}>
                查看包裹
              </button>
            </div>
          )}
          {selectedOrder.status === "PENDING_PAYMENT" && (
            <div className={styles.fixedAction}>
              <button className={styles.primaryButton} type="button" onClick={() => setPayOrderId(selectedOrder.id)}>
                余额支付
              </button>
            </div>
          )}
        </section>
      )}

      {paymentOrder && (
        <PurchasePaymentModal
          order={paymentOrder}
          wallet={walletQuery.data}
          transactions={walletTransactionsQuery.data ?? []}
          isPending={payMutation.isPending}
          onClose={() => setPayOrderId(null)}
          onConfirm={() =>
            payMutation.mutate({
              orderId: paymentOrder.id,
              idempotencyKey: `mobile-purchase-${paymentOrder.id}-${Date.now()}`,
            })
          }
        />
      )}
    </main>
  );
}
