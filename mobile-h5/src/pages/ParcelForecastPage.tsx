import { DotLoading, ErrorBlock } from "antd-mobile";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { FormEvent, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";

import { createParcelForecast } from "../features/parcels/api";
import type { ParcelForecastPayload } from "../features/parcels/types";
import { fetchWarehouses } from "../features/warehouses/api";
import styles from "./ParcelForecastPage.module.css";

type FormState = {
  warehouse_id: string;
  tracking_no: string;
  carrier: string;
  item_name: string;
  quantity: string;
  declared_value: string;
  remark: string;
};

const initialForm: FormState = {
  warehouse_id: "",
  tracking_no: "",
  carrier: "",
  item_name: "",
  quantity: "1",
  declared_value: "0.00",
  remark: "",
};

function buildPayload(form: FormState, warehouseId: string): ParcelForecastPayload {
  const itemName = form.item_name.trim();
  return {
    warehouse_id: Number(warehouseId),
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

export function ParcelForecastPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [form, setForm] = useState<FormState>(initialForm);

  const warehousesQuery = useQuery({
    queryKey: ["mobile", "member", "warehouses"],
    queryFn: fetchWarehouses,
  });
  const warehouses = useMemo(() => warehousesQuery.data ?? [], [warehousesQuery.data]);
  const effectiveWarehouseId = form.warehouse_id || (warehouses[0]?.id ? String(warehouses[0].id) : "");

  const forecastMutation = useMutation({
    mutationFn: createParcelForecast,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["mobile", "member", "parcels"] });
      navigate("/ship/parcels", { replace: true });
    },
  });

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    forecastMutation.mutate(buildPayload(form, effectiveWarehouseId));
  };

  return (
    <main className={styles.page}>
      <header className={styles.top}>
        <button type="button" onClick={() => navigate("/ship")}>
          返回
        </button>
        <div>
          <span>Parcel Forecast</span>
          <h1>发布预报</h1>
        </div>
      </header>

      {warehousesQuery.isLoading && (
        <div className={styles.loading}>
          <DotLoading />
          <span>加载仓库</span>
        </div>
      )}

      {warehousesQuery.isError && (
        <ErrorBlock status="default" title="仓库加载失败" description="请刷新后重试" />
      )}

      <form className={styles.form} onSubmit={handleSubmit}>
        <label>
          <span>入库仓库</span>
          <select
            required
            value={effectiveWarehouseId}
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
            required
            value={form.tracking_no}
            placeholder="TEST123"
            onChange={(event) => setForm((current) => ({ ...current, tracking_no: event.target.value }))}
          />
        </label>

        <label>
          <span>承运商</span>
          <input
            value={form.carrier}
            placeholder="SF / YTO"
            onChange={(event) => setForm((current) => ({ ...current, carrier: event.target.value }))}
          />
        </label>

        <div className={styles.row}>
          <label>
            <span>数量</span>
            <input
              type="number"
              min={1}
              value={form.quantity}
              onChange={(event) => setForm((current) => ({ ...current, quantity: event.target.value }))}
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
          <span>备注</span>
          <textarea
            value={form.remark}
            rows={4}
            onChange={(event) => setForm((current) => ({ ...current, remark: event.target.value }))}
          />
        </label>

        {forecastMutation.isError && (
          <div className={styles.error}>
            {forecastMutation.error instanceof Error ? forecastMutation.error.message : "提交失败"}
          </div>
        )}

        <div className={styles.actionBar}>
          <button type="submit" disabled={forecastMutation.isPending || !effectiveWarehouseId}>
            {forecastMutation.isPending ? "提交中" : "提交预报"}
          </button>
        </div>
      </form>
    </main>
  );
}
