import { DotLoading, Empty, ErrorBlock, Toast } from "antd-mobile";
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

function StatusPill({ status }: { status: UnclaimedParcelStatus }) {
  const meta = statusMeta[status];
  return <span className={`${styles.statusPill} ${styles[meta.tone]}`}>{meta.label}</span>;
}

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : "请刷新后重试";
}

export function UnclaimedParcelsPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [keyword, setKeyword] = useState("");
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [claimContact, setClaimContact] = useState("");
  const [claimNote, setClaimNote] = useState("");

  const unclaimedQuery = useQuery({
    queryKey: ["mobile", "member", "unclaimed-parcels", keyword.trim()],
    queryFn: () => fetchUnclaimedParcels(keyword),
  });

  const unclaimedParcels = useMemo(() => unclaimedQuery.data ?? [], [unclaimedQuery.data]);
  const selectedParcel = useMemo(
    () => unclaimedParcels.find((parcel) => parcel.id === selectedId) ?? unclaimedParcels[0] ?? null,
    [selectedId, unclaimedParcels],
  );
  const availableCount = unclaimedParcels.filter((parcel) => parcel.status === "UNCLAIMED").length;
  const pendingMine = unclaimedParcels.filter((parcel) => parcel.is_mine && parcel.status === "CLAIM_PENDING").length;

  const invalidateUnclaimed = () =>
    queryClient.invalidateQueries({ queryKey: ["mobile", "member", "unclaimed-parcels"] });

  const claimMutation = useMutation({
    mutationFn: (parcel: PublicUnclaimedParcel) =>
      claimUnclaimedParcel(parcel.id, {
        claim_contact: claimContact.trim(),
        claim_note: claimNote.trim(),
      }),
    onSuccess: (parcel) => {
      setSelectedId(parcel.id);
      setClaimContact("");
      setClaimNote("");
      invalidateUnclaimed();
      Toast.show(`${parcel.tracking_no_masked} 已提交认领`);
    },
    onError: (error) => Toast.show(errorMessage(error)),
  });

  const handleClaim = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (selectedParcel?.status !== "UNCLAIMED") {
      return;
    }
    claimMutation.mutate(selectedParcel);
  };

  return (
    <main className={styles.page}>
      <header className={styles.top}>
        <button type="button" onClick={() => navigate("/ship")}>
          返回
        </button>
        <div>
          <span>Claim</span>
          <h1>无主认领</h1>
        </div>
        <button type="button" onClick={invalidateUnclaimed}>
          刷新
        </button>
      </header>

      <section className={styles.summary}>
        <div>
          <span>可认领</span>
          <strong>{availableCount}</strong>
        </div>
        <div>
          <span>我的待审</span>
          <strong>{pendingMine}</strong>
        </div>
        <div>
          <span>结果</span>
          <strong>{unclaimedParcels.length}</strong>
        </div>
      </section>

      <input
        className={styles.searchInput}
        value={keyword}
        placeholder="输入快递单号关键字"
        onChange={(event) => setKeyword(event.target.value)}
      />

      {unclaimedQuery.isLoading && (
        <div className={styles.loading}>
          <DotLoading />
          <span>加载无主包裹</span>
        </div>
      )}

      {unclaimedQuery.isError && (
        <ErrorBlock status="default" title="无主包裹加载失败" description={errorMessage(unclaimedQuery.error)} />
      )}

      {!unclaimedQuery.isLoading && !unclaimedQuery.isError && unclaimedParcels.length === 0 && (
        <Empty description="暂无匹配无主包裹" />
      )}

      {!unclaimedQuery.isLoading && !unclaimedQuery.isError && unclaimedParcels.length > 0 && (
        <section className={styles.list}>
          {unclaimedParcels.map((parcel) => (
            <button
              key={parcel.id}
              type="button"
              className={`${styles.claimCard} ${selectedParcel?.id === parcel.id ? styles.selected : ""}`}
              onClick={() => setSelectedId(parcel.id)}
            >
              <div>
                <strong>{parcel.tracking_no_masked}</strong>
                <span>{parcel.warehouse_name}</span>
              </div>
              <StatusPill status={parcel.status} />
              <small>{formatWeight(parcel.weight_kg)}</small>
            </button>
          ))}
        </section>
      )}

      {selectedParcel && (
        <section className={styles.detail}>
          <div className={styles.detailHead}>
            <div>
              <span>认领资料</span>
              <h2>{selectedParcel.tracking_no_masked}</h2>
            </div>
            <StatusPill status={selectedParcel.status} />
          </div>
          <dl>
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
            <div>
              <dt>状态</dt>
              <dd>{statusMeta[selectedParcel.status].label}</dd>
            </div>
          </dl>

          {selectedParcel.status === "UNCLAIMED" ? (
            <form className={styles.form} onSubmit={handleClaim}>
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
              <button type="submit" disabled={claimMutation.isPending}>
                {claimMutation.isPending ? "提交中" : "提交认领"}
              </button>
            </form>
          ) : (
            <div className={styles.stateBox}>
              {selectedParcel.is_mine ? "该记录已在你的认领流程中。" : "该记录当前不可认领。"}
            </div>
          )}
        </section>
      )}
    </main>
  );
}
