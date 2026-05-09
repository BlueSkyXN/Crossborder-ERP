import { useMutation } from "@tanstack/react-query";
import { FormEvent, useState } from "react";

import { requestData } from "../../api/client";
import styles from "./FreightEstimateCard.module.css";

type FreightEstimatePayload = {
  channel_id: number;
  weight_kg: number;
  length_cm?: number;
  width_cm?: number;
  height_cm?: number;
};

type FreightEstimateResult = {
  channel_code?: string;
  channel_name: string;
  actual_weight_kg?: string;
  volumetric_weight_kg?: string;
  billable_weight_kg: string;
  fee: string | null;
  currency: string;
  rate_plan?: string;
  error?: string | null;
};

const demoChannels = [
  { id: 1, name: "测试空运" },
  { id: 2, name: "测试海运" },
];

function toOptionalNumber(value: string) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : undefined;
}

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : "运费估算失败，请稍后再试。";
}

export function FreightEstimateCard() {
  const [channelId, setChannelId] = useState(String(demoChannels[0].id));
  const [weightKg, setWeightKg] = useState("");
  const [lengthCm, setLengthCm] = useState("");
  const [widthCm, setWidthCm] = useState("");
  const [heightCm, setHeightCm] = useState("");
  const [validationError, setValidationError] = useState("");

  const estimateMutation = useMutation({
    mutationFn: (payload: FreightEstimatePayload) =>
      requestData<FreightEstimateResult>({
        method: "POST",
        url: "/freight/estimate",
        data: payload,
      }),
  });

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();
    const numericWeight = Number(weightKg);
    if (!Number.isFinite(numericWeight) || numericWeight <= 0) {
      setValidationError("请输入大于 0 的包裹重量。");
      return;
    }
    setValidationError("");
    estimateMutation.mutate({
      channel_id: Number(channelId),
      weight_kg: numericWeight,
      length_cm: toOptionalNumber(lengthCm),
      width_cm: toOptionalNumber(widthCm),
      height_cm: toOptionalNumber(heightCm),
    });
  };

  const result = estimateMutation.data;
  const apiError = result?.error;

  return (
    <article className={styles.card}>
      <div className={styles.sectionTitle}>
        <h2>运费估算</h2>
        <p>填写重量和体积，快速预估国际运费。</p>
      </div>
      <form className={styles.form} onSubmit={handleSubmit}>
        <label>
          运输渠道
          <select value={channelId} onChange={(event) => setChannelId(event.target.value)}>
            {demoChannels.map((channel) => (
              <option key={channel.id} value={channel.id}>
                {channel.name}
              </option>
            ))}
          </select>
        </label>
        <label>
          重量（kg）
          <input
            min="0.01"
            step="0.01"
            type="number"
            value={weightKg}
            onChange={(event) => setWeightKg(event.target.value)}
            placeholder="例如 1.20"
          />
        </label>
        <div className={styles.dimensions}>
          <label>
            长（cm，可选）
            <input
              min="0"
              step="0.1"
              type="number"
              value={lengthCm}
              onChange={(event) => setLengthCm(event.target.value)}
              placeholder="长"
            />
          </label>
          <label>
            宽（cm，可选）
            <input
              min="0"
              step="0.1"
              type="number"
              value={widthCm}
              onChange={(event) => setWidthCm(event.target.value)}
              placeholder="宽"
            />
          </label>
          <label>
            高（cm，可选）
            <input
              min="0"
              step="0.1"
              type="number"
              value={heightCm}
              onChange={(event) => setHeightCm(event.target.value)}
              placeholder="高"
            />
          </label>
        </div>
        <button className={styles.submitButton} type="submit" disabled={estimateMutation.isPending}>
          {estimateMutation.isPending ? "估算中..." : "估算运费"}
        </button>
      </form>

      {validationError && <div className={styles.error}>{validationError}</div>}
      {estimateMutation.isError && <div className={styles.error}>{getErrorMessage(estimateMutation.error)}</div>}
      {apiError && <div className={styles.error}>{apiError}</div>}
      {result && !apiError && (
        <div className={styles.result}>
          <dl>
            <div>
              <dt>运输渠道</dt>
              <dd>{result.channel_name}</dd>
            </div>
            <div>
              <dt>计费重量</dt>
              <dd>{result.billable_weight_kg} kg</dd>
            </div>
            <div>
              <dt>预估费用</dt>
              <dd>
                {result.currency} {result.fee ?? "0.00"}
              </dd>
            </div>
            <div>
              <dt>计费方案</dt>
              <dd>{result.rate_plan || "-"}</dd>
            </div>
          </dl>
        </div>
      )}
    </article>
  );
}
