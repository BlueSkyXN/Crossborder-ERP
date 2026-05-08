import {
  ArrowLeftOutlined,
  DeleteOutlined,
  EditOutlined,
  HomeOutlined,
  PlusOutlined,
  ReloadOutlined,
  StarFilled,
  StarOutlined,
} from "@ant-design/icons";
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
import styles from "./AddressesPage.module.css";

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

export function AddressesPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [form, setForm] = useState<AddressFormState>(initialForm);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [notice, setNotice] = useState("");

  const addressesQuery = useQuery({
    queryKey: ["member", "addresses"],
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
    queryClient.invalidateQueries({ queryKey: ["member", "addresses"] });
  };

  const createMutation = useMutation({
    mutationFn: createAddress,
    onSuccess: (address) => {
      invalidateAddresses();
      resetForm();
      showNotice(`${address.recipient_name} 已新增。`);
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ addressId, payload }: { addressId: number; payload: AddressPayload }) =>
      updateAddress(addressId, payload),
    onSuccess: (address) => {
      invalidateAddresses();
      resetForm();
      showNotice(`${address.recipient_name} 已更新。`);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: deleteAddress,
    onSuccess: () => {
      invalidateAddresses();
      showNotice("地址已停用。");
    },
  });

  const defaultMutation = useMutation({
    mutationFn: setDefaultAddress,
    onSuccess: (address) => {
      invalidateAddresses();
      showNotice(`${address.recipient_name} 已设为默认。`);
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

  const isSaving = createMutation.isPending || updateMutation.isPending;
  const error = [
    addressesQuery.error,
    createMutation.error,
    updateMutation.error,
    deleteMutation.error,
    defaultMutation.error,
  ].find((item) => item instanceof Error);

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
            <strong>地址簿</strong>
            <span>{defaultAddress ? `${defaultAddress.recipient_name} · 默认地址` : "维护常用国际收件地址"}</span>
          </div>
        </div>
        <button className={styles.iconButton} type="button" aria-label="刷新地址" onClick={invalidateAddresses}>
          <ReloadOutlined />
        </button>
      </header>

      {notice && <div className={styles.notice}>{notice}</div>}
      {error && <div className={styles.alert}>{error.message}</div>}

      <section className={styles.workspace}>
        <form className={styles.formPanel} onSubmit={handleSubmit}>
          <div className={styles.sectionTitle}>
            <div>
              <h1>{editingId ? "编辑地址" : "新增地址"}</h1>
              <p>用于创建运单时生成收件快照。</p>
            </div>
            <HomeOutlined />
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
          <div className={styles.inlineFields}>
            <label>
              <span>国家/地区</span>
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
          <div className={styles.inlineFields}>
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
            <span>设为默认地址</span>
          </label>

          <div className={styles.formActions}>
            {editingId && (
              <button type="button" onClick={resetForm}>
                取消
              </button>
            )}
            <button className={styles.primaryButton} type="submit" disabled={isSaving}>
              {editingId ? <EditOutlined /> : <PlusOutlined />}
              {isSaving ? "保存中" : editingId ? "保存地址" : "新增地址"}
            </button>
          </div>
        </form>

        <section className={styles.listPanel}>
          <div className={styles.listHeader}>
            <div>
              <h2>地址列表</h2>
              <p>{addresses.length} 个启用地址。</p>
            </div>
          </div>

          {addressesQuery.isLoading && <div className={styles.empty}>加载地址...</div>}
          {!addressesQuery.isLoading && addresses.length === 0 && <div className={styles.empty}>暂无地址</div>}
          <div className={styles.addressList}>
            {addresses.map((address) => (
              <article key={address.id} className={`${styles.addressCard} ${address.is_default ? styles.defaultCard : ""}`}>
                <div className={styles.addressHead}>
                  <div>
                    <strong>{address.recipient_name}</strong>
                    <span>{address.phone}</span>
                  </div>
                  {address.is_default ? (
                    <span className={styles.defaultBadge}>
                      <StarFilled />
                      默认
                    </span>
                  ) : (
                    <button type="button" onClick={() => defaultMutation.mutate(address.id)}>
                      <StarOutlined />
                      设默认
                    </button>
                  )}
                </div>
                <p>{address.full_address}</p>
                <dl>
                  <div>
                    <dt>邮编</dt>
                    <dd>{address.postal_code || "-"}</dd>
                  </div>
                  <div>
                    <dt>公司</dt>
                    <dd>{address.company || "-"}</dd>
                  </div>
                </dl>
                <div className={styles.cardActions}>
                  <button type="button" onClick={() => {
                    setEditingId(address.id);
                    setForm(toForm(address));
                  }}>
                    <EditOutlined />
                    编辑
                  </button>
                  <button type="button" onClick={() => deleteMutation.mutate(address.id)}>
                    <DeleteOutlined />
                    停用
                  </button>
                </div>
              </article>
            ))}
          </div>
        </section>
      </section>
    </main>
  );
}
