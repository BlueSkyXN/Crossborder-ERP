import {
  ArrowLeftOutlined,
  CheckCircleOutlined,
  ClockCircleOutlined,
  CreditCardOutlined,
  HomeOutlined,
  InboxOutlined,
  LogoutOutlined,
  ReloadOutlined,
  SendOutlined,
  WalletOutlined,
} from "@ant-design/icons";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { FormEvent, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";

import { fetchMe } from "../features/auth/api";
import { useAuthStore } from "../features/auth/store";
import { fetchAddresses } from "../features/addresses/api";
import type { Address } from "../features/addresses/types";
import { fetchPackableParcels } from "../features/parcels/api";
import type { Parcel } from "../features/parcels/types";
import {
  confirmWaybillReceipt,
  createWaybill,
  fetchTrackingEvents,
  fetchWallet,
  fetchWalletTransactions,
  fetchWaybills,
  payWaybill,
} from "../features/waybills/api";
import type { TrackingEvent, Waybill, WaybillCreatePayload, WaybillStatus } from "../features/waybills/types";
import styles from "./WaybillsPage.module.css";

type RecipientFormState = {
  destination_country: string;
  recipient_name: string;
  recipient_phone: string;
  recipient_address: string;
  postal_code: string;
  remark: string;
};

type StatusFilter = "ALL" | WaybillStatus;

const initialRecipientForm: RecipientFormState = {
  destination_country: "US",
  recipient_name: "",
  recipient_phone: "",
  recipient_address: "",
  postal_code: "",
  remark: "",
};

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

const statusFilters: Array<{ label: string; value: StatusFilter }> = [
  { label: "全部", value: "ALL" },
  { label: "待审核", value: "PENDING_REVIEW" },
  { label: "待付款", value: "PENDING_PAYMENT" },
  { label: "待发货", value: "PENDING_SHIPMENT" },
  { label: "已发货", value: "SHIPPED" },
  { label: "已签收", value: "SIGNED" },
];

const pageSize = 6;

function formatDate(value?: string | null) {
  if (!value) {
    return "-";
  }
  return new Date(value).toLocaleString("zh-CN", { hour12: false });
}

function formatMoney(value?: string | null, currency = "CNY") {
  if (!value) {
    return "-";
  }
  return `${currency} ${value}`;
}

function formatWeight(value?: string | null) {
  return value ? `${value} kg` : "-";
}

function snapshotValue(snapshot: Record<string, unknown>, key: string) {
  const value = snapshot[key];
  return value === undefined || value === null || value === "" ? "-" : String(value);
}

function statusBadge(status: WaybillStatus) {
  const meta = statusMeta[status];
  return <span className={`${styles.statusBadge} ${styles[meta.tone]}`}>{meta.label}</span>;
}

function buildWaybillPayload(
  form: RecipientFormState,
  parcelIds: number[],
  addressId: number | null,
): WaybillCreatePayload {
  if (addressId) {
    return {
      parcel_ids: parcelIds,
      address_id: addressId,
      remark: form.remark.trim(),
    };
  }

  return {
    parcel_ids: parcelIds,
    destination_country: form.destination_country.trim(),
    recipient_name: form.recipient_name.trim(),
    recipient_phone: form.recipient_phone.trim(),
    recipient_address: form.recipient_address.trim(),
    postal_code: form.postal_code.trim(),
    remark: form.remark.trim(),
  };
}

function addressToRecipientForm(address: Address, remark: string): RecipientFormState {
  return {
    destination_country: address.country,
    recipient_name: address.recipient_name,
    recipient_phone: address.phone,
    recipient_address: address.address_line,
    postal_code: address.postal_code,
    remark,
  };
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

function compareMoney(left: string, right: string) {
  return Number(left || 0) - Number(right || 0);
}

export function WaybillsPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const logout = useAuthStore((state) => state.logout);
  const persistedUser = useAuthStore((state) => state.user);
  const setUser = useAuthStore((state) => state.setUser);
  const [recipientForm, setRecipientForm] = useState<RecipientFormState>(initialRecipientForm);
  const [selectedAddressId, setSelectedAddressId] = useState<number | null>(null);
  const [selectedParcelIds, setSelectedParcelIds] = useState<number[]>(() => {
    const parcelId = Number(new URLSearchParams(window.location.search).get("parcel_id"));
    return parcelId ? [parcelId] : [];
  });
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("ALL");
  const [keyword, setKeyword] = useState("");
  const [page, setPage] = useState(1);
  const [selectedWaybillId, setSelectedWaybillId] = useState<number | null>(null);
  const [payWaybillId, setPayWaybillId] = useState<number | null>(null);
  const [notice, setNotice] = useState("");

  const meQuery = useQuery({
    queryKey: ["member", "me"],
    queryFn: fetchMe,
  });
  const packableQuery = useQuery({
    queryKey: ["member", "packable-parcels"],
    queryFn: fetchPackableParcels,
  });
  const waybillsQuery = useQuery({
    queryKey: ["member", "waybills"],
    queryFn: fetchWaybills,
  });
  const walletQuery = useQuery({
    queryKey: ["member", "wallet"],
    queryFn: fetchWallet,
  });
  const walletTransactionsQuery = useQuery({
    queryKey: ["member", "wallet-transactions"],
    queryFn: fetchWalletTransactions,
  });
  const addressesQuery = useQuery({
    queryKey: ["member", "addresses"],
    queryFn: fetchAddresses,
  });

  const packableParcels = useMemo(() => packableQuery.data ?? [], [packableQuery.data]);
  const waybills = useMemo(() => waybillsQuery.data ?? [], [waybillsQuery.data]);
  const addresses = useMemo(() => addressesQuery.data ?? [], [addressesQuery.data]);
  const selectedWaybill = useMemo(
    () => waybills.find((waybill) => waybill.id === selectedWaybillId) ?? waybills[0] ?? null,
    [selectedWaybillId, waybills],
  );
  const paymentWaybill = useMemo(
    () => waybills.find((waybill) => waybill.id === payWaybillId) ?? null,
    [payWaybillId, waybills],
  );
  const trackingQuery = useQuery({
    queryKey: ["member", "tracking-events", selectedWaybill?.id],
    queryFn: () => fetchTrackingEvents(Number(selectedWaybill?.id)),
    enabled: Boolean(selectedWaybill?.id),
  });

  useEffect(() => {
    if (meQuery.data && meQuery.data.id !== persistedUser?.id) {
      setUser(meQuery.data);
    }
  }, [meQuery.data, persistedUser?.id, setUser]);

  const filteredWaybills = useMemo(() => {
    const normalized = keyword.trim().toLowerCase();
    return waybills.filter((waybill) => {
      const matchesStatus = statusFilter === "ALL" || waybill.status === statusFilter;
      const matchesKeyword =
        !normalized ||
        [
          waybill.waybill_no,
          waybill.warehouse_name,
          waybill.channel_name,
          waybill.destination_country,
          waybill.parcels.map((parcel) => `${parcel.parcel_no} ${parcel.tracking_no}`).join(" "),
        ]
          .join(" ")
          .toLowerCase()
          .includes(normalized);
      return matchesStatus && matchesKeyword;
    });
  }, [keyword, statusFilter, waybills]);

  const totalPages = Math.max(1, Math.ceil(filteredWaybills.length / pageSize));
  const currentPage = Math.min(page, totalPages);
  const pagedWaybills = filteredWaybills.slice((currentPage - 1) * pageSize, currentPage * pageSize);
  const selectedParcels = packableParcels.filter((parcel) => selectedParcelIds.includes(parcel.id));
  const selectedWarehouseIds = new Set(selectedParcels.map((parcel) => parcel.warehouse));
  const selectedWarehouseNames = [...new Set(selectedParcels.map((parcel) => parcel.warehouse_name))];
  const selectedWeight = selectedParcels.reduce((total, parcel) => total + Number(parcel.weight_kg || 0), 0);
  const trackingEvents = trackingQuery.data ?? selectedWaybill?.tracking_events ?? [];
  const walletTransactions = walletTransactionsQuery.data ?? [];
  const user = meQuery.data ?? persistedUser;
  const clearNoticeLater = (message: string) => {
    setNotice(message);
    window.setTimeout(() => setNotice(""), 2600);
  };

  const invalidateWaybillData = () => {
    queryClient.invalidateQueries({ queryKey: ["member", "packable-parcels"] });
    queryClient.invalidateQueries({ queryKey: ["member", "parcels"] });
    queryClient.invalidateQueries({ queryKey: ["member", "waybills"] });
    queryClient.invalidateQueries({ queryKey: ["member", "wallet"] });
    queryClient.invalidateQueries({ queryKey: ["member", "wallet-transactions"] });
  };

  const createWaybillMutation = useMutation({
    mutationFn: createWaybill,
    onSuccess: (waybill) => {
      invalidateWaybillData();
      setSelectedWaybillId(waybill.id);
      setStatusFilter("ALL");
      setSelectedParcelIds([]);
      setPage(1);
      clearNoticeLater(`${waybill.waybill_no} 已提交，等待后台审核计费。`);
    },
  });

  const payMutation = useMutation({
    mutationFn: ({ waybillId, idempotencyKey }: { waybillId: number; idempotencyKey: string }) =>
      payWaybill(waybillId, { idempotency_key: idempotencyKey }),
    onSuccess: (result) => {
      queryClient.setQueryData<Waybill[]>(["member", "waybills"], (current = []) =>
        current.map((waybill) => (waybill.id === result.waybill.id ? result.waybill : waybill)),
      );
      queryClient.setQueryData(["member", "wallet"], result.wallet);
      invalidateWaybillData();
      setSelectedWaybillId(result.waybill.id);
      setPayWaybillId(null);
      clearNoticeLater(result.already_paid ? "该运单已完成支付。" : `${result.waybill.waybill_no} 已余额支付。`);
    },
  });

  const confirmMutation = useMutation({
    mutationFn: (waybillId: number) => confirmWaybillReceipt(waybillId, "用户在 Web 端确认收货"),
    onSuccess: (waybill) => {
      queryClient.setQueryData<Waybill[]>(["member", "waybills"], (current = []) =>
        current.map((item) => (item.id === waybill.id ? waybill : item)),
      );
      queryClient.invalidateQueries({ queryKey: ["member", "tracking-events", waybill.id] });
      queryClient.invalidateQueries({ queryKey: ["member", "waybills"] });
      setSelectedWaybillId(waybill.id);
      clearNoticeLater(`${waybill.waybill_no} 已确认收货。`);
    },
  });

  const allErrors = [
    createWaybillMutation.error,
    payMutation.error,
    confirmMutation.error,
    meQuery.error,
    packableQuery.error,
    waybillsQuery.error,
    walletQuery.error,
    addressesQuery.error,
  ];
  const hasError =
    meQuery.isError ||
    packableQuery.isError ||
    waybillsQuery.isError ||
    walletQuery.isError ||
    addressesQuery.isError ||
    createWaybillMutation.isError ||
    payMutation.isError ||
    confirmMutation.isError;
  const errorMessage = allErrors.find((error) => error instanceof Error)?.message || "数据加载失败，请刷新后重试。";

  const handleLogout = () => {
    logout();
    queryClient.clear();
    navigate("/login", { replace: true });
  };

  const toggleParcel = (parcel: Parcel) => {
    setSelectedParcelIds((current) =>
      current.includes(parcel.id) ? current.filter((id) => id !== parcel.id) : [...current, parcel.id],
    );
  };

  const handleCreate = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (selectedParcelIds.length === 0) {
      clearNoticeLater("请选择至少一个在库包裹。");
      return;
    }
    if (selectedParcels.length !== selectedParcelIds.length) {
      clearNoticeLater("所选包裹当前不可打包，请刷新后重新选择。");
      return;
    }
    if (selectedWarehouseIds.size > 1) {
      clearNoticeLater("一次运单只能选择同一仓库的包裹。");
      return;
    }
    createWaybillMutation.mutate(buildWaybillPayload(recipientForm, selectedParcelIds, selectedAddressId));
  };

  const refreshAll = () => {
    queryClient.invalidateQueries();
  };

  const pendingPaymentCount = waybills.filter((waybill) => waybill.status === "PENDING_PAYMENT").length;
  const shippedCount = waybills.filter((waybill) => waybill.status === "SHIPPED").length;
  const canPay =
    paymentWaybill && walletQuery.data
      ? compareMoney(walletQuery.data.balance, paymentWaybill.fee_total) >= 0
      : false;

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
            <strong>运单中心</strong>
            <span>{user?.profile?.member_no || user?.email || "会员"}</span>
          </div>
        </div>
        <div className={styles.headerActions}>
          <button className={styles.iconButton} type="button" aria-label="刷新运单" onClick={refreshAll}>
            <ReloadOutlined />
          </button>
          <button className={styles.accountButton} type="button" onClick={handleLogout}>
            <LogoutOutlined />
            <span>退出</span>
          </button>
        </div>
      </header>

      <section className={styles.summaryGrid}>
        <article>
          <span>在库可打包</span>
          <strong>{packableParcels.length}</strong>
        </article>
        <article>
          <span>待付款运单</span>
          <strong>{pendingPaymentCount}</strong>
        </article>
        <article>
          <span>运输中</span>
          <strong>{shippedCount}</strong>
        </article>
        <article>
          <span>账户余额</span>
          <strong>{formatMoney(walletQuery.data?.balance || "0.00", walletQuery.data?.currency || "CNY")}</strong>
        </article>
      </section>

      {hasError && <div className={styles.alert}>{errorMessage}</div>}
      {notice && <div className={styles.notice}>{notice}</div>}

      <section className={styles.workspace}>
        <form className={styles.createPanel} onSubmit={handleCreate}>
          <div className={styles.sectionTitle}>
            <div>
              <h1>申请打包</h1>
              <p>{selectedParcels.length > 0 ? selectedWarehouseNames.join(" / ") : "选择在库包裹创建运单"}</p>
            </div>
            <InboxOutlined />
          </div>

          <div className={styles.packableList}>
            {packableQuery.isLoading && <div className={styles.empty}>加载可打包包裹...</div>}
            {!packableQuery.isLoading && packableParcels.length === 0 && (
              <div className={styles.empty}>暂无在库可打包包裹</div>
            )}
            {packableParcels.map((parcel) => (
              <label
                key={parcel.id}
                className={`${styles.packableRow} ${selectedParcelIds.includes(parcel.id) ? styles.selectedPackable : ""}`}
              >
                <input
                  type="checkbox"
                  checked={selectedParcelIds.includes(parcel.id)}
                  onChange={() => toggleParcel(parcel)}
                />
                <span>
                  <strong>{parcel.parcel_no}</strong>
                  <small>{parcel.tracking_no}</small>
                </span>
                <span>{formatWeight(parcel.weight_kg)}</span>
              </label>
            ))}
          </div>

          <div className={styles.selectionSummary}>
            <span>已选 {selectedParcels.length} 件</span>
            <strong>{selectedWeight.toFixed(3)} kg</strong>
          </div>
          {selectedWarehouseIds.size > 1 && (
            <div className={styles.inlineWarning}>已选包裹来自多个仓库，请拆分提交。</div>
          )}

          <div className={styles.addressSelector}>
            <div className={styles.selectorTitle}>
              <span>收件地址</span>
              <button type="button" onClick={() => navigate("/addresses")}>
                <HomeOutlined />
                管理
              </button>
            </div>
            <select
              value={selectedAddressId ?? ""}
              onChange={(event) => {
                const nextId = Number(event.target.value) || null;
                setSelectedAddressId(nextId);
                const address = addresses.find((item) => item.id === nextId);
                if (address) {
                  setRecipientForm((current) => addressToRecipientForm(address, current.remark));
                }
              }}
            >
              <option value="">手工填写收件信息</option>
              {addresses.map((address) => (
                <option key={address.id} value={address.id}>
                  {address.is_default ? "默认 · " : ""}{address.recipient_name} · {address.country} {address.region || address.city}
                </option>
              ))}
            </select>
            {addressesQuery.isLoading && <small>加载地址簿...</small>}
          </div>

          <label>
            <span>目的国家</span>
            <input
              value={recipientForm.destination_country}
              required={!selectedAddressId}
              onChange={(event) =>
                setRecipientForm((current) => ({ ...current, destination_country: event.target.value }))
              }
            />
          </label>
          <label>
            <span>收件人</span>
            <input
              value={recipientForm.recipient_name}
              required={!selectedAddressId}
              onChange={(event) =>
                setRecipientForm((current) => ({ ...current, recipient_name: event.target.value }))
              }
            />
          </label>
          <label>
            <span>电话</span>
            <input
              value={recipientForm.recipient_phone}
              required={!selectedAddressId}
              onChange={(event) =>
                setRecipientForm((current) => ({ ...current, recipient_phone: event.target.value }))
              }
            />
          </label>
          <label>
            <span>收件地址</span>
            <textarea
              value={recipientForm.recipient_address}
              required={!selectedAddressId}
              rows={3}
              onChange={(event) =>
                setRecipientForm((current) => ({ ...current, recipient_address: event.target.value }))
              }
            />
          </label>
          <div className={styles.inlineFields}>
            <label>
              <span>邮编</span>
              <input
                value={recipientForm.postal_code}
                onChange={(event) =>
                  setRecipientForm((current) => ({ ...current, postal_code: event.target.value }))
                }
              />
            </label>
            <label>
              <span>备注</span>
              <input
                value={recipientForm.remark}
                onChange={(event) => setRecipientForm((current) => ({ ...current, remark: event.target.value }))}
              />
            </label>
          </div>

          <button
            className={styles.primaryButton}
            type="submit"
            disabled={createWaybillMutation.isPending || selectedWarehouseIds.size > 1}
          >
            <SendOutlined />
            {createWaybillMutation.isPending ? "提交中" : "提交运单"}
          </button>
        </form>

        <div className={styles.listPanel}>
          <div className={styles.listHeader}>
            <div>
              <h2>运单列表</h2>
              <p>支付、追踪和收货确认。</p>
            </div>
            <input
              className={styles.searchInput}
              value={keyword}
              placeholder="搜索运单号或包裹号"
              onChange={(event) => {
                setKeyword(event.target.value);
                setPage(1);
              }}
            />
          </div>

          <div className={styles.statusTabs}>
            {statusFilters.map((filter) => (
              <button
                key={filter.value}
                className={filter.value === statusFilter ? styles.activeTab : ""}
                type="button"
                onClick={() => {
                  setStatusFilter(filter.value);
                  setPage(1);
                }}
              >
                {filter.label}
              </button>
            ))}
          </div>

          {waybillsQuery.isLoading && <div className={styles.empty}>加载运单...</div>}
          {!waybillsQuery.isLoading && filteredWaybills.length === 0 && (
            <div className={styles.empty}>暂无匹配运单</div>
          )}
          {!waybillsQuery.isLoading && filteredWaybills.length > 0 && (
            <div className={styles.waybillList}>
              {pagedWaybills.map((waybill) => (
                <article
                  key={waybill.id}
                  className={`${styles.waybillRow} ${selectedWaybill?.id === waybill.id ? styles.selectedWaybill : ""}`}
                >
                  <button type="button" onClick={() => setSelectedWaybillId(waybill.id)}>
                    <span>
                      <strong>{waybill.waybill_no}</strong>
                      <small>{waybill.parcels.map((parcel) => parcel.parcel_no).join(" / ")}</small>
                    </span>
                    <span>{waybill.warehouse_name}</span>
                    <span>{formatMoney(waybill.fee_total)}</span>
                    {statusBadge(waybill.status)}
                  </button>
                </article>
              ))}
            </div>
          )}

          <div className={styles.pagination}>
            <button type="button" disabled={currentPage <= 1} onClick={() => setPage(Math.max(1, currentPage - 1))}>
              上一页
            </button>
            <span>
              {currentPage} / {totalPages}
            </span>
            <button
              type="button"
              disabled={currentPage >= totalPages}
              onClick={() => setPage(Math.min(totalPages, currentPage + 1))}
            >
              下一页
            </button>
          </div>
        </div>

        <aside className={styles.detailPanel}>
          <div className={styles.sectionTitle}>
            <div>
              <h2>运单详情</h2>
              <p>{selectedWaybill ? selectedWaybill.waybill_no : "选择运单查看详情"}</p>
            </div>
            <CreditCardOutlined />
          </div>

          {!selectedWaybill && <div className={styles.empty}>暂无运单详情</div>}
          {selectedWaybill && (
            <>
              <dl className={styles.detailList}>
                <div>
                  <dt>状态</dt>
                  <dd>{statusBadge(selectedWaybill.status)}</dd>
                </div>
                <div>
                  <dt>费用</dt>
                  <dd>{formatMoney(selectedWaybill.fee_total)}</dd>
                </div>
                <div>
                  <dt>仓库</dt>
                  <dd>{selectedWaybill.warehouse_name}</dd>
                </div>
                <div>
                  <dt>渠道</dt>
                  <dd>{selectedWaybill.channel_name || "后台审核确认"}</dd>
                </div>
                <div>
                  <dt>收件人</dt>
                  <dd>{snapshotValue(selectedWaybill.recipient_snapshot, "name")}</dd>
                </div>
                <div>
                  <dt>电话</dt>
                  <dd>{snapshotValue(selectedWaybill.recipient_snapshot, "phone")}</dd>
                </div>
                <div>
                  <dt>地址</dt>
                  <dd>{snapshotValue(selectedWaybill.recipient_snapshot, "address")}</dd>
                </div>
                <div>
                  <dt>创建时间</dt>
                  <dd>{formatDate(selectedWaybill.created_at)}</dd>
                </div>
              </dl>

              <div className={styles.detailBlock}>
                <h3>包裹</h3>
                <ul>
                  {selectedWaybill.parcels.map((parcel) => (
                    <li key={parcel.id}>
                      <span>{parcel.parcel_no}</span>
                      <strong>{parcel.tracking_no}</strong>
                    </li>
                  ))}
                </ul>
              </div>

              <div className={styles.detailBlock}>
                <h3>物流轨迹</h3>
                {trackingQuery.isLoading && <p>加载轨迹...</p>}
                {!trackingQuery.isLoading && trackingEvents.length === 0 && <p>暂无物流轨迹</p>}
                {trackingEvents.length > 0 && (
                  <ol className={styles.timeline}>
                    {trackingEvents.map((event) => (
                      <li key={event.id}>
                        <ClockCircleOutlined />
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

              <div className={styles.detailActions}>
                {selectedWaybill.status === "PENDING_PAYMENT" && (
                  <button className={styles.payButton} type="button" onClick={() => setPayWaybillId(selectedWaybill.id)}>
                    <WalletOutlined />
                    余额支付
                  </button>
                )}
                {selectedWaybill.status === "SHIPPED" && (
                  <button
                    className={styles.primaryButton}
                    type="button"
                    disabled={confirmMutation.isPending}
                    onClick={() => confirmMutation.mutate(selectedWaybill.id)}
                  >
                    <CheckCircleOutlined />
                    {confirmMutation.isPending ? "确认中" : "确认收货"}
                  </button>
                )}
              </div>
            </>
          )}
        </aside>
      </section>

      {paymentWaybill && (
        <div className={styles.modalOverlay} role="presentation">
          <div className={styles.paymentModal} role="dialog" aria-modal="true" aria-labelledby="waybill-pay-title">
            <div className={styles.sectionTitle}>
              <div>
                <h2 id="waybill-pay-title">余额支付</h2>
                <p>{paymentWaybill.waybill_no}</p>
              </div>
              <WalletOutlined />
            </div>
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
                className={styles.primaryButton}
                type="button"
                disabled={!canPay || payMutation.isPending}
                onClick={() => {
                  payMutation.mutate({
                    waybillId: paymentWaybill.id,
                    idempotencyKey: `web-waybill-${paymentWaybill.id}-${Date.now()}`,
                  });
                }}
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
