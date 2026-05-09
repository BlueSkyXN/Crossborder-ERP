import {
  ArrowLeftOutlined,
  FileSearchOutlined,
  ReloadOutlined,
  SendOutlined,
} from "@ant-design/icons";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { FormEvent, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";

import { claimUnclaimedParcel, fetchUnclaimedParcels } from "../features/parcels/api";
import type { PublicUnclaimedParcel, UnclaimedParcelStatus } from "../features/parcels/types";
import styles from "./UnclaimedParcelsPage.module.css";

const statusMeta: Record<UnclaimedParcelStatus, { label: string; tone: string }> = {
  UNCLAIMED: { label: "待认领", tone: "warning" },
  CLAIM_PENDING: { label: "认领待审", tone: "info" },
  CLAIMED: { label: "已认领", tone: "success" },
};

function formatDate(value?: string | null) {
  if (!value) {
    return "-";
  }
  return new Date(value).toLocaleString("zh-CN", { hour12: false });
}

function formatWeight(value?: string | null) {
  return value ? `${value} kg` : "-";
}

function statusBadge(status: UnclaimedParcelStatus) {
  const meta = statusMeta[status];
  return <span className={`${styles.statusBadge} ${styles[meta.tone]}`}>{meta.label}</span>;
}

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : "请求失败";
}

export function UnclaimedParcelsPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [keyword, setKeyword] = useState("");
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [claimNote, setClaimNote] = useState("");
  const [claimContact, setClaimContact] = useState("");
  const [notice, setNotice] = useState("");

  const unclaimedQuery = useQuery({
    queryKey: ["member", "unclaimed-parcels", keyword.trim()],
    queryFn: () => fetchUnclaimedParcels(keyword),
  });

  const unclaimedParcels = useMemo(() => unclaimedQuery.data ?? [], [unclaimedQuery.data]);
  const selectedParcel = useMemo(
    () => unclaimedParcels.find((parcel) => parcel.id === selectedId) ?? unclaimedParcels[0] ?? null,
    [selectedId, unclaimedParcels],
  );
  const pendingMine = unclaimedParcels.filter((parcel) => parcel.is_mine && parcel.status === "CLAIM_PENDING").length;
  const availableCount = unclaimedParcels.filter((parcel) => parcel.status === "UNCLAIMED").length;

  const invalidateUnclaimed = () =>
    queryClient.invalidateQueries({ queryKey: ["member", "unclaimed-parcels"] });

  const showNotice = (message: string) => {
    setNotice(message);
    window.setTimeout(() => setNotice(""), 2600);
  };

  const claimMutation = useMutation({
    mutationFn: (parcel: PublicUnclaimedParcel) =>
      claimUnclaimedParcel(parcel.id, {
        claim_note: claimNote.trim(),
        claim_contact: claimContact.trim(),
      }),
    onSuccess: (parcel) => {
      setSelectedId(parcel.id);
      setClaimNote("");
      setClaimContact("");
      invalidateUnclaimed();
      showNotice(`${parcel.tracking_no_masked} 已提交认领审核。`);
    },
  });

  const handleClaim = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!selectedParcel || selectedParcel.status !== "UNCLAIMED") {
      return;
    }
    claimMutation.mutate(selectedParcel);
  };

  const error = [unclaimedQuery.error, claimMutation.error].find((item) => item instanceof Error);

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
            <strong>无主包裹认领</strong>
            <span>Masked parcel claim queue</span>
          </div>
        </div>
        <button className={styles.iconButton} type="button" aria-label="刷新无主包裹" onClick={invalidateUnclaimed}>
          <ReloadOutlined />
        </button>
      </header>

      {notice && <div className={styles.notice}>{notice}</div>}
      {error && <div className={styles.alert}>{getErrorMessage(error)}</div>}

      <section className={styles.summary}>
        <article className={styles.metric}>
          <span>可认领</span>
          <strong>{availableCount}</strong>
        </article>
        <article className={styles.metric}>
          <span>我的待审</span>
          <strong>{pendingMine}</strong>
        </article>
        <article className={styles.metric}>
          <span>当前结果</span>
          <strong>{unclaimedParcels.length}</strong>
        </article>
      </section>

      <section className={styles.workspace}>
        <div className={styles.listPanel}>
          <div className={styles.listHead}>
            <div>
              <h1>无主包裹</h1>
              <p>仅展示脱敏单号和基础入库信息。</p>
            </div>
            <FileSearchOutlined />
          </div>

          <input
            className={styles.searchInput}
            value={keyword}
            placeholder="输入快递单号关键字"
            onChange={(event) => setKeyword(event.target.value)}
          />

          {unclaimedQuery.isLoading && <div className={styles.empty}>加载无主包裹...</div>}
          {!unclaimedQuery.isLoading && unclaimedParcels.length === 0 && (
            <div className={styles.empty}>暂无匹配无主包裹</div>
          )}
          {!unclaimedQuery.isLoading && unclaimedParcels.length > 0 && (
            <div className={styles.records}>
              {unclaimedParcels.map((parcel) => (
                <button
                  key={parcel.id}
                  type="button"
                  className={`${styles.record} ${selectedParcel?.id === parcel.id ? styles.activeRecord : ""}`}
                  onClick={() => setSelectedId(parcel.id)}
                >
                  <span>
                    <strong>{parcel.tracking_no_masked}</strong>
                    <small>{parcel.warehouse_name}</small>
                  </span>
                  {statusBadge(parcel.status)}
                </button>
              ))}
            </div>
          )}
        </div>

        <aside className={styles.detailPanel}>
          <div className={styles.listHead}>
            <div>
              <h2>认领资料</h2>
              <p>{selectedParcel ? selectedParcel.tracking_no_masked : "选择记录后提交"}</p>
            </div>
            {selectedParcel && statusBadge(selectedParcel.status)}
          </div>

          {!selectedParcel && <div className={styles.empty}>暂无可认领记录</div>}
          {selectedParcel && (
            <>
              <dl className={styles.detailList}>
                <div>
                  <dt>脱敏单号</dt>
                  <dd>{selectedParcel.tracking_no_masked}</dd>
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
                  <dt>登记时间</dt>
                  <dd>{formatDate(selectedParcel.created_at)}</dd>
                </div>
              </dl>

              {selectedParcel.status === "UNCLAIMED" ? (
                <form className={styles.claimForm} onSubmit={handleClaim}>
                  <label>
                    联系方式
                    <input
                      value={claimContact}
                      maxLength={120}
                      placeholder="手机号 / 邮箱 / 微信"
                      onChange={(event) => setClaimContact(event.target.value)}
                    />
                  </label>
                  <label>
                    认领说明
                    <textarea
                      value={claimNote}
                      maxLength={1000}
                      placeholder="补充商品、寄件人或下单信息"
                      onChange={(event) => setClaimNote(event.target.value)}
                    />
                  </label>
                  <button className={styles.primaryButton} type="submit" disabled={claimMutation.isPending}>
                    <SendOutlined />
                    {claimMutation.isPending ? "提交中" : "提交认领"}
                  </button>
                </form>
              ) : (
                <div className={styles.stateBox}>
                  {selectedParcel.is_mine ? "该记录已在你的认领流程中。" : "该记录当前不可认领。"}
                </div>
              )}
            </>
          )}
        </aside>
      </section>
    </main>
  );
}
