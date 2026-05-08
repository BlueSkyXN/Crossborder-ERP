import { DotLoading, ErrorBlock } from "antd-mobile";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";

import { fetchMe } from "../features/auth/api";
import { useAuthStore } from "../features/auth/store";
import { fetchPurchaseOrders, fetchPurchaseWallet } from "../features/purchases/api";
import styles from "./PurchaseMobile.module.css";

function formatMoney(value?: string | null, currency = "CNY") {
  return `${currency} ${value || "0.00"}`;
}

export function MePage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const persistedUser = useAuthStore((state) => state.user);
  const setUser = useAuthStore((state) => state.setUser);
  const logout = useAuthStore((state) => state.logout);

  const meQuery = useQuery({
    queryKey: ["mobile", "member", "me"],
    queryFn: fetchMe,
  });
  const ordersQuery = useQuery({
    queryKey: ["mobile", "member", "purchase-orders"],
    queryFn: fetchPurchaseOrders,
  });
  const walletQuery = useQuery({
    queryKey: ["mobile", "member", "purchase-wallet"],
    queryFn: fetchPurchaseWallet,
  });

  useEffect(() => {
    if (meQuery.data && meQuery.data.id !== persistedUser?.id) {
      setUser(meQuery.data);
    }
  }, [meQuery.data, persistedUser?.id, setUser]);

  const user = meQuery.data ?? persistedUser;
  const orders = useMemo(() => ordersQuery.data ?? [], [ordersQuery.data]);
  const pendingPaymentCount = orders.filter((order) => order.status === "PENDING_PAYMENT").length;
  const activeCount = orders.filter((order) =>
    ["PENDING_REVIEW", "PENDING_PROCUREMENT", "PROCURED", "ARRIVED"].includes(order.status),
  ).length;

  const handleLogout = () => {
    logout();
    queryClient.clear();
  };

  return (
    <main className={styles.page}>
      <header className={styles.top}>
        <button type="button" onClick={() => navigate("/ship")}>
          寄件
        </button>
        <div>
          <span>Member</span>
          <h1>我的</h1>
        </div>
        <button type="button" onClick={handleLogout}>
          退出
        </button>
      </header>

      {meQuery.isLoading && (
        <div className={styles.loading}>
          <DotLoading />
          <span>加载会员资料</span>
        </div>
      )}
      {meQuery.isError && <ErrorBlock status="default" title="会员资料加载失败" description="请刷新后重试" />}

      <section className={styles.memberCard}>
        <div className={styles.sectionHead}>
          <span>{user?.profile?.member_no || "Member"}</span>
          <h2>{user?.profile?.display_name || user?.email || "会员"}</h2>
          <p>{user?.profile?.warehouse_code || "-"}</p>
        </div>
        <div className={styles.quickGrid}>
          <div className={styles.metric}>
            <span>账户余额</span>
            <strong>{formatMoney(walletQuery.data?.balance || "0.00", walletQuery.data?.currency || "CNY")}</strong>
          </div>
          <div className={styles.metric}>
            <span>待付款</span>
            <strong>{pendingPaymentCount}</strong>
          </div>
          <div className={styles.metric}>
            <span>处理中</span>
            <strong>{activeCount}</strong>
          </div>
          <div className={styles.metric}>
            <span>代购订单</span>
            <strong>{orders.length}</strong>
          </div>
        </div>
      </section>

      <section className={styles.panel}>
        <div className={styles.sectionHead}>
          <span>Purchase</span>
          <h2>我的代购</h2>
          <p>从这里进入代购订单、手工代购和商品选购。</p>
        </div>
        <div className={styles.quickGrid}>
          <button className={styles.primaryButton} type="button" onClick={() => navigate("/me/purchases")}>
            代购订单
          </button>
          <button className={styles.secondaryButton} type="button" onClick={() => navigate("/me/purchases/manual")}>
            手工代购
          </button>
          <button className={styles.secondaryButton} type="button" onClick={() => navigate("/home")}>
            商品首页
          </button>
          <button className={styles.secondaryButton} type="button" onClick={() => navigate("/cart")}>
            购物车
          </button>
        </div>
      </section>

      <section className={styles.panel}>
        <div className={styles.sectionHead}>
          <span>Parcel</span>
          <h2>集运入口</h2>
        </div>
        <div className={styles.quickGrid}>
          <button className={styles.secondaryButton} type="button" onClick={() => navigate("/ship/parcels")}>
            我的包裹
          </button>
          <button className={styles.secondaryButton} type="button" onClick={() => navigate("/ship/waybills")}>
            我的运单
          </button>
        </div>
      </section>
    </main>
  );
}
