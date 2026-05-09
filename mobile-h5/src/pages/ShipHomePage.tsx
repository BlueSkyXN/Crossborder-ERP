import { DotLoading, Empty, ErrorBlock, Tabs } from "antd-mobile";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";

import { fetchMe } from "../features/auth/api";
import { useAuthStore } from "../features/auth/store";
import { fetchWarehouseAddress, fetchWarehouses } from "../features/warehouses/api";
import styles from "./ShipHomePage.module.css";

type ShipMode = "consolidation" | "direct";

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

export function ShipHomePage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const persistedUser = useAuthStore((state) => state.user);
  const setUser = useAuthStore((state) => state.setUser);
  const logout = useAuthStore((state) => state.logout);
  const [mode, setMode] = useState<ShipMode>("consolidation");
  const [selectedWarehouseId, setSelectedWarehouseId] = useState<number | null>(null);
  const [copyState, setCopyState] = useState<"idle" | "copied" | "failed">("idle");

  const meQuery = useQuery({
    queryKey: ["mobile", "member", "me"],
    queryFn: fetchMe,
  });
  const warehousesQuery = useQuery({
    queryKey: ["mobile", "member", "warehouses"],
    queryFn: fetchWarehouses,
  });

  const warehouses = useMemo(() => warehousesQuery.data ?? [], [warehousesQuery.data]);
  const effectiveWarehouseId = selectedWarehouseId ?? warehouses[0]?.id ?? null;
  const activeWarehouse = useMemo(
    () => warehouses.find((warehouse) => warehouse.id === effectiveWarehouseId),
    [effectiveWarehouseId, warehouses],
  );
  const addressQuery = useQuery({
    queryKey: ["mobile", "member", "warehouse-address", activeWarehouse?.id],
    queryFn: () => fetchWarehouseAddress(Number(activeWarehouse?.id)),
    enabled: Boolean(activeWarehouse?.id),
  });

  useEffect(() => {
    if (meQuery.data && meQuery.data.id !== persistedUser?.id) {
      setUser(meQuery.data);
    }
  }, [meQuery.data, persistedUser?.id, setUser]);

  const handleCopy = useCallback(() => {
    const fullAddress = addressQuery.data?.full_address;
    if (!fullAddress) {
      return;
    }
    setCopyState("copied");
    window.setTimeout(() => setCopyState("idle"), 8000);
    window.setTimeout(() => {
      try {
        if (!copyWithTextarea(fullAddress)) {
          void navigator.clipboard?.writeText(fullAddress);
        }
      } catch {
        // 浏览器权限策略可能阻止剪贴板写入，页面反馈仍保留。
      }
    }, 0);
  }, [addressQuery.data?.full_address]);

  const handleLogout = () => {
    logout();
    queryClient.clear();
  };

  const user = meQuery.data ?? persistedUser;
  const isLoading = meQuery.isLoading || warehousesQuery.isLoading || addressQuery.isLoading;
  const hasError = meQuery.isError || warehousesQuery.isError || addressQuery.isError;

  return (
    <main className={styles.page}>
      <header className={styles.top}>
        <div>
          <span>寄件</span>
          <h1>{user?.profile?.display_name || "会员"}</h1>
        </div>
        <button type="button" onClick={handleLogout}>
          退出
        </button>
      </header>

      <section className={styles.memberCard}>
        <div>
          <span>会员号</span>
          <strong>{user?.profile?.member_no || "-"}</strong>
        </div>
        <div>
          <span>仓库标识</span>
          <strong>{user?.profile?.warehouse_code || "-"}</strong>
        </div>
      </section>

      <section className={styles.card}>
        <Tabs
          activeKey={mode}
          onChange={(key) => setMode(key as ShipMode)}
          className={styles.modeTabs}
        >
          <Tabs.Tab title="集运" key="consolidation" />
          <Tabs.Tab title="直邮" key="direct" />
        </Tabs>

        {warehouses.length > 0 && (
          <Tabs
            activeKey={String(effectiveWarehouseId)}
            onChange={(key) => setSelectedWarehouseId(Number(key))}
            className={styles.warehouseTabs}
          >
            {warehouses.map((warehouse) => (
              <Tabs.Tab title={warehouse.name} key={String(warehouse.id)} />
            ))}
          </Tabs>
        )}

        {isLoading && (
          <div className={styles.loading}>
            <DotLoading />
            <span>加载仓库地址</span>
          </div>
        )}

        {!isLoading && hasError && (
          <ErrorBlock
            status="default"
            title="数据加载失败"
            description="请刷新后重试"
          />
        )}

        {!isLoading && !hasError && warehouses.length === 0 && (
          <Empty description="暂无可用仓库地址" />
        )}

        {!isLoading && !hasError && addressQuery.data && (
          <div className={styles.address}>
            <div className={styles.addressHead}>
              <div>
                <span>{mode === "consolidation" ? "集运仓" : "直邮仓"}</span>
                <h2>{addressQuery.data.warehouse_name}</h2>
              </div>
              <strong>{addressQuery.data.warehouse_code}</strong>
            </div>

            <dl className={styles.fields}>
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
              <div>
                <dt>标识</dt>
                <dd>{addressQuery.data.member_warehouse_code}</dd>
              </div>
            </dl>

            <div className={styles.fullAddress}>{addressQuery.data.full_address}</div>
            <button type="button" className={styles.copyButton} onClick={handleCopy}>
              {copyState === "copied" ? "已复制" : copyState === "failed" ? "复制失败" : "复制地址"}
            </button>
          </div>
        )}
      </section>

      <section className={styles.flow}>
        <h2>寄件流程</h2>
        <ol>
          <li>复制仓库地址</li>
          <li>发布包裹预报</li>
          <li>到仓后申请打包</li>
        </ol>
        <div className={styles.flowLinks}>
          <button type="button" onClick={() => navigate("/ship/parcels")}>
            我的包裹
          </button>
          <button type="button" onClick={() => navigate("/ship/unclaimed-parcels")}>
            无主认领
          </button>
          <button type="button" onClick={() => navigate("/ship/waybills")}>
            我的运单
          </button>
        </div>
      </section>

      <div className={styles.actionBar}>
        <button type="button" className={styles.secondary} onClick={() => navigate("/ship/packing")}>
          申请打包
        </button>
        <button type="button" className={styles.primary} onClick={() => navigate("/ship/forecast")}>
          发布预报
        </button>
      </div>
    </main>
  );
}
