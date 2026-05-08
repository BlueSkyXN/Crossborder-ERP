import {
  CopyOutlined,
  HomeOutlined,
  InboxOutlined,
  PlusOutlined,
  LogoutOutlined,
  ReloadOutlined,
  ShoppingCartOutlined,
  TruckOutlined,
  WalletOutlined,
} from "@ant-design/icons";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";

import { fetchMe } from "../features/auth/api";
import { useAuthStore } from "../features/auth/store";
import { fetchPurchaseOrders } from "../features/purchases/api";
import { fetchWarehouseAddress, fetchWarehouses } from "../features/warehouses/api";
import { fetchWallet, fetchWaybills } from "../features/waybills/api";
import styles from "./DashboardPage.module.css";

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

function clipboardTimeout() {
  return new Promise<never>((_resolve, reject) => {
    window.setTimeout(() => reject(new Error("clipboard timeout")), 800);
  });
}

export function DashboardPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const logout = useAuthStore((state) => state.logout);
  const persistedUser = useAuthStore((state) => state.user);
  const setUser = useAuthStore((state) => state.setUser);
  const [selectedWarehouseId, setSelectedWarehouseId] = useState<number | null>(null);
  const [copyState, setCopyState] = useState<"idle" | "copied" | "failed">("idle");

  const meQuery = useQuery({
    queryKey: ["member", "me"],
    queryFn: fetchMe,
  });
  const warehousesQuery = useQuery({
    queryKey: ["member", "warehouses"],
    queryFn: fetchWarehouses,
  });
  const waybillsQuery = useQuery({
    queryKey: ["member", "waybills"],
    queryFn: fetchWaybills,
  });
  const purchaseOrdersQuery = useQuery({
    queryKey: ["member", "purchase-orders"],
    queryFn: fetchPurchaseOrders,
  });
  const walletQuery = useQuery({
    queryKey: ["member", "wallet"],
    queryFn: fetchWallet,
  });

  const warehouses = useMemo(() => warehousesQuery.data ?? [], [warehousesQuery.data]);
  const effectiveWarehouseId = selectedWarehouseId ?? warehouses[0]?.id ?? null;
  const activeWarehouse = useMemo(
    () => warehouses.find((warehouse) => warehouse.id === effectiveWarehouseId),
    [effectiveWarehouseId, warehouses],
  );
  const addressQuery = useQuery({
    queryKey: ["member", "warehouse-address", activeWarehouse?.id],
    queryFn: () => fetchWarehouseAddress(Number(activeWarehouse?.id)),
    enabled: Boolean(activeWarehouse?.id),
  });

  useEffect(() => {
    if (meQuery.data && meQuery.data.id !== persistedUser?.id) {
      setUser(meQuery.data);
    }
  }, [meQuery.data, persistedUser?.id, setUser]);

  const handleLogout = useCallback(() => {
    logout();
    queryClient.clear();
    navigate("/login", { replace: true });
  }, [logout, navigate, queryClient]);

  const handleCopy = () => {
    const fullAddress = addressQuery.data?.full_address;
    if (!fullAddress) {
      return;
    }
    setCopyState("copied");
    window.setTimeout(() => setCopyState("idle"), 1600);
    try {
      if (!copyWithTextarea(fullAddress)) {
        void Promise.race([navigator.clipboard.writeText(fullAddress), clipboardTimeout()]).catch(
          () => setCopyState("failed"),
        );
      }
    } catch {
      setCopyState("failed");
    }
  };

  const user = meQuery.data ?? persistedUser;
  const hasError =
    meQuery.isError ||
    warehousesQuery.isError ||
    addressQuery.isError ||
    waybillsQuery.isError ||
    purchaseOrdersQuery.isError ||
    walletQuery.isError;
  const isLoading = meQuery.isLoading || warehousesQuery.isLoading || addressQuery.isLoading;
  const waybills = waybillsQuery.data ?? [];
  const purchaseOrders = purchaseOrdersQuery.data ?? [];
  const pendingPaymentWaybills = waybills.filter((waybill) => waybill.status === "PENDING_PAYMENT");
  const pendingPaymentPurchases = purchaseOrders.filter((order) => order.status === "PENDING_PAYMENT");
  const statusEntries = [
    { label: "待预报包裹", value: 0, icon: <InboxOutlined /> },
    { label: "待打包运单", value: waybills.filter((waybill) => waybill.status === "PENDING_PACKING").length, icon: <TruckOutlined /> },
    {
      label: "待支付金额",
      value: `¥${(
        pendingPaymentWaybills.reduce((total, waybill) => total + Number(waybill.fee_total || 0), 0) +
        pendingPaymentPurchases.reduce((total, order) => total + Number(order.total_amount || 0), 0)
      ).toFixed(2)}`,
      icon: <WalletOutlined />,
    },
    { label: "代购订单", value: purchaseOrders.length, icon: <ShoppingCartOutlined /> },
  ];

  return (
    <main className={styles.page}>
      <header className={styles.header}>
        <div className={styles.brand}>
          <div className={styles.logo}>CB</div>
          <div>
            <strong>会员中心</strong>
            <span>CrossBorder ERP</span>
          </div>
          <div className={styles.quickActions}>
            <button type="button" onClick={() => navigate("/parcels")}>
              <PlusOutlined />
              包裹预报
            </button>
            <button type="button" onClick={() => navigate("/parcels")}>
              <InboxOutlined />
              包裹列表
            </button>
            <button type="button" onClick={() => navigate("/waybills")}>
              <TruckOutlined />
              运单中心
            </button>
            <button type="button" onClick={() => navigate("/addresses")}>
              <HomeOutlined />
              地址簿
            </button>
            <button type="button" onClick={() => navigate("/finance")}>
              <WalletOutlined />
              财务中心
            </button>
            <button type="button" onClick={() => navigate("/products")}>
              <ShoppingCartOutlined />
              商品代购
            </button>
          </div>
        </div>
        <div className={styles.headerActions}>
          <button
            className={styles.iconButton}
            type="button"
            aria-label="刷新数据"
            onClick={() => queryClient.invalidateQueries()}
          >
            <ReloadOutlined />
          </button>
          <button className={styles.accountButton} type="button" onClick={handleLogout}>
            <LogoutOutlined />
            <span>退出</span>
          </button>
        </div>
      </header>

      <section className={styles.hero}>
        <div>
          <p className={styles.eyebrow}>Member Workspace</p>
          <h1>{user?.profile?.display_name || user?.email || "会员"}</h1>
          <p>会员号 {user?.profile?.member_no || "-"} · 仓库标识 {user?.profile?.warehouse_code || "-"}</p>
        </div>
        <div className={styles.balanceCard}>
          <span>账户余额</span>
          <strong>¥{walletQuery.data?.balance || "0.00"}</strong>
        </div>
      </section>

      {hasError && (
        <div className={styles.alert}>
          数据加载失败，请刷新或稍后再试。
        </div>
      )}

      <section className={styles.grid}>
        <div className={styles.addressCard}>
          <div className={styles.sectionTitle}>
            <div>
              <h2>专属仓库地址</h2>
              <p>包裹预报和入库识别使用此地址。</p>
            </div>
            {warehouses.length > 1 && (
              <select
                value={activeWarehouse?.id}
                onChange={(event) => setSelectedWarehouseId(Number(event.target.value))}
              >
                {warehouses.map((warehouse) => (
                  <option key={warehouse.id} value={warehouse.id}>
                    {warehouse.name}
                  </option>
                ))}
              </select>
            )}
          </div>

          {isLoading && <div className={styles.skeleton}>加载仓库地址...</div>}
          {!isLoading && !activeWarehouse && (
            <div className={styles.empty}>暂无可用仓库地址</div>
          )}
          {!isLoading && addressQuery.data && (
            <div className={styles.addressBox}>
              <dl>
                <div>
                  <dt>仓库</dt>
                  <dd>{addressQuery.data.warehouse_name}</dd>
                </div>
                <div>
                  <dt>收件人</dt>
                  <dd>{addressQuery.data.receiver_name}</dd>
                </div>
                <div>
                  <dt>电话</dt>
                  <dd>{addressQuery.data.phone}</dd>
                </div>
                <div>
                  <dt>邮编</dt>
                  <dd>{addressQuery.data.postal_code || "-"}</dd>
                </div>
              </dl>
              <div className={styles.fullAddress}>{addressQuery.data.full_address}</div>
              <button className={styles.copyButton} type="button" onClick={handleCopy}>
                <CopyOutlined />
                {copyState === "copied" ? "已复制" : copyState === "failed" ? "复制失败" : "复制地址"}
              </button>
            </div>
          )}
        </div>

        <div className={styles.profileCard}>
          <div className={styles.sectionTitle}>
            <div>
              <h2>会员资料</h2>
              <p>基础身份和服务等级。</p>
            </div>
          </div>
          <ul className={styles.profileList}>
            <li>
              <span>邮箱</span>
              <strong>{user?.email || "-"}</strong>
            </li>
            <li>
              <span>手机</span>
              <strong>{user?.phone || "-"}</strong>
            </li>
            <li>
              <span>等级</span>
              <strong>{user?.profile?.level || "-"}</strong>
            </li>
            <li>
              <span>状态</span>
              <strong>{user?.status === "ACTIVE" ? "正常" : "冻结"}</strong>
            </li>
          </ul>
        </div>
      </section>

      <section className={styles.statusGrid}>
        {statusEntries.map((entry) => (
          <article key={entry.label} className={styles.statusCard}>
            <div className={styles.statusIcon}>{entry.icon}</div>
            <span>{entry.label}</span>
            <strong>{entry.value}</strong>
          </article>
        ))}
      </section>
    </main>
  );
}
