import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { FormEvent, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";

import {
  createManualPurchaseOrder,
  fetchPurchaseOrders,
  fetchPurchaseWallet,
  fetchPurchaseWalletTransactions,
  payPurchaseOrder,
} from "../features/purchases/api";
import type { ManualPurchaseOrderCreatePayload, PurchaseOrder } from "../features/purchases/types";
import { PurchasePaymentModal } from "./PurchasePaymentModal";
import styles from "./PurchaseMobile.module.css";

type ManualLine = {
  id: number;
  name: string;
  product_url: string;
  unit_price: string;
  quantity: string;
  remark: string;
};

function manualLine(id: number): ManualLine {
  return {
    id,
    name: "",
    product_url: "",
    unit_price: "0.00",
    quantity: "1",
    remark: "",
  };
}

function buildPayload(lines: ManualLine[], serviceFee: string): ManualPurchaseOrderCreatePayload {
  return {
    service_fee: serviceFee || "0.00",
    items: lines
      .filter((line) => line.name.trim())
      .map((line) => ({
        name: line.name.trim(),
        product_url: line.product_url.trim(),
        unit_price: line.unit_price || "0.00",
        quantity: Number(line.quantity || 1),
        remark: line.remark.trim(),
      })),
  };
}

function formatMoney(value?: string | null, currency = "CNY") {
  return `${currency} ${value || "0.00"}`;
}

function sumManualItems(lines: ManualLine[]) {
  return lines.reduce((total, line) => total + Number(line.unit_price || 0) * Number(line.quantity || 0), 0);
}

export function ManualPurchasePage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [lines, setLines] = useState<ManualLine[]>(() => [manualLine(Date.now())]);
  const [serviceFee, setServiceFee] = useState("0.00");
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
  const paymentOrder = useMemo(() => orders.find((order) => order.id === payOrderId) ?? null, [orders, payOrderId]);
  const subtotal = sumManualItems(lines);
  const total = subtotal + Number(serviceFee || 0);

  const showNotice = (message: string) => {
    setNotice(message);
    window.setTimeout(() => setNotice(""), 2400);
  };

  const invalidatePurchaseData = () => {
    queryClient.invalidateQueries({ queryKey: ["mobile", "member", "purchase-orders"] });
    queryClient.invalidateQueries({ queryKey: ["mobile", "member", "purchase-wallet"] });
    queryClient.invalidateQueries({ queryKey: ["mobile", "member", "purchase-wallet-transactions"] });
  };

  const createMutation = useMutation({
    mutationFn: createManualPurchaseOrder,
    onSuccess: (order) => {
      queryClient.setQueryData<PurchaseOrder[]>(["mobile", "member", "purchase-orders"], (current = []) => [
        order,
        ...current.filter((item) => item.id !== order.id),
      ]);
      invalidatePurchaseData();
      setLines([manualLine(Date.now())]);
      setServiceFee("0.00");
      setPayOrderId(order.status === "PENDING_PAYMENT" ? order.id : null);
      showNotice(`${order.order_no} 已提交，请完成余额支付`);
    },
  });
  const payMutation = useMutation({
    mutationFn: ({ orderId, idempotencyKey }: { orderId: number; idempotencyKey: string }) =>
      payPurchaseOrder(orderId, { idempotency_key: idempotencyKey }),
    onSuccess: (result) => {
      queryClient.setQueryData<PurchaseOrder[]>(["mobile", "member", "purchase-orders"], (current = []) =>
        current.map((order) => (order.id === result.purchase_order.id ? result.purchase_order : order)),
      );
      queryClient.setQueryData(["mobile", "member", "purchase-wallet"], result.wallet);
      invalidatePurchaseData();
      setPayOrderId(null);
      navigate(`/me/purchases?order_id=${result.purchase_order.id}`, { replace: true });
    },
  });

  const updateLine = (id: number, patch: Partial<ManualLine>) => {
    setLines((current) => current.map((line) => (line.id === id ? { ...line, ...patch } : line)));
  };

  const removeLine = (id: number) => {
    setLines((current) => (current.length <= 1 ? current : current.filter((line) => line.id !== id)));
  };

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const payload = buildPayload(lines, serviceFee);
    if (payload.items.length === 0) {
      showNotice("至少填写一个代购商品");
      return;
    }
    createMutation.mutate(payload);
  };

  return (
    <main className={styles.page}>
      <header className={styles.top}>
        <button type="button" onClick={() => navigate("/me")}>
          我的
        </button>
        <div>
          <span>Manual</span>
          <h1>手工代购</h1>
        </div>
        <button type="button" onClick={() => navigate("/me/purchases")}>
          订单
        </button>
      </header>

      <section className={styles.hero}>
        <h2>填写无法自动解析的商品</h2>
        <p>移动端只做最小录入，商品链接、名称、单价和数量提交后生成待付款代购单。</p>
      </section>

      {notice && <div className={styles.notice}>{notice}</div>}
      {createMutation.isError && (
        <div className={styles.error}>{createMutation.error instanceof Error ? createMutation.error.message : "提交失败"}</div>
      )}
      {payMutation.isError && <div className={styles.error}>{payMutation.error instanceof Error ? payMutation.error.message : "支付失败"}</div>}

      <form className={styles.form} onSubmit={handleSubmit}>
        <div className={styles.manualList}>
          {lines.map((line, index) => (
            <article key={line.id} className={styles.manualLine}>
              <div className={styles.lineTitle}>
                <strong>商品 {index + 1}</strong>
                <button type="button" disabled={lines.length <= 1} onClick={() => removeLine(line.id)}>
                  -
                </button>
              </div>
              <label>
                <span>商品名称</span>
                <input
                  required
                  value={line.name}
                  placeholder="手工代购商品"
                  onChange={(event) => updateLine(line.id, { name: event.target.value })}
                />
              </label>
              <label>
                <span>商品链接</span>
                <input
                  value={line.product_url}
                  placeholder="https://..."
                  onChange={(event) => updateLine(line.id, { product_url: event.target.value })}
                />
              </label>
              <div className={styles.formRow}>
                <label>
                  <span>单价</span>
                  <input
                    required
                    type="number"
                    min={0}
                    step="0.01"
                    value={line.unit_price}
                    onChange={(event) => updateLine(line.id, { unit_price: event.target.value })}
                  />
                </label>
                <label>
                  <span>数量</span>
                  <input
                    required
                    type="number"
                    min={1}
                    value={line.quantity}
                    onChange={(event) => updateLine(line.id, { quantity: event.target.value })}
                  />
                </label>
              </div>
              <label>
                <span>备注</span>
                <textarea rows={2} value={line.remark} onChange={(event) => updateLine(line.id, { remark: event.target.value })} />
              </label>
            </article>
          ))}
        </div>

        <button className={styles.secondaryButton} type="button" onClick={() => setLines((current) => [...current, manualLine(Date.now())])}>
          新增商品行
        </button>

        <section className={styles.panel}>
          <div className={styles.sectionHead}>
            <span>Confirm</span>
            <h2>确认代购单</h2>
          </div>
          <dl className={styles.totalList}>
            <div>
              <dt>商品金额</dt>
              <dd>{formatMoney(subtotal.toFixed(2))}</dd>
            </div>
            <div>
              <dt>服务费</dt>
              <dd>
                <input
                  type="number"
                  min={0}
                  step="0.01"
                  value={serviceFee}
                  onChange={(event) => setServiceFee(event.target.value)}
                />
              </dd>
            </div>
            <div>
              <dt>应付合计</dt>
              <dd>{formatMoney(total.toFixed(2))}</dd>
            </div>
          </dl>
        </section>

        <div className={styles.fixedAction}>
          <button className={styles.primaryButton} type="submit" disabled={createMutation.isPending}>
            {createMutation.isPending ? "提交中" : "提交手工代购"}
          </button>
        </div>
      </form>

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
