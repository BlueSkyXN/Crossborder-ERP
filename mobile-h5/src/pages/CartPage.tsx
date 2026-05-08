import { DotLoading, Empty, ErrorBlock } from "antd-mobile";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { FormEvent, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";

import {
  createPurchaseOrder,
  deleteCartItem,
  fetchCartItems,
  fetchPurchaseOrders,
  fetchPurchaseWallet,
  fetchPurchaseWalletTransactions,
  payPurchaseOrder,
  updateCartItem,
} from "../features/purchases/api";
import type { CartItem, PurchaseOrder } from "../features/purchases/types";
import { PurchasePaymentModal } from "./PurchasePaymentModal";
import styles from "./PurchaseMobile.module.css";

function formatMoney(value?: string | null, currency = "CNY") {
  return `${currency} ${value || "0.00"}`;
}

function formatSpec(spec: Record<string, unknown>) {
  const entries = Object.entries(spec);
  if (entries.length === 0) {
    return "默认规格";
  }
  return entries.map(([key, value]) => `${key}: ${String(value)}`).join(" / ");
}

function sumCartItems(items: CartItem[]) {
  return items.reduce((total, item) => total + Number(item.sku_price || 0) * item.quantity, 0);
}

export function CartPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [selectedCartItemIds, setSelectedCartItemIds] = useState<number[] | null>(null);
  const [serviceFee, setServiceFee] = useState("0.00");
  const [payOrderId, setPayOrderId] = useState<number | null>(null);
  const [notice, setNotice] = useState("");

  const cartQuery = useQuery({
    queryKey: ["mobile", "member", "cart-items"],
    queryFn: fetchCartItems,
  });
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

  const cartItems = useMemo(() => cartQuery.data ?? [], [cartQuery.data]);
  const orders = useMemo(() => ordersQuery.data ?? [], [ordersQuery.data]);
  const effectiveSelectedCartItemIds = useMemo(
    () => selectedCartItemIds ?? cartItems.map((item) => item.id),
    [cartItems, selectedCartItemIds],
  );
  const selectedCartItems = useMemo(
    () => cartItems.filter((item) => effectiveSelectedCartItemIds.includes(item.id)),
    [cartItems, effectiveSelectedCartItemIds],
  );
  const paymentOrder = useMemo(() => orders.find((order) => order.id === payOrderId) ?? null, [orders, payOrderId]);
  const subtotal = sumCartItems(selectedCartItems);
  const total = subtotal + Number(serviceFee || 0);

  const showNotice = (message: string) => {
    setNotice(message);
    window.setTimeout(() => setNotice(""), 2400);
  };

  const invalidatePurchaseData = () => {
    queryClient.invalidateQueries({ queryKey: ["mobile", "member", "cart-items"] });
    queryClient.invalidateQueries({ queryKey: ["mobile", "member", "purchase-orders"] });
    queryClient.invalidateQueries({ queryKey: ["mobile", "member", "purchase-wallet"] });
    queryClient.invalidateQueries({ queryKey: ["mobile", "member", "purchase-wallet-transactions"] });
  };

  const updateMutation = useMutation({
    mutationFn: ({ cartItemId, quantity }: { cartItemId: number; quantity: number }) =>
      updateCartItem(cartItemId, { quantity }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["mobile", "member", "cart-items"] });
    },
  });
  const deleteMutation = useMutation({
    mutationFn: deleteCartItem,
    onSuccess: (_result, cartItemId) => {
      setSelectedCartItemIds((current) => (current === null ? current : current.filter((id) => id !== cartItemId)));
      queryClient.invalidateQueries({ queryKey: ["mobile", "member", "cart-items"] });
      showNotice("购物车商品已删除");
    },
  });
  const createMutation = useMutation({
    mutationFn: createPurchaseOrder,
    onSuccess: (order) => {
      queryClient.setQueryData<PurchaseOrder[]>(["mobile", "member", "purchase-orders"], (current = []) => [
        order,
        ...current.filter((item) => item.id !== order.id),
      ]);
      invalidatePurchaseData();
      setPayOrderId(order.status === "PENDING_PAYMENT" ? order.id : null);
      setServiceFee("0.00");
      showNotice(`${order.order_no} 已生成，请完成余额支付`);
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

  const toggleCartItem = (cartItem: CartItem) => {
    setSelectedCartItemIds((current) => {
      const baseSelection = current ?? cartItems.map((item) => item.id);
      return baseSelection.includes(cartItem.id)
        ? baseSelection.filter((id) => id !== cartItem.id)
        : [...baseSelection, cartItem.id];
    });
  };

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (selectedCartItems.length === 0) {
      showNotice("请选择至少一个购物车商品");
      return;
    }
    createMutation.mutate({
      cart_item_ids: selectedCartItems.map((item) => item.id),
      service_fee: serviceFee || "0.00",
    });
  };

  const hasError = cartQuery.isError || createMutation.isError || updateMutation.isError || deleteMutation.isError || payMutation.isError;
  const firstError = [cartQuery.error, createMutation.error, updateMutation.error, deleteMutation.error, payMutation.error].find(
    (error) => error instanceof Error,
  );

  return (
    <main className={styles.page}>
      <header className={styles.top}>
        <button type="button" onClick={() => navigate("/home")}>
          商品
        </button>
        <div>
          <span>Cart</span>
          <h1>购物车</h1>
        </div>
        <button type="button" onClick={() => navigate("/me/purchases")}>
          订单
        </button>
      </header>

      {notice && <div className={styles.notice}>{notice}</div>}
      {hasError && <div className={styles.error}>{firstError instanceof Error ? firstError.message : "操作失败"}</div>}

      {cartQuery.isLoading && (
        <div className={styles.loading}>
          <DotLoading />
          <span>加载购物车</span>
        </div>
      )}
      {cartQuery.isError && <ErrorBlock status="default" title="购物车加载失败" description="请刷新后重试" />}
      {!cartQuery.isLoading && !cartQuery.isError && cartItems.length === 0 && <Empty description="购物车暂无商品" />}

      {!cartQuery.isLoading && !cartQuery.isError && cartItems.length > 0 && (
        <section className={styles.cartList}>
          {cartItems.map((item) => (
            <article key={item.id} className={`${styles.cartCard} ${effectiveSelectedCartItemIds.includes(item.id) ? styles.selected : ""}`}>
              <input
                type="checkbox"
                checked={effectiveSelectedCartItemIds.includes(item.id)}
                onChange={() => toggleCartItem(item)}
                aria-label={`选择 ${item.product_title}`}
              />
              <div>
                <strong>{item.product_title}</strong>
                <span>{item.sku_code} / {formatSpec(item.sku_spec_json)}</span>
                <div className={styles.cartMeta}>
                  <div className={styles.quantity}>
                    <button
                      type="button"
                      disabled={item.quantity <= 1 || updateMutation.isPending}
                      onClick={() => updateMutation.mutate({ cartItemId: item.id, quantity: item.quantity - 1 })}
                    >
                      -
                    </button>
                    <strong>{item.quantity}</strong>
                    <button
                      type="button"
                      disabled={updateMutation.isPending}
                      onClick={() => updateMutation.mutate({ cartItemId: item.id, quantity: item.quantity + 1 })}
                    >
                      +
                    </button>
                  </div>
                  <strong className={styles.cartTotal}>{formatMoney(item.line_amount)}</strong>
                </div>
                <button
                  className={styles.dangerButton}
                  type="button"
                  disabled={deleteMutation.isPending}
                  onClick={() => deleteMutation.mutate(item.id)}
                >
                  删除
                </button>
              </div>
            </article>
          ))}
        </section>
      )}

      <form className={styles.panel} onSubmit={handleSubmit}>
        <div className={styles.sectionHead}>
          <span>Confirm</span>
          <h2>确认订单</h2>
          <p>勾选商品后提交代购单，付款后进入后台审核采购。</p>
        </div>
        <dl className={styles.totalList}>
          <div>
            <dt>已选商品</dt>
            <dd>{selectedCartItems.length} 件</dd>
          </div>
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
        <div className={styles.fixedAction}>
          <button className={styles.primaryButton} type="submit" disabled={createMutation.isPending}>
            {createMutation.isPending ? "提交中" : "提交代购订单"}
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
