import { DotLoading, Empty, ErrorBlock } from "antd-mobile";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { FormEvent, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";

import { fetchPackableParcels } from "../features/parcels/api";
import type { Parcel } from "../features/parcels/types";
import { createWaybill } from "../features/waybills/api";
import type { WaybillCreatePayload } from "../features/waybills/types";
import styles from "./WaybillPackingPage.module.css";

type RecipientFormState = {
  destination_country: string;
  recipient_name: string;
  recipient_phone: string;
  recipient_address: string;
  postal_code: string;
  remark: string;
};

const initialForm: RecipientFormState = {
  destination_country: "US",
  recipient_name: "",
  recipient_phone: "",
  recipient_address: "",
  postal_code: "",
  remark: "",
};

function buildPayload(form: RecipientFormState, parcelIds: number[]): WaybillCreatePayload {
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

function formatWeight(value?: string | null) {
  return value ? `${value} kg` : "-";
}

function initialParcelIds() {
  const parcelId = Number(new URLSearchParams(window.location.search).get("parcel_id"));
  return parcelId ? [parcelId] : [];
}

export function WaybillPackingPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [form, setForm] = useState<RecipientFormState>(initialForm);
  const [selectedParcelIds, setSelectedParcelIds] = useState<number[]>(initialParcelIds);
  const [notice, setNotice] = useState("");

  const packableQuery = useQuery({
    queryKey: ["mobile", "member", "packable-parcels"],
    queryFn: fetchPackableParcels,
  });

  const packableParcels = useMemo(() => packableQuery.data ?? [], [packableQuery.data]);
  const selectedParcels = packableParcels.filter((parcel) => selectedParcelIds.includes(parcel.id));
  const selectedWarehouseIds = new Set(selectedParcels.map((parcel) => parcel.warehouse));
  const selectedWeight = selectedParcels.reduce((total, parcel) => total + Number(parcel.weight_kg || 0), 0);

  const createMutation = useMutation({
    mutationFn: createWaybill,
    onSuccess: (waybill) => {
      queryClient.invalidateQueries({ queryKey: ["mobile", "member", "packable-parcels"] });
      queryClient.invalidateQueries({ queryKey: ["mobile", "member", "parcels"] });
      queryClient.invalidateQueries({ queryKey: ["mobile", "member", "waybills"] });
      navigate(`/ship/waybills?waybill_id=${waybill.id}`, { replace: true });
    },
  });

  const toggleParcel = (parcel: Parcel) => {
    setSelectedParcelIds((current) =>
      current.includes(parcel.id) ? current.filter((id) => id !== parcel.id) : [...current, parcel.id],
    );
  };

  const showNotice = (message: string) => {
    setNotice(message);
    window.setTimeout(() => setNotice(""), 2400);
  };

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (selectedParcelIds.length === 0) {
      showNotice("请选择至少一个在库包裹");
      return;
    }
    if (selectedParcels.length !== selectedParcelIds.length) {
      showNotice("所选包裹当前不可打包，请刷新后重选");
      return;
    }
    if (selectedWarehouseIds.size > 1) {
      showNotice("一次运单只能选择同一仓库包裹");
      return;
    }
    createMutation.mutate(buildPayload(form, selectedParcelIds));
  };

  return (
    <main className={styles.page}>
      <header className={styles.top}>
        <button type="button" onClick={() => navigate("/ship/parcels")}>
          返回
        </button>
        <div>
          <span>Packing</span>
          <h1>申请打包</h1>
        </div>
        <button type="button" onClick={() => queryClient.invalidateQueries()}>
          刷新
        </button>
      </header>

      {notice && <div className={styles.notice}>{notice}</div>}
      {createMutation.isError && (
        <div className={styles.error}>
          {createMutation.error instanceof Error ? createMutation.error.message : "提交失败"}
        </div>
      )}

      <section className={styles.summary}>
        <div>
          <span>已选包裹</span>
          <strong>{selectedParcels.length}</strong>
        </div>
        <div>
          <span>合计重量</span>
          <strong>{selectedWeight.toFixed(3)} kg</strong>
        </div>
      </section>

      {packableQuery.isLoading && (
        <div className={styles.loading}>
          <DotLoading />
          <span>加载可打包包裹</span>
        </div>
      )}

      {packableQuery.isError && (
        <ErrorBlock status="default" title="包裹加载失败" description="请刷新后重试" />
      )}

      {!packableQuery.isLoading && !packableQuery.isError && packableParcels.length === 0 && (
        <Empty description="暂无在库可打包包裹" />
      )}

      {!packableQuery.isLoading && !packableQuery.isError && packableParcels.length > 0 && (
        <section className={styles.parcelList}>
          {packableParcels.map((parcel) => (
            <button
              key={parcel.id}
              type="button"
              className={`${styles.parcelCard} ${selectedParcelIds.includes(parcel.id) ? styles.selected : ""}`}
              onClick={() => toggleParcel(parcel)}
            >
              <div>
                <strong>{parcel.parcel_no}</strong>
                <span>{parcel.tracking_no}</span>
              </div>
              <small>{parcel.warehouse_name}</small>
              <em>{formatWeight(parcel.weight_kg)}</em>
            </button>
          ))}
        </section>
      )}

      {selectedWarehouseIds.size > 1 && <div className={styles.warning}>已选包裹来自多个仓库，请拆分提交。</div>}

      <form className={styles.form} onSubmit={handleSubmit}>
        <label>
          <span>目的国家</span>
          <input
            required
            value={form.destination_country}
            onChange={(event) => setForm((current) => ({ ...current, destination_country: event.target.value }))}
          />
        </label>
        <label>
          <span>收件人</span>
          <input
            required
            value={form.recipient_name}
            onChange={(event) => setForm((current) => ({ ...current, recipient_name: event.target.value }))}
          />
        </label>
        <label>
          <span>电话</span>
          <input
            required
            value={form.recipient_phone}
            onChange={(event) => setForm((current) => ({ ...current, recipient_phone: event.target.value }))}
          />
        </label>
        <label>
          <span>收件地址</span>
          <textarea
            required
            rows={3}
            value={form.recipient_address}
            onChange={(event) => setForm((current) => ({ ...current, recipient_address: event.target.value }))}
          />
        </label>
        <div className={styles.row}>
          <label>
            <span>邮编</span>
            <input
              value={form.postal_code}
              onChange={(event) => setForm((current) => ({ ...current, postal_code: event.target.value }))}
            />
          </label>
          <label>
            <span>备注</span>
            <input
              value={form.remark}
              onChange={(event) => setForm((current) => ({ ...current, remark: event.target.value }))}
            />
          </label>
        </div>

        <div className={styles.actionBar}>
          <button type="submit" disabled={createMutation.isPending || selectedWarehouseIds.size > 1}>
            {createMutation.isPending ? "提交中" : "提交运单"}
          </button>
        </div>
      </form>
    </main>
  );
}
