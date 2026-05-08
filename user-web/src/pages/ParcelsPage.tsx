import {
  ArrowLeftOutlined,
  BoxPlotOutlined,
  FileSearchOutlined,
  InboxOutlined,
  LogoutOutlined,
  PlusOutlined,
  ReloadOutlined,
  SendOutlined,
} from "@ant-design/icons";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { FormEvent, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";

import { fetchMe } from "../features/auth/api";
import { useAuthStore } from "../features/auth/store";
import { createParcelForecast, fetchParcels } from "../features/parcels/api";
import type { Parcel, ParcelForecastPayload, ParcelStatus } from "../features/parcels/types";
import { fetchWarehouses } from "../features/warehouses/api";
import styles from "./ParcelsPage.module.css";

type ForecastFormState = {
  warehouse_id: string;
  tracking_no: string;
  carrier: string;
  item_name: string;
  quantity: string;
  declared_value: string;
  remark: string;
};

type StatusFilter = "ALL" | ParcelStatus;

const initialForm: ForecastFormState = {
  warehouse_id: "",
  tracking_no: "",
  carrier: "",
  item_name: "",
  quantity: "1",
  declared_value: "0.00",
  remark: "",
};

const statusMeta: Record<ParcelStatus, { label: string; tone: string }> = {
  PENDING_INBOUND: { label: "待入库", tone: "warning" },
  IN_STOCK: { label: "在库", tone: "success" },
  PACKING_REQUESTED: { label: "已申请打包", tone: "info" },
  PACKED: { label: "已打包", tone: "info" },
  OUTBOUND: { label: "已出库", tone: "info" },
  CANCELLED: { label: "已取消", tone: "muted" },
  PROBLEM: { label: "问题包裹", tone: "danger" },
};

const statusFilters: Array<{ label: string; value: StatusFilter }> = [
  { label: "全部", value: "ALL" },
  { label: "待入库", value: "PENDING_INBOUND" },
  { label: "在库", value: "IN_STOCK" },
  { label: "已申请打包", value: "PACKING_REQUESTED" },
  { label: "异常", value: "PROBLEM" },
];

const pageSize = 6;

function formatDate(value?: string | null) {
  if (!value) {
    return "-";
  }
  return new Date(value).toLocaleString("zh-CN", { hour12: false });
}

function formatWeight(value?: string | null) {
  return value ? `${value} kg` : "-";
}

function formatDimensions(parcel: Parcel) {
  if (!parcel.length_cm && !parcel.width_cm && !parcel.height_cm) {
    return "-";
  }
  return `${parcel.length_cm || "-"} x ${parcel.width_cm || "-"} x ${parcel.height_cm || "-"} cm`;
}

function buildForecastPayload(form: ForecastFormState): ParcelForecastPayload {
  const itemName = form.item_name.trim();
  return {
    warehouse_id: Number(form.warehouse_id),
    tracking_no: form.tracking_no.trim(),
    carrier: form.carrier.trim(),
    remark: form.remark.trim(),
    items: itemName
      ? [
          {
            name: itemName,
            quantity: Number(form.quantity || 1),
            declared_value: form.declared_value || "0.00",
            product_url: "",
            remark: "",
          },
        ]
      : [],
  };
}

function StatusBadge({ status }: { status: ParcelStatus }) {
  const meta = statusMeta[status];
  return <span className={`${styles.statusBadge} ${styles[meta.tone]}`}>{meta.label}</span>;
}

export function ParcelsPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const logout = useAuthStore((state) => state.logout);
  const persistedUser = useAuthStore((state) => state.user);
  const setUser = useAuthStore((state) => state.setUser);
  const [form, setForm] = useState<ForecastFormState>(initialForm);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("ALL");
  const [keyword, setKeyword] = useState("");
  const [page, setPage] = useState(1);
  const [selectedParcelId, setSelectedParcelId] = useState<number | null>(null);
  const [packNotice, setPackNotice] = useState("");

  const meQuery = useQuery({
    queryKey: ["member", "me"],
    queryFn: fetchMe,
  });
  const warehousesQuery = useQuery({
    queryKey: ["member", "warehouses"],
    queryFn: fetchWarehouses,
  });
  const parcelsQuery = useQuery({
    queryKey: ["member", "parcels"],
    queryFn: fetchParcels,
  });

  const warehouses = useMemo(() => warehousesQuery.data ?? [], [warehousesQuery.data]);
  const parcels = useMemo(() => parcelsQuery.data ?? [], [parcelsQuery.data]);
  const selectedParcel = useMemo(
    () => parcels.find((parcel) => parcel.id === selectedParcelId) ?? parcels[0] ?? null,
    [parcels, selectedParcelId],
  );

  useEffect(() => {
    if (meQuery.data && meQuery.data.id !== persistedUser?.id) {
      setUser(meQuery.data);
    }
  }, [meQuery.data, persistedUser?.id, setUser]);

  const effectiveWarehouseId = form.warehouse_id || (warehouses[0]?.id ? String(warehouses[0].id) : "");

  const forecastMutation = useMutation({
    mutationFn: createParcelForecast,
    onSuccess: (parcel) => {
      queryClient.invalidateQueries({ queryKey: ["member", "parcels"] });
      setSelectedParcelId(parcel.id);
      setStatusFilter("ALL");
      setKeyword("");
      setPage(1);
      setForm((current) => ({
        ...initialForm,
        warehouse_id: current.warehouse_id || effectiveWarehouseId,
      }));
    },
  });

  const filteredParcels = useMemo(() => {
    const normalized = keyword.trim().toLowerCase();
    return parcels.filter((parcel) => {
      const matchesStatus = statusFilter === "ALL" || parcel.status === statusFilter;
      const matchesKeyword =
        !normalized ||
        [parcel.parcel_no, parcel.tracking_no, parcel.warehouse_name, parcel.carrier]
          .join(" ")
          .toLowerCase()
          .includes(normalized);
      return matchesStatus && matchesKeyword;
    });
  }, [keyword, parcels, statusFilter]);

  const totalPages = Math.max(1, Math.ceil(filteredParcels.length / pageSize));
  const currentPage = Math.min(page, totalPages);
  const pagedParcels = filteredParcels.slice((currentPage - 1) * pageSize, currentPage * pageSize);
  const user = meQuery.data ?? persistedUser;
  const hasError = meQuery.isError || warehousesQuery.isError || parcelsQuery.isError || forecastMutation.isError;

  const handleLogout = () => {
    logout();
    queryClient.clear();
    navigate("/login", { replace: true });
  };

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    forecastMutation.mutate(buildForecastPayload({ ...form, warehouse_id: effectiveWarehouseId }));
  };

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
            <strong>包裹中心</strong>
            <span>{user?.profile?.member_no || user?.email || "会员"}</span>
          </div>
        </div>
        <div className={styles.headerActions}>
          <button
            className={styles.iconButton}
            type="button"
            aria-label="刷新包裹"
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

      <section className={styles.summaryGrid}>
        <article>
          <span>全部包裹</span>
          <strong>{parcels.length}</strong>
        </article>
        <article>
          <span>待入库</span>
          <strong>{parcels.filter((parcel) => parcel.status === "PENDING_INBOUND").length}</strong>
        </article>
        <article>
          <span>在库可打包</span>
          <strong>{parcels.filter((parcel) => parcel.status === "IN_STOCK").length}</strong>
        </article>
      </section>

      {hasError && (
        <div className={styles.alert}>
          {forecastMutation.error instanceof Error ? forecastMutation.error.message : "数据加载失败，请刷新后重试。"}
        </div>
      )}
      {packNotice && <div className={styles.notice}>{packNotice}</div>}

      <section className={styles.workspace}>
        <form className={styles.forecastCard} onSubmit={handleSubmit}>
          <div className={styles.sectionTitle}>
            <div>
              <h1>包裹预报</h1>
              <p>提交国内快递单号后，仓库入库时会自动匹配。</p>
            </div>
            <PlusOutlined />
          </div>

          <label>
            <span>入库仓库</span>
            <select
              value={effectiveWarehouseId}
              required
              onChange={(event) => setForm((current) => ({ ...current, warehouse_id: event.target.value }))}
            >
              <option value="" disabled>
                选择仓库
              </option>
              {warehouses.map((warehouse) => (
                <option key={warehouse.id} value={warehouse.id}>
                  {warehouse.name}
                </option>
              ))}
            </select>
          </label>

          <label>
            <span>快递单号</span>
            <input
              value={form.tracking_no}
              required
              placeholder="TEST123"
              onChange={(event) => setForm((current) => ({ ...current, tracking_no: event.target.value }))}
            />
          </label>

          <div className={styles.inlineFields}>
            <label>
              <span>承运商</span>
              <input
                value={form.carrier}
                placeholder="SF / YTO"
                onChange={(event) => setForm((current) => ({ ...current, carrier: event.target.value }))}
              />
            </label>
            <label>
              <span>数量</span>
              <input
                type="number"
                min={1}
                value={form.quantity}
                onChange={(event) => setForm((current) => ({ ...current, quantity: event.target.value }))}
              />
            </label>
          </div>

          <label>
            <span>商品名称</span>
            <input
              value={form.item_name}
              placeholder="T-shirt"
              onChange={(event) => setForm((current) => ({ ...current, item_name: event.target.value }))}
            />
          </label>

          <label>
            <span>申报价值</span>
            <input
              type="number"
              min={0}
              step="0.01"
              value={form.declared_value}
              onChange={(event) => setForm((current) => ({ ...current, declared_value: event.target.value }))}
            />
          </label>

          <label>
            <span>备注</span>
            <textarea
              value={form.remark}
              rows={3}
              onChange={(event) => setForm((current) => ({ ...current, remark: event.target.value }))}
            />
          </label>

          <button className={styles.primaryButton} type="submit" disabled={forecastMutation.isPending}>
            <SendOutlined />
            {forecastMutation.isPending ? "提交中" : "提交预报"}
          </button>
        </form>

        <div className={styles.listCard}>
          <div className={styles.listHeader}>
            <div>
              <h2>包裹列表</h2>
              <p>按状态、单号和仓库筛选。</p>
            </div>
            <input
              className={styles.searchInput}
              value={keyword}
              placeholder="搜索包裹号或快递单号"
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

          {parcelsQuery.isLoading && <div className={styles.empty}>加载包裹...</div>}
          {!parcelsQuery.isLoading && filteredParcels.length === 0 && (
            <div className={styles.empty}>暂无匹配包裹</div>
          )}
          {!parcelsQuery.isLoading && filteredParcels.length > 0 && (
            <div className={styles.parcelList}>
              {pagedParcels.map((parcel) => (
                <article
                  key={parcel.id}
                  className={`${styles.parcelRow} ${selectedParcel?.id === parcel.id ? styles.selectedRow : ""}`}
                >
                  <button type="button" onClick={() => setSelectedParcelId(parcel.id)}>
                    <span>
                      <strong>{parcel.parcel_no}</strong>
                      <small>{parcel.tracking_no}</small>
                    </span>
                    <span>{parcel.warehouse_name}</span>
                    <StatusBadge status={parcel.status} />
                  </button>
                </article>
              ))}
            </div>
          )}

          <div className={styles.pagination}>
            <button
              type="button"
              disabled={currentPage <= 1}
              onClick={() => setPage(Math.max(1, currentPage - 1))}
            >
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

        <aside className={styles.detailCard}>
          <div className={styles.sectionTitle}>
            <div>
              <h2>包裹详情</h2>
              <p>{selectedParcel ? selectedParcel.parcel_no : "选择包裹查看详情"}</p>
            </div>
            <FileSearchOutlined />
          </div>

          {!selectedParcel && <div className={styles.empty}>暂无包裹详情</div>}
          {selectedParcel && (
            <>
              <dl className={styles.detailList}>
                <div>
                  <dt>快递单号</dt>
                  <dd>{selectedParcel.tracking_no}</dd>
                </div>
                <div>
                  <dt>仓库</dt>
                  <dd>{selectedParcel.warehouse_name}</dd>
                </div>
                <div>
                  <dt>状态</dt>
                  <dd>
                    <StatusBadge status={selectedParcel.status} />
                  </dd>
                </div>
                <div>
                  <dt>重量</dt>
                  <dd>{formatWeight(selectedParcel.weight_kg)}</dd>
                </div>
                <div>
                  <dt>体积</dt>
                  <dd>{formatDimensions(selectedParcel)}</dd>
                </div>
                <div>
                  <dt>入库时间</dt>
                  <dd>{formatDate(selectedParcel.inbound_at)}</dd>
                </div>
              </dl>

              <div className={styles.detailBlock}>
                <h3>商品明细</h3>
                {selectedParcel.items.length === 0 ? (
                  <p>暂无商品明细</p>
                ) : (
                  <ul>
                    {selectedParcel.items.map((item) => (
                      <li key={item.id}>
                        <span>{item.name}</span>
                        <strong>
                          x{item.quantity} / ¥{item.declared_value}
                        </strong>
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              <div className={styles.detailBlock}>
                <h3>图片凭证</h3>
                {selectedParcel.photos.length === 0 ? (
                  <p>暂无图片凭证</p>
                ) : (
                  <div className={styles.photoTags}>
                    {selectedParcel.photos.map((photo) => (
                      <span key={photo.id}>
                        <BoxPlotOutlined />
                        {photo.file_id}
                      </span>
                    ))}
                  </div>
                )}
              </div>

              {selectedParcel.status === "IN_STOCK" && (
                <button
                  className={styles.packButton}
                  type="button"
                  onClick={() => {
                    setPackNotice(`${selectedParcel.parcel_no} 已可申请打包，运单创建将在下一模块接入。`);
                    window.setTimeout(() => setPackNotice(""), 2400);
                  }}
                >
                  <InboxOutlined />
                  申请打包
                </button>
              )}
            </>
          )}
        </aside>
      </section>
    </main>
  );
}
