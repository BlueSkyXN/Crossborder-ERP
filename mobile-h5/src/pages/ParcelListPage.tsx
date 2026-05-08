import { DotLoading, Empty, ErrorBlock } from "antd-mobile";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";

import { fetchParcels } from "../features/parcels/api";
import type { Parcel, ParcelStatus } from "../features/parcels/types";
import styles from "./ParcelListPage.module.css";

type StatusFilter = "ALL" | ParcelStatus;

const statusMeta: Record<ParcelStatus, { label: string; tone: string }> = {
  PENDING_INBOUND: { label: "待入库", tone: "warning" },
  IN_STOCK: { label: "在库", tone: "success" },
  PACKING_REQUESTED: { label: "已申请打包", tone: "info" },
  PACKED: { label: "已打包", tone: "info" },
  OUTBOUND: { label: "已出库", tone: "info" },
  CANCELLED: { label: "已取消", tone: "muted" },
  PROBLEM: { label: "问题包裹", tone: "danger" },
};

const filters: Array<{ label: string; value: StatusFilter }> = [
  { label: "全部", value: "ALL" },
  { label: "待入库", value: "PENDING_INBOUND" },
  { label: "在库", value: "IN_STOCK" },
  { label: "异常", value: "PROBLEM" },
];

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

function StatusPill({ status }: { status: ParcelStatus }) {
  const meta = statusMeta[status];
  return <span className={`${styles.statusPill} ${styles[meta.tone]}`}>{meta.label}</span>;
}

export function ParcelListPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("ALL");
  const [selectedParcelId, setSelectedParcelId] = useState<number | null>(null);

  const parcelsQuery = useQuery({
    queryKey: ["mobile", "member", "parcels"],
    queryFn: fetchParcels,
  });

  const parcels = useMemo(() => parcelsQuery.data ?? [], [parcelsQuery.data]);
  const filteredParcels = useMemo(
    () =>
      parcels.filter((parcel) => statusFilter === "ALL" || parcel.status === statusFilter),
    [parcels, statusFilter],
  );
  const selectedParcel = useMemo(
    () => filteredParcels.find((parcel) => parcel.id === selectedParcelId) ?? filteredParcels[0] ?? null,
    [filteredParcels, selectedParcelId],
  );

  return (
    <main className={styles.page}>
      <header className={styles.top}>
        <button type="button" onClick={() => navigate("/ship")}>
          返回
        </button>
        <div>
          <span>Parcel Center</span>
          <h1>我的包裹</h1>
        </div>
        <button type="button" onClick={() => queryClient.invalidateQueries()}>
          刷新
        </button>
      </header>

      <section className={styles.summary}>
        <div>
          <span>全部</span>
          <strong>{parcels.length}</strong>
        </div>
        <div>
          <span>待入库</span>
          <strong>{parcels.filter((parcel) => parcel.status === "PENDING_INBOUND").length}</strong>
        </div>
        <div>
          <span>在库</span>
          <strong>{parcels.filter((parcel) => parcel.status === "IN_STOCK").length}</strong>
        </div>
      </section>

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

      {parcelsQuery.isLoading && (
        <div className={styles.loading}>
          <DotLoading />
          <span>加载包裹</span>
        </div>
      )}

      {parcelsQuery.isError && (
        <ErrorBlock status="default" title="包裹加载失败" description="请刷新后重试" />
      )}

      {!parcelsQuery.isLoading && !parcelsQuery.isError && filteredParcels.length === 0 && (
        <Empty description="暂无包裹" />
      )}

      {!parcelsQuery.isLoading && !parcelsQuery.isError && filteredParcels.length > 0 && (
        <section className={styles.list}>
          {filteredParcels.map((parcel) => (
            <button
              key={parcel.id}
              type="button"
              className={`${styles.parcelCard} ${selectedParcel?.id === parcel.id ? styles.selected : ""}`}
              onClick={() => setSelectedParcelId(parcel.id)}
            >
              <div>
                <strong>{parcel.tracking_no}</strong>
                <span>{parcel.parcel_no}</span>
              </div>
              <StatusPill status={parcel.status} />
              <small>{parcel.warehouse_name}</small>
            </button>
          ))}
        </section>
      )}

      {selectedParcel && (
        <section className={styles.detail}>
          <div className={styles.detailHead}>
            <div>
              <span>包裹详情</span>
              <h2>{selectedParcel.parcel_no}</h2>
            </div>
            <StatusPill status={selectedParcel.status} />
          </div>
          <dl>
            <div>
              <dt>快递单号</dt>
              <dd>{selectedParcel.tracking_no}</dd>
            </div>
            <div>
              <dt>仓库</dt>
              <dd>{selectedParcel.warehouse_name}</dd>
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

          <div className={styles.block}>
            <h3>图片凭证</h3>
            {selectedParcel.photos.length === 0 ? (
              <p>暂无图片凭证</p>
            ) : (
              <div className={styles.photos}>
                {selectedParcel.photos.map((photo) => (
                  <span key={photo.id}>{photo.file_id}</span>
                ))}
              </div>
            )}
          </div>

          {selectedParcel.status === "IN_STOCK" && (
            <div className={styles.actionBar}>
              <button type="button" onClick={() => navigate(`/ship/packing?parcel_id=${selectedParcel.id}`)}>
                申请打包
              </button>
            </div>
          )}
        </section>
      )}
    </main>
  );
}
