import { DotLoading, Empty, ErrorBlock } from "antd-mobile";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { FormEvent, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";

import {
  createAddress,
  deleteAddress,
  fetchAddresses,
  setDefaultAddress,
  updateAddress,
} from "../features/addresses/api";
import type { Address, AddressPayload } from "../features/addresses/types";
import styles from "./AddressBookPage.module.css";

type AddressFormState = Required<AddressPayload>;

const initialForm: AddressFormState = {
  recipient_name: "",
  phone: "",
  country: "US",
  region: "",
  city: "",
  postal_code: "",
  address_line: "",
  company: "",
  is_default: false,
};

function toForm(address: Address): AddressFormState {
  return {
    recipient_name: address.recipient_name,
    phone: address.phone,
    country: address.country,
    region: address.region,
    city: address.city,
    postal_code: address.postal_code,
    address_line: address.address_line,
    company: address.company,
    is_default: address.is_default,
  };
}

function toPayload(form: AddressFormState): AddressPayload {
  return {
    recipient_name: form.recipient_name.trim(),
    phone: form.phone.trim(),
    country: form.country.trim(),
    region: form.region.trim(),
    city: form.city.trim(),
    postal_code: form.postal_code.trim(),
    address_line: form.address_line.trim(),
    company: form.company.trim(),
    is_default: form.is_default,
  };
}

export function AddressBookPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [form, setForm] = useState<AddressFormState>(initialForm);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [notice, setNotice] = useState("");

  const addressesQuery = useQuery({
    queryKey: ["mobile", "member", "addresses"],
    queryFn: fetchAddresses,
  });

  const addresses = useMemo(() => addressesQuery.data ?? [], [addressesQuery.data]);
  const defaultAddress = addresses.find((address) => address.is_default);

  const showNotice = (message: string) => {
    setNotice(message);
    window.setTimeout(() => setNotice(""), 2400);
  };

  const resetForm = () => {
    setForm(initialForm);
    setEditingId(null);
  };

  const invalidateAddresses = () => {
    queryClient.invalidateQueries({ queryKey: ["mobile", "member", "addresses"] });
  };

  const createMutation = useMutation({
    mutationFn: createAddress,
    onSuccess: (address) => {
      invalidateAddresses();
      resetForm();
      showNotice(`${address.recipient_name} 已新增`);
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ addressId, payload }: { addressId: number; payload: AddressPayload }) =>
      updateAddress(addressId, payload),
    onSuccess: (address) => {
      invalidateAddresses();
      resetForm();
      showNotice(`${address.recipient_name} 已更新`);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: deleteAddress,
    onSuccess: () => {
      invalidateAddresses();
      showNotice("地址已停用");
    },
  });

  const defaultMutation = useMutation({
    mutationFn: setDefaultAddress,
    onSuccess: (address) => {
      invalidateAddresses();
      showNotice(`${address.recipient_name} 已设为默认`);
    },
  });

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const payload = toPayload(form);
    if (editingId) {
      updateMutation.mutate({ addressId: editingId, payload });
      return;
    }
    createMutation.mutate(payload);
  };

  const allErrors = [
    addressesQuery.error,
    createMutation.error,
    updateMutation.error,
    deleteMutation.error,
    defaultMutation.error,
  ];
  const errorMessage = allErrors.find((error) => error instanceof Error)?.message || "地址操作失败";
  const hasError =
    addressesQuery.isError ||
    createMutation.isError ||
    updateMutation.isError ||
    deleteMutation.isError ||
    defaultMutation.isError;
  const isSaving = createMutation.isPending || updateMutation.isPending;

  return (
    <main className={styles.page}>
      <header className={styles.top}>
        <button type="button" onClick={() => navigate("/me")}>
          返回
        </button>
        <div>
          <span>Address</span>
          <h1>地址簿</h1>
        </div>
        <button type="button" onClick={invalidateAddresses}>
          刷新
        </button>
      </header>

      {notice && <div className={styles.notice}>{notice}</div>}
      {hasError && <div className={styles.error}>{errorMessage}</div>}

      <section className={styles.summary}>
        <div>
          <span>启用地址</span>
          <strong>{addresses.length}</strong>
        </div>
        <div>
          <span>默认地址</span>
          <strong>{defaultAddress?.recipient_name || "-"}</strong>
        </div>
      </section>

      <form className={styles.form} onSubmit={handleSubmit}>
        <div className={styles.formHead}>
          <span>{editingId ? "Edit" : "New"}</span>
          <h2>{editingId ? "编辑地址" : "新增地址"}</h2>
        </div>
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
            value={form.phone}
            onChange={(event) => setForm((current) => ({ ...current, phone: event.target.value }))}
          />
        </label>
        <div className={styles.row}>
          <label>
            <span>国家</span>
            <input
              required
              value={form.country}
              onChange={(event) => setForm((current) => ({ ...current, country: event.target.value }))}
            />
          </label>
          <label>
            <span>省/州</span>
            <input
              value={form.region}
              onChange={(event) => setForm((current) => ({ ...current, region: event.target.value }))}
            />
          </label>
        </div>
        <div className={styles.row}>
          <label>
            <span>城市</span>
            <input
              value={form.city}
              onChange={(event) => setForm((current) => ({ ...current, city: event.target.value }))}
            />
          </label>
          <label>
            <span>邮编</span>
            <input
              value={form.postal_code}
              onChange={(event) => setForm((current) => ({ ...current, postal_code: event.target.value }))}
            />
          </label>
        </div>
        <label>
          <span>详细地址</span>
          <textarea
            required
            rows={3}
            value={form.address_line}
            onChange={(event) => setForm((current) => ({ ...current, address_line: event.target.value }))}
          />
        </label>
        <label>
          <span>公司</span>
          <input
            value={form.company}
            onChange={(event) => setForm((current) => ({ ...current, company: event.target.value }))}
          />
        </label>
        <label className={styles.checkLine}>
          <input
            type="checkbox"
            checked={form.is_default}
            onChange={(event) => setForm((current) => ({ ...current, is_default: event.target.checked }))}
          />
          <span>设为默认</span>
        </label>
        <div className={styles.formActions}>
          {editingId && (
            <button type="button" onClick={resetForm}>
              取消
            </button>
          )}
          <button type="submit" disabled={isSaving}>
            {isSaving ? "保存中" : editingId ? "保存地址" : "新增地址"}
          </button>
        </div>
      </form>

      {addressesQuery.isLoading && (
        <div className={styles.loading}>
          <DotLoading />
          <span>加载地址</span>
        </div>
      )}
      {addressesQuery.isError && <ErrorBlock status="default" title="地址加载失败" description="请刷新后重试" />}
      {!addressesQuery.isLoading && !addressesQuery.isError && addresses.length === 0 && <Empty description="暂无地址" />}

      <section className={styles.list}>
        {addresses.map((address) => (
          <article key={address.id} className={`${styles.card} ${address.is_default ? styles.defaultCard : ""}`}>
            <header>
              <div>
                <strong>{address.recipient_name}</strong>
                <span>{address.phone}</span>
              </div>
              <em>{address.is_default ? "默认" : "常用"}</em>
            </header>
            <p>{address.full_address}</p>
            <div className={styles.cardActions}>
              {!address.is_default && (
                <button type="button" onClick={() => defaultMutation.mutate(address.id)}>
                  设默认
                </button>
              )}
              <button type="button" onClick={() => {
                setEditingId(address.id);
                setForm(toForm(address));
              }}>
                编辑
              </button>
              <button type="button" onClick={() => deleteMutation.mutate(address.id)}>
                停用
              </button>
            </div>
          </article>
        ))}
      </section>
    </main>
  );
}
