import {
  CheckCircleOutlined,
  ClockCircleOutlined,
  DeleteOutlined,
  DollarOutlined,
  EyeOutlined,
  InboxOutlined,
  LinkOutlined,
  LockOutlined,
  PlusOutlined,
  PrinterOutlined,
  ReloadOutlined,
  SearchOutlined,
  SendOutlined,
  WalletOutlined,
} from "@ant-design/icons";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Alert,
  App as AntdApp,
  Button,
  Card,
  Col,
  Descriptions,
  Drawer,
  Empty,
  Form,
  Input,
  InputNumber,
  Modal,
  Popconfirm,
  Row,
  Select,
  Space,
  Statistic,
  Table,
  Tabs,
  Tag,
  Timeline,
  Typography,
} from "antd";
import type { TableColumnsType } from "antd";
import { useMemo, useState } from "react";
import { useOutletContext } from "react-router-dom";

import { ForbiddenPage } from "../../pages/ForbiddenPage";
import { waybillOpsApi } from "./api";
import type {
  TrackingEvent,
  ShippingBatch,
  ShippingBatchPrintPreview,
  ShippingBatchPrintTemplate,
  ShippingBatchStatus,
  Waybill,
  WaybillStatus,
  WaybillTrackingPayload,
} from "./types";

type WorkspaceContext = {
  allowedCodes: Set<string>;
};

type ActiveStatus = "ALL" | WaybillStatus;
type ActionType = "review" | "fee" | "recharge" | "ship" | "tracking";
type BatchActionType = "create" | "addWaybills" | "ship" | "tracking";

type ActionState = {
  type: ActionType;
  waybillId: number;
};

type BatchActionState = {
  type: BatchActionType;
  batchId?: number;
};

type ReviewFormValues = {
  review_remark?: string;
};

type FeeFormValues = {
  fee_total?: number;
  freight?: number;
  packing?: number;
  service?: number;
  fee_detail_note?: string;
  fee_remark?: string;
};

type RechargeFormValues = {
  amount?: number;
  remark?: string;
};

type TrackingFormValues = {
  status_text?: string;
  location?: string;
  description?: string;
};

type BatchFormValues = {
  name?: string;
  carrier_batch_no?: string;
  transfer_no?: string;
  ship_note?: string;
  waybill_ids?: number[];
};

const waybillsQueryKey = ["admin-waybills"] as const;
const shippingBatchesQueryKey = ["admin-shipping-batches"] as const;
const walletTransactionsQueryKey = ["admin-wallet-transactions"] as const;
const paymentOrdersQueryKey = ["admin-payment-orders"] as const;

const waybillStatusMeta: Record<WaybillStatus, { color: string; label: string }> = {
  PENDING_REVIEW: { color: "gold", label: "待审核" },
  PENDING_PACKING: { color: "blue", label: "待打包" },
  PENDING_PAYMENT: { color: "orange", label: "待付款" },
  PENDING_SHIPMENT: { color: "cyan", label: "待发货" },
  SHIPPED: { color: "purple", label: "已发货" },
  SIGNED: { color: "green", label: "已签收" },
  CANCELLED: { color: "default", label: "已取消" },
  PROBLEM: { color: "red", label: "问题单" },
};

const statusTabs: { key: ActiveStatus; label: string }[] = [
  { key: "ALL", label: "全部" },
  { key: "PENDING_REVIEW", label: "待审核" },
  { key: "PENDING_PACKING", label: "待打包" },
  { key: "PENDING_PAYMENT", label: "待付款" },
  { key: "PENDING_SHIPMENT", label: "待发货" },
  { key: "SHIPPED", label: "已发货" },
  { key: "SIGNED", label: "已签收" },
  { key: "CANCELLED", label: "已取消" },
  { key: "PROBLEM", label: "问题单" },
];

const transactionTypeMeta: Record<string, { color: string; label: string }> = {
  ADMIN_RECHARGE: { color: "green", label: "后台充值" },
  ADMIN_DEDUCT: { color: "red", label: "后台扣减" },
  WAYBILL_PAYMENT: { color: "blue", label: "运费支付" },
  PURCHASE_PAYMENT: { color: "purple", label: "代购支付" },
  REFUND: { color: "cyan", label: "退款" },
  ADJUSTMENT: { color: "gold", label: "余额调整" },
};

const shippingBatchStatusMeta: Record<ShippingBatchStatus, { color: string; label: string }> = {
  DRAFT: { color: "gold", label: "草稿" },
  LOCKED: { color: "blue", label: "已锁定" },
  SHIPPED: { color: "purple", label: "已发货" },
  CANCELLED: { color: "default", label: "已取消" },
};

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : "请求失败";
}

function statusTag(status: WaybillStatus) {
  const meta = waybillStatusMeta[status];
  return <Tag color={meta.color}>{meta.label}</Tag>;
}

function transactionTag(type: string) {
  const meta = transactionTypeMeta[type] || { color: "default", label: type };
  return <Tag color={meta.color}>{meta.label}</Tag>;
}

function shippingBatchStatusTag(status: ShippingBatchStatus) {
  const meta = shippingBatchStatusMeta[status];
  return <Tag color={meta.color}>{meta.label}</Tag>;
}

function normalizeText(value: unknown) {
  return value === undefined || value === null ? "" : String(value).toLowerCase();
}

function filterRows<T>(rows: T[], keyword: string, pickText: (row: T) => unknown[]) {
  const normalized = keyword.trim().toLowerCase();
  if (!normalized) {
    return rows;
  }
  return rows.filter((row) => pickText(row).map(normalizeText).join(" ").includes(normalized));
}

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

function toDecimalString(value?: number, fractionDigits = 2) {
  if (value === undefined || value === null) {
    return undefined;
  }
  return value.toFixed(fractionDigits);
}

function snapshotText(snapshot: Record<string, unknown>, key: string) {
  const value = snapshot[key];
  return value === undefined || value === null || value === "" ? "-" : String(value);
}

function buildFeePayload(values: FeeFormValues) {
  const feeDetail: Record<string, string> = {};
  const freight = toDecimalString(values.freight);
  const packing = toDecimalString(values.packing);
  const service = toDecimalString(values.service);
  if (freight) {
    feeDetail.freight = freight;
  }
  if (packing) {
    feeDetail.packing = packing;
  }
  if (service) {
    feeDetail.service = service;
  }
  if (values.fee_detail_note?.trim()) {
    feeDetail.note = values.fee_detail_note.trim();
  }
  return {
    fee_total: toDecimalString(values.fee_total) || "0.00",
    fee_detail_json: feeDetail,
    fee_remark: values.fee_remark?.trim() || "",
  };
}

function buildRechargePayload(values: RechargeFormValues) {
  return {
    amount: toDecimalString(values.amount) || "0.00",
    currency: "CNY",
    remark: values.remark?.trim() || "",
  };
}

function buildTrackingPayload(values: TrackingFormValues): WaybillTrackingPayload {
  return {
    status_text: String(values.status_text || "").trim(),
    location: values.location?.trim() || "",
    description: values.description?.trim() || "",
  };
}

function buildBatchPayload(values: BatchFormValues) {
  return {
    name: values.name?.trim() || "",
    carrier_batch_no: values.carrier_batch_no?.trim() || "",
    transfer_no: values.transfer_no?.trim() || "",
    ship_note: values.ship_note?.trim() || "",
    waybill_ids: values.waybill_ids || [],
  };
}

function trackingSourceLabel(source: TrackingEvent["source"]) {
  if (source === "MEMBER") {
    return "会员";
  }
  if (source === "SYSTEM") {
    return "系统";
  }
  return "人工";
}

function buildOperationTimeline(waybill: Waybill) {
  const items = [
    { time: waybill.created_at, label: "用户提交运单", note: waybill.user_email },
    { time: waybill.reviewed_at, label: "后台审核通过", note: waybill.reviewed_by_name || waybill.review_remark },
    { time: waybill.fee_set_at, label: "后台设置费用", note: formatMoney(waybill.fee_total) },
    { time: waybill.paid_at, label: "用户完成支付", note: waybill.waybill_no },
    { time: waybill.shipped_at, label: "后台确认发货", note: waybill.warehouse_name },
    { time: waybill.signed_at, label: "用户确认签收", note: waybill.destination_country },
  ].filter((item) => item.time);

  return items.map((item) => ({
    children: (
      <Space orientation="vertical" size={0}>
        <Typography.Text strong>{item.label}</Typography.Text>
        <Typography.Text type="secondary">{`${formatDate(item.time)} / ${item.note || "-"}`}</Typography.Text>
      </Space>
    ),
  }));
}

export function WaybillOpsPage() {
  const { allowedCodes } = useOutletContext<WorkspaceContext>();
  const queryClient = useQueryClient();
  const { message } = AntdApp.useApp();
  const [reviewForm] = Form.useForm<ReviewFormValues>();
  const [feeForm] = Form.useForm<FeeFormValues>();
  const [rechargeForm] = Form.useForm<RechargeFormValues>();
  const [trackingForm] = Form.useForm<TrackingFormValues>();
  const [batchForm] = Form.useForm<BatchFormValues>();
  const [activeStatus, setActiveStatus] = useState<ActiveStatus>("ALL");
  const [keyword, setKeyword] = useState("");
  const [detailWaybillId, setDetailWaybillId] = useState<number | null>(null);
  const [detailBatchId, setDetailBatchId] = useState<number | null>(null);
  const [action, setAction] = useState<ActionState | null>(null);
  const [batchAction, setBatchAction] = useState<BatchActionState | null>(null);
  const [printTemplate, setPrintTemplate] = useState<ShippingBatchPrintTemplate>("label");
  const [printPreview, setPrintPreview] = useState<ShippingBatchPrintPreview | null>(null);
  const hasFinancePermission = allowedCodes.has("finance.view");

  const waybillsQuery = useQuery({
    queryKey: waybillsQueryKey,
    queryFn: waybillOpsApi.listWaybills,
  });
  const shippingBatchesQuery = useQuery({
    queryKey: shippingBatchesQueryKey,
    queryFn: waybillOpsApi.listShippingBatches,
  });
  const walletTransactionsQuery = useQuery({
    queryKey: walletTransactionsQueryKey,
    queryFn: waybillOpsApi.listWalletTransactions,
    enabled: hasFinancePermission,
  });
  const paymentOrdersQuery = useQuery({
    queryKey: paymentOrdersQueryKey,
    queryFn: waybillOpsApi.listPaymentOrders,
    enabled: hasFinancePermission,
  });

  const waybills = useMemo(() => waybillsQuery.data ?? [], [waybillsQuery.data]);
  const shippingBatches = useMemo(() => shippingBatchesQuery.data ?? [], [shippingBatchesQuery.data]);
  const walletTransactions = useMemo(
    () => walletTransactionsQuery.data ?? [],
    [walletTransactionsQuery.data],
  );
  const paymentOrders = useMemo(() => paymentOrdersQuery.data ?? [], [paymentOrdersQuery.data]);
  const detailWaybill = useMemo(
    () => waybills.find((waybill) => waybill.id === detailWaybillId) || null,
    [detailWaybillId, waybills],
  );
  const detailBatch = useMemo(
    () => shippingBatches.find((batch) => batch.id === detailBatchId) || null,
    [detailBatchId, shippingBatches],
  );
  const actionWaybill = useMemo(
    () => waybills.find((waybill) => waybill.id === action?.waybillId) || null,
    [action?.waybillId, waybills],
  );
  const actionBatch = useMemo(
    () => shippingBatches.find((batch) => batch.id === batchAction?.batchId) || null,
    [batchAction?.batchId, shippingBatches],
  );
  const batchCandidateWaybills = useMemo(() => {
    const currentBatchWaybillIds = new Set(actionBatch?.waybills.map((waybill) => waybill.id) || []);
    return waybills.filter(
      (waybill) =>
        waybill.status === "PENDING_SHIPMENT" &&
        (!waybill.shipping_batch || currentBatchWaybillIds.has(waybill.id)) &&
        (!actionBatch?.warehouse || waybill.warehouse === actionBatch.warehouse) &&
        (!actionBatch?.channel || waybill.channel === actionBatch.channel),
    );
  }, [actionBatch, waybills]);

  const statusCounts = useMemo(() => {
    const counts = Object.fromEntries(statusTabs.map((tab) => [tab.key, 0])) as Record<ActiveStatus, number>;
    counts.ALL = waybills.length;
    waybills.forEach((waybill) => {
      counts[waybill.status] = (counts[waybill.status] || 0) + 1;
    });
    return counts;
  }, [waybills]);

  const filteredWaybills = useMemo(() => {
    const statusRows =
      activeStatus === "ALL" ? waybills : waybills.filter((waybill) => waybill.status === activeStatus);
    return filterRows(statusRows, keyword, (row) => [
      row.waybill_no,
      row.user_email,
      row.warehouse_name,
      row.channel_name,
      row.destination_country,
      row.parcels.map((parcel) => `${parcel.parcel_no} ${parcel.tracking_no}`).join(" "),
    ]);
  }, [activeStatus, keyword, waybills]);

  const replaceWaybillInCache = (nextWaybill: Waybill) => {
    queryClient.setQueryData<Waybill[]>(waybillsQueryKey, (current = []) =>
      current.map((waybill) => (waybill.id === nextWaybill.id ? nextWaybill : waybill)),
    );
  };

  const invalidateWaybills = () => {
    queryClient.invalidateQueries({ queryKey: waybillsQueryKey });
  };

  const invalidateShippingBatches = () => {
    queryClient.invalidateQueries({ queryKey: shippingBatchesQueryKey });
    invalidateWaybills();
  };

  const invalidateFinance = () => {
    queryClient.invalidateQueries({ queryKey: walletTransactionsQueryKey });
    queryClient.invalidateQueries({ queryKey: paymentOrdersQueryKey });
  };

  const closeAction = () => {
    setAction(null);
  };

  const closeBatchAction = () => {
    setBatchAction(null);
  };

  const openAction = (type: ActionType, waybill: Waybill) => {
    setAction({ type, waybillId: waybill.id });
    if (type === "review") {
      reviewForm.resetFields();
      reviewForm.setFieldsValue({ review_remark: waybill.review_remark || "" });
    }
    if (type === "fee") {
      feeForm.resetFields();
      feeForm.setFieldsValue({
        fee_total: Number(waybill.fee_total || 0) || undefined,
        fee_remark: waybill.fee_remark || "",
      });
    }
    if (type === "recharge") {
      rechargeForm.resetFields();
      rechargeForm.setFieldsValue({
        amount: Number(waybill.fee_total || 0) || undefined,
        remark: `${waybill.waybill_no} 运费充值`,
      });
    }
    if (type === "ship") {
      trackingForm.resetFields();
      trackingForm.setFieldsValue({ status_text: "已发货", location: "", description: "" });
    }
    if (type === "tracking") {
      trackingForm.resetFields();
      trackingForm.setFieldsValue({ status_text: "运输中", location: "", description: "" });
    }
  };

  const openBatchAction = (type: BatchActionType, batch?: ShippingBatch) => {
    setBatchAction({ type, batchId: batch?.id });
    batchForm.resetFields();
    trackingForm.resetFields();
    if (type === "addWaybills" && batch) {
      batchForm.setFieldsValue({ waybill_ids: [] });
    }
    if (type === "ship") {
      trackingForm.setFieldsValue({ status_text: "批次已发货", location: "", description: "" });
    }
    if (type === "tracking") {
      trackingForm.setFieldsValue({ status_text: "运输中", location: "", description: "" });
    }
  };

  const reviewMutation = useMutation({
    mutationFn: ({ waybillId, payload }: { waybillId: number; payload: ReviewFormValues }) =>
      waybillOpsApi.reviewWaybill(waybillId, payload),
    onSuccess: (waybill) => {
      replaceWaybillInCache(waybill);
      invalidateWaybills();
      closeAction();
      message.success(`${waybill.waybill_no} 已审核`);
    },
    onError: (error) => message.error(getErrorMessage(error)),
  });

  const feeMutation = useMutation({
    mutationFn: ({ waybillId, payload }: { waybillId: number; payload: ReturnType<typeof buildFeePayload> }) =>
      waybillOpsApi.setWaybillFee(waybillId, payload),
    onSuccess: (waybill) => {
      replaceWaybillInCache(waybill);
      invalidateWaybills();
      closeAction();
      message.success(`${waybill.waybill_no} 已进入待付款`);
    },
    onError: (error) => message.error(getErrorMessage(error)),
  });

  const rechargeMutation = useMutation({
    mutationFn: ({ userId, payload }: { userId: number; payload: ReturnType<typeof buildRechargePayload> }) =>
      waybillOpsApi.rechargeWallet(userId, payload),
    onSuccess: (transaction) => {
      invalidateFinance();
      closeAction();
      message.success(`充值完成，余额 ${transaction.balance_after}`);
    },
    onError: (error) => message.error(getErrorMessage(error)),
  });

  const shipMutation = useMutation({
    mutationFn: ({ waybillId, payload }: { waybillId: number; payload: WaybillTrackingPayload }) =>
      waybillOpsApi.shipWaybill(waybillId, payload),
    onSuccess: (waybill) => {
      replaceWaybillInCache(waybill);
      invalidateWaybills();
      closeAction();
      message.success(`${waybill.waybill_no} 已发货`);
    },
    onError: (error) => message.error(getErrorMessage(error)),
  });

  const trackingMutation = useMutation({
    mutationFn: ({ waybillId, payload }: { waybillId: number; payload: WaybillTrackingPayload }) =>
      waybillOpsApi.addTrackingEvent(waybillId, payload),
    onSuccess: (event) => {
      queryClient.setQueryData<Waybill[]>(waybillsQueryKey, (current = []) =>
        current.map((waybill) =>
          waybill.id === event.waybill
            ? { ...waybill, tracking_events: [...waybill.tracking_events, event] }
            : waybill,
        ),
      );
      invalidateWaybills();
      closeAction();
      message.success("轨迹已添加");
    },
    onError: (error) => message.error(getErrorMessage(error)),
  });

  const createBatchMutation = useMutation({
    mutationFn: waybillOpsApi.createShippingBatch,
    onSuccess: (batch) => {
      invalidateShippingBatches();
      setDetailBatchId(batch.id);
      closeBatchAction();
      message.success(`${batch.batch_no} 已创建`);
    },
    onError: (error) => message.error(getErrorMessage(error)),
  });

  const addBatchWaybillsMutation = useMutation({
    mutationFn: ({ batchId, waybillIds }: { batchId: number; waybillIds: number[] }) =>
      waybillOpsApi.addWaybillsToShippingBatch(batchId, { waybill_ids: waybillIds }),
    onSuccess: (batch) => {
      invalidateShippingBatches();
      setDetailBatchId(batch.id);
      closeBatchAction();
      message.success("运单已归批");
    },
    onError: (error) => message.error(getErrorMessage(error)),
  });

  const removeBatchWaybillMutation = useMutation({
    mutationFn: ({ batchId, waybillId }: { batchId: number; waybillId: number }) =>
      waybillOpsApi.removeWaybillFromShippingBatch(batchId, waybillId),
    onSuccess: (batch) => {
      invalidateShippingBatches();
      setDetailBatchId(batch.id);
      message.success("运单已移出批次");
    },
    onError: (error) => message.error(getErrorMessage(error)),
  });

  const lockBatchMutation = useMutation({
    mutationFn: waybillOpsApi.lockShippingBatch,
    onSuccess: (batch) => {
      invalidateShippingBatches();
      setDetailBatchId(batch.id);
      message.success(`${batch.batch_no} 已锁定`);
    },
    onError: (error) => message.error(getErrorMessage(error)),
  });

  const shipBatchMutation = useMutation({
    mutationFn: ({ batchId, payload }: { batchId: number; payload: WaybillTrackingPayload }) =>
      waybillOpsApi.shipShippingBatch(batchId, payload),
    onSuccess: (batch) => {
      invalidateShippingBatches();
      setDetailBatchId(batch.id);
      closeBatchAction();
      message.success(`${batch.batch_no} 已批量发货`);
    },
    onError: (error) => message.error(getErrorMessage(error)),
  });

  const batchTrackingMutation = useMutation({
    mutationFn: ({ batchId, payload }: { batchId: number; payload: WaybillTrackingPayload }) =>
      waybillOpsApi.addShippingBatchTrackingEvent(batchId, payload),
    onSuccess: () => {
      invalidateShippingBatches();
      closeBatchAction();
      message.success("批量轨迹已添加");
    },
    onError: (error) => message.error(getErrorMessage(error)),
  });

  const printPreviewMutation = useMutation({
    mutationFn: ({ batchId, template }: { batchId: number; template: ShippingBatchPrintTemplate }) =>
      waybillOpsApi.getShippingBatchPrintPreview(batchId, template),
    onSuccess: (preview) => setPrintPreview(preview),
    onError: (error) => message.error(getErrorMessage(error)),
  });

  const renderActionButtons = (waybill: Waybill) => (
    <Space size={4} wrap>
      <Button size="small" title="查看详情" icon={<EyeOutlined />} onClick={() => setDetailWaybillId(waybill.id)} />
      {waybill.status === "PENDING_REVIEW" && (
        <Button
          size="small"
          type="primary"
          title="审核"
          icon={<CheckCircleOutlined />}
          onClick={() => openAction("review", waybill)}
        />
      )}
      {waybill.status === "PENDING_PACKING" && (
        <Button
          size="small"
          type="primary"
          title="设置费用"
          icon={<DollarOutlined />}
          onClick={() => openAction("fee", waybill)}
        />
      )}
      {waybill.status === "PENDING_PAYMENT" && (
        <Button
          size="small"
          title={hasFinancePermission ? "人工充值" : "需要 finance.view 权限"}
          icon={<WalletOutlined />}
          disabled={!hasFinancePermission}
          onClick={() => openAction("recharge", waybill)}
        />
      )}
      {waybill.status === "PENDING_SHIPMENT" && (
        <Button
          size="small"
          type="primary"
          title="发货"
          icon={<SendOutlined />}
          onClick={() => openAction("ship", waybill)}
        />
      )}
      {waybill.status === "SHIPPED" && (
        <Button
          size="small"
          title="添加轨迹"
          icon={<PlusOutlined />}
          onClick={() => openAction("tracking", waybill)}
        />
      )}
    </Space>
  );

  const columns: TableColumnsType<Waybill> = [
    {
      title: "运单号",
      dataIndex: "waybill_no",
      width: 150,
      render: (value: string) => <Typography.Text copyable strong>{value}</Typography.Text>,
    },
    { title: "会员", dataIndex: "user_email", width: 210 },
    { title: "状态", dataIndex: "status", width: 120, render: statusTag },
    { title: "仓库", dataIndex: "warehouse_name", width: 140 },
    {
      title: "渠道",
      dataIndex: "channel_name",
      width: 150,
      render: (value: string | null) => value || "-",
    },
    { title: "目的地", dataIndex: "destination_country", width: 100 },
    {
      title: "费用",
      dataIndex: "fee_total",
      width: 120,
      render: (value: string) => formatMoney(value),
    },
    { title: "创建时间", dataIndex: "created_at", width: 180, render: formatDate },
    {
      title: "操作",
      width: 230,
      fixed: "right",
      render: (_, record) => renderActionButtons(record),
    },
  ];

  const batchColumns: TableColumnsType<ShippingBatch> = [
    {
      title: "批次号",
      dataIndex: "batch_no",
      width: 150,
      render: (value: string) => <Typography.Text copyable strong>{value}</Typography.Text>,
    },
    { title: "名称", dataIndex: "name", width: 160, render: (value: string) => value || "-" },
    { title: "状态", dataIndex: "status", width: 110, render: shippingBatchStatusTag },
    { title: "仓库", dataIndex: "warehouse_name", width: 130, render: (value: string | null) => value || "-" },
    { title: "渠道", dataIndex: "channel_name", width: 130, render: (value: string | null) => value || "-" },
    { title: "承运商批次号", dataIndex: "carrier_batch_no", width: 150, render: (value: string) => value || "-" },
    { title: "转单号", dataIndex: "transfer_no", width: 150, render: (value: string) => value || "-" },
    { title: "运单数", dataIndex: "waybill_count", width: 90 },
    { title: "创建时间", dataIndex: "created_at", width: 180, render: formatDate },
    {
      title: "操作",
      width: 260,
      fixed: "right",
      render: (_, record) => (
        <Space size={4} wrap>
          <Button size="small" title="查看详情" icon={<EyeOutlined />} onClick={() => setDetailBatchId(record.id)} />
          {record.status === "DRAFT" && (
            <>
              <Button
                size="small"
                title="归批"
                icon={<LinkOutlined />}
                onClick={() => openBatchAction("addWaybills", record)}
              />
              <Button
                size="small"
                type="primary"
                title="锁定批次"
                icon={<LockOutlined />}
                loading={lockBatchMutation.isPending}
                onClick={() => lockBatchMutation.mutate(record.id)}
              />
            </>
          )}
          {record.status === "LOCKED" && (
            <Button
              size="small"
              type="primary"
              title="批量发货"
              icon={<SendOutlined />}
              onClick={() => openBatchAction("ship", record)}
            />
          )}
          {(record.status === "LOCKED" || record.status === "SHIPPED") && (
            <Button
              size="small"
              title="批量轨迹"
              icon={<PlusOutlined />}
              onClick={() => openBatchAction("tracking", record)}
            />
          )}
          <Button
            size="small"
            title="打印预览"
            icon={<PrinterOutlined />}
            onClick={() => printPreviewMutation.mutate({ batchId: record.id, template: "handover" })}
          />
        </Space>
      ),
    },
  ];

  const detailWalletTransactions = detailWaybill
    ? walletTransactions.filter((transaction) => transaction.user === detailWaybill.user)
    : [];
  const detailPaymentOrders = detailWaybill
    ? paymentOrders.filter(
        (paymentOrder) =>
          paymentOrder.business_type === "WAYBILL" && paymentOrder.business_id === detailWaybill.id,
      )
    : [];

  if (!allowedCodes.has("waybills.view")) {
    return <ForbiddenPage />;
  }

  return (
    <Space orientation="vertical" size={16} className="workspace-page waybill-ops-page">
      <div className="page-heading">
        <div>
          <Typography.Title level={2}>运单处理</Typography.Title>
          <Typography.Paragraph>审核、计费、人工充值、发货批次和物流轨迹录入。</Typography.Paragraph>
        </div>
        <Space wrap>
          <Button type="primary" icon={<InboxOutlined />} onClick={() => openBatchAction("create")}>
            创建批次
          </Button>
          <Button
            icon={<ReloadOutlined />}
            onClick={() => {
              waybillsQuery.refetch();
              shippingBatchesQuery.refetch();
              if (hasFinancePermission) {
                walletTransactionsQuery.refetch();
                paymentOrdersQuery.refetch();
              }
            }}
          >
            刷新
          </Button>
        </Space>
      </div>

      <Row gutter={[16, 16]}>
        <Col xs={24} md={6}>
          <Card>
            <Statistic title="待审核" value={statusCounts.PENDING_REVIEW} suffix="票" styles={{ content: { color: "#f59e0b" } }} />
          </Card>
        </Col>
        <Col xs={24} md={6}>
          <Card>
            <Statistic title="待付款" value={statusCounts.PENDING_PAYMENT} suffix="票" styles={{ content: { color: "#ef4444" } }} />
          </Card>
        </Col>
        <Col xs={24} md={6}>
          <Card>
            <Statistic title="待发货" value={statusCounts.PENDING_SHIPMENT} suffix="票" styles={{ content: { color: "#2563eb" } }} />
          </Card>
        </Col>
        <Col xs={24} md={6}>
          <Card>
            <Statistic title="已发货" value={statusCounts.SHIPPED} suffix="票" styles={{ content: { color: "#7c3aed" } }} />
          </Card>
        </Col>
      </Row>

      <Card>
        <Space orientation="vertical" size={16} className="waybill-workspace">
          <Tabs
            activeKey={activeStatus}
            onChange={(key) => setActiveStatus(key as ActiveStatus)}
            items={statusTabs.map((tab) => ({
              key: tab.key,
              label: `${tab.label} ${statusCounts[tab.key] || 0}`,
            }))}
          />

          {(waybillsQuery.error || shippingBatchesQuery.error || walletTransactionsQuery.error || paymentOrdersQuery.error) && (
            <Alert
              type="error"
              showIcon
              title={getErrorMessage(
                waybillsQuery.error ||
                  shippingBatchesQuery.error ||
                  walletTransactionsQuery.error ||
                  paymentOrdersQuery.error,
              )}
            />
          )}

          <div className="filter-bar">
            <Input
              allowClear
              prefix={<SearchOutlined />}
              placeholder="搜索运单号、会员、仓库、渠道或包裹"
              value={keyword}
              onChange={(event) => setKeyword(event.target.value)}
            />
          </div>

          <Table
            rowKey="id"
            loading={waybillsQuery.isLoading}
            dataSource={filteredWaybills}
            columns={columns}
            pagination={{ pageSize: 10, showSizeChanger: true }}
            scroll={{ x: 1390 }}
            locale={{ emptyText: <Empty description="暂无运单" /> }}
          />
        </Space>
      </Card>

      <Card
        title="发货批次"
        extra={
          <Button type="primary" icon={<InboxOutlined />} onClick={() => openBatchAction("create")}>
            创建批次
          </Button>
        }
      >
        <Table
          rowKey="id"
          loading={shippingBatchesQuery.isLoading}
          dataSource={shippingBatches}
          columns={batchColumns}
          pagination={{ pageSize: 8, showSizeChanger: true }}
          scroll={{ x: 1450 }}
          locale={{ emptyText: <Empty description="暂无发货批次" /> }}
        />
      </Card>

      <Drawer
        title={detailWaybill ? `${detailWaybill.waybill_no} 详情` : "运单详情"}
        open={Boolean(detailWaybillId)}
        size="large"
        destroyOnHidden
        onClose={() => setDetailWaybillId(null)}
        extra={detailWaybill ? renderActionButtons(detailWaybill) : null}
      >
        {detailWaybill && (
          <Space orientation="vertical" size={16} className="waybill-detail">
            <Descriptions
              bordered
              column={{ xs: 1, md: 2 }}
              size="small"
              items={[
                { key: "waybill_no", label: "运单号", children: detailWaybill.waybill_no },
                { key: "status", label: "状态", children: statusTag(detailWaybill.status) },
                { key: "member", label: "会员", children: detailWaybill.user_email },
                { key: "warehouse", label: "仓库", children: detailWaybill.warehouse_name },
                { key: "channel", label: "发货渠道", children: detailWaybill.channel_name || "-" },
                { key: "country", label: "目的地", children: detailWaybill.destination_country },
                { key: "fee", label: "费用", children: formatMoney(detailWaybill.fee_total) },
                { key: "created_at", label: "创建时间", children: formatDate(detailWaybill.created_at) },
                { key: "remark", label: "用户备注", children: detailWaybill.remark || "-" },
                { key: "fee_remark", label: "费用备注", children: detailWaybill.fee_remark || "-" },
              ]}
            />

            <Card title="收件地址" size="small">
              <Descriptions
                column={{ xs: 1, md: 2 }}
                size="small"
                items={[
                  { key: "name", label: "收件人", children: snapshotText(detailWaybill.recipient_snapshot, "name") },
                  { key: "phone", label: "电话", children: snapshotText(detailWaybill.recipient_snapshot, "phone") },
                  { key: "postal_code", label: "邮编", children: snapshotText(detailWaybill.recipient_snapshot, "postal_code") },
                  { key: "address", label: "地址", children: snapshotText(detailWaybill.recipient_snapshot, "address") },
                ]}
              />
            </Card>

            <Card title="包裹明细" size="small">
              <Table
                rowKey="id"
                size="small"
                pagination={false}
                dataSource={detailWaybill.parcels}
                columns={[
                  { title: "包裹号", dataIndex: "parcel_no" },
                  { title: "快递单号", dataIndex: "tracking_no" },
                  { title: "包裹状态", dataIndex: "parcel_status", width: 130 },
                  {
                    title: "重量",
                    dataIndex: "weight_kg",
                    width: 120,
                    render: (value: string | null) => (value ? `${value} kg` : "-"),
                  },
                ]}
                locale={{ emptyText: <Empty description="暂无包裹" /> }}
              />
            </Card>

            <Row gutter={[16, 16]}>
              <Col xs={24} lg={12}>
                <Card title="费用明细" size="small">
                  {Object.keys(detailWaybill.fee_detail_json || {}).length === 0 ? (
                    <Empty description="暂无费用明细" />
                  ) : (
                    <Descriptions
                      column={1}
                      size="small"
                      items={Object.entries(detailWaybill.fee_detail_json).map(([key, value]) => ({
                        key,
                        label: key,
                        children: String(value),
                      }))}
                    />
                  )}
                </Card>
              </Col>
              <Col xs={24} lg={12}>
                <Card title="操作日志" size="small">
                  <Timeline
                    mode="left"
                    items={buildOperationTimeline(detailWaybill)}
                    pending={detailWaybill.status !== "SIGNED" ? "等待下一步处理" : false}
                  />
                </Card>
              </Col>
            </Row>

            <Card title="物流轨迹" size="small">
              {detailWaybill.tracking_events.length === 0 ? (
                <Empty description="暂无轨迹" />
              ) : (
                <Timeline
                  items={detailWaybill.tracking_events.map((event) => ({
                    dot: <ClockCircleOutlined />,
                    children: (
                      <Space orientation="vertical" size={2}>
                        <Space wrap>
                          <Typography.Text strong>{event.status_text}</Typography.Text>
                          <Tag>{trackingSourceLabel(event.source)}</Tag>
                          {event.operator_name && <Tag color="blue">{event.operator_name}</Tag>}
                        </Space>
                        <Typography.Text type="secondary">{`${formatDate(event.event_time)} / ${event.location || "-"}`}</Typography.Text>
                        {event.description && <Typography.Text>{event.description}</Typography.Text>}
                      </Space>
                    ),
                  }))}
                />
              )}
            </Card>

            {hasFinancePermission && (
              <Row gutter={[16, 16]}>
                <Col xs={24} lg={12}>
                  <Card title="相关支付单" size="small">
                    <Table
                      rowKey="id"
                      size="small"
                      loading={paymentOrdersQuery.isLoading}
                      dataSource={detailPaymentOrders}
                      pagination={false}
                      columns={[
                        { title: "支付单号", dataIndex: "payment_no" },
                        { title: "状态", dataIndex: "status", width: 100, render: (value: string) => <Tag>{value}</Tag> },
                        { title: "金额", dataIndex: "amount", width: 110, render: (value: string) => formatMoney(value) },
                      ]}
                      locale={{ emptyText: <Empty description="暂无支付单" /> }}
                    />
                  </Card>
                </Col>
                <Col xs={24} lg={12}>
                  <Card title="会员钱包流水" size="small">
                    <Table
                      rowKey="id"
                      size="small"
                      loading={walletTransactionsQuery.isLoading}
                      dataSource={detailWalletTransactions.slice(0, 5)}
                      pagination={false}
                      columns={[
                        { title: "类型", dataIndex: "type", render: transactionTag },
                        { title: "金额", dataIndex: "amount", width: 110 },
                        { title: "余额", dataIndex: "balance_after", width: 110 },
                      ]}
                      locale={{ emptyText: <Empty description="暂无钱包流水" /> }}
                    />
                  </Card>
                </Col>
              </Row>
            )}
          </Space>
        )}
      </Drawer>

      <Drawer
        title={detailBatch ? `${detailBatch.batch_no} 详情` : "发货批次详情"}
        open={Boolean(detailBatchId)}
        size="large"
        destroyOnHidden
        onClose={() => setDetailBatchId(null)}
        extra={
          detailBatch ? (
            <Space wrap>
              {detailBatch.status === "DRAFT" && (
                <>
                  <Button icon={<LinkOutlined />} onClick={() => openBatchAction("addWaybills", detailBatch)}>
                    归批
                  </Button>
                  <Button
                    type="primary"
                    icon={<LockOutlined />}
                    loading={lockBatchMutation.isPending}
                    onClick={() => lockBatchMutation.mutate(detailBatch.id)}
                  >
                    锁定
                  </Button>
                </>
              )}
              {detailBatch.status === "LOCKED" && (
                <Button type="primary" icon={<SendOutlined />} onClick={() => openBatchAction("ship", detailBatch)}>
                  批量发货
                </Button>
              )}
              {(detailBatch.status === "LOCKED" || detailBatch.status === "SHIPPED") && (
                <Button icon={<PlusOutlined />} onClick={() => openBatchAction("tracking", detailBatch)}>
                  批量轨迹
                </Button>
              )}
              <Button
                icon={<PrinterOutlined />}
                loading={printPreviewMutation.isPending}
                onClick={() => printPreviewMutation.mutate({ batchId: detailBatch.id, template: "handover" })}
              >
                交接单
              </Button>
            </Space>
          ) : null
        }
      >
        {detailBatch && (
          <Space orientation="vertical" size={16} className="waybill-detail">
            <Descriptions
              bordered
              column={{ xs: 1, md: 2 }}
              size="small"
              items={[
                { key: "batch_no", label: "批次号", children: detailBatch.batch_no },
                { key: "status", label: "状态", children: shippingBatchStatusTag(detailBatch.status) },
                { key: "name", label: "名称", children: detailBatch.name || "-" },
                { key: "warehouse", label: "仓库", children: detailBatch.warehouse_name || "-" },
                { key: "channel", label: "渠道", children: detailBatch.channel_name || "-" },
                { key: "carrier_batch_no", label: "承运商批次号", children: detailBatch.carrier_batch_no || "-" },
                { key: "transfer_no", label: "转单号", children: detailBatch.transfer_no || "-" },
                { key: "waybill_count", label: "运单数", children: detailBatch.waybill_count },
                { key: "ship_note", label: "发货备注", children: detailBatch.ship_note || "-" },
                { key: "locked_at", label: "锁定时间", children: formatDate(detailBatch.locked_at) },
                { key: "shipped_at", label: "发货时间", children: formatDate(detailBatch.shipped_at) },
              ]}
            />
            <Card title="批次运单" size="small">
              <Table
                rowKey="id"
                size="small"
                dataSource={detailBatch.waybills}
                pagination={false}
                columns={[
                  { title: "运单号", dataIndex: "waybill_no", render: (value: string) => <Typography.Text copyable>{value}</Typography.Text> },
                  { title: "会员", dataIndex: "user_email" },
                  { title: "状态", dataIndex: "status", width: 110, render: statusTag },
                  { title: "转单号", dataIndex: "transfer_no", width: 140, render: (value: string) => value || "-" },
                  { title: "包裹数", dataIndex: "parcels", width: 90, render: (parcels) => parcels.length },
                  {
                    title: "操作",
                    width: 90,
                    render: (_, record) =>
                      detailBatch.status === "DRAFT" ? (
                        <Popconfirm
                          title="移出批次"
                          description={`确认将 ${record.waybill_no} 移出当前批次？`}
                          onConfirm={() =>
                            removeBatchWaybillMutation.mutate({ batchId: detailBatch.id, waybillId: record.id })
                          }
                        >
                          <Button size="small" icon={<DeleteOutlined />} />
                        </Popconfirm>
                      ) : (
                        "-"
                      ),
                  },
                ]}
                locale={{ emptyText: <Empty description="暂无运单" /> }}
              />
            </Card>
            <Card
              title="打印模板数据"
              size="small"
              extra={
                <Space wrap>
                  <Select
                    value={printTemplate}
                    style={{ width: 140 }}
                    onChange={(value) => setPrintTemplate(value)}
                    options={[
                      { value: "label", label: "面单" },
                      { value: "picking", label: "拣货单" },
                      { value: "handover", label: "交接清单" },
                    ]}
                  />
                  <Button
                    icon={<PrinterOutlined />}
                    loading={printPreviewMutation.isPending}
                    onClick={() =>
                      printPreviewMutation.mutate({ batchId: detailBatch.id, template: printTemplate })
                    }
                  >
                    预览数据
                  </Button>
                </Space>
              }
            >
              <Descriptions
                size="small"
                column={{ xs: 1, md: 3 }}
                items={[
                  { key: "carrier_batch_no", label: "承运商批次号", children: detailBatch.carrier_batch_no || "-" },
                  { key: "transfer_no", label: "转单号", children: detailBatch.transfer_no || "-" },
                  { key: "waybill_count", label: "运单数", children: detailBatch.waybill_count },
                ]}
              />
            </Card>
          </Space>
        )}
      </Drawer>

      <Modal
        title={actionWaybill ? `${actionWaybill.waybill_no} 审核` : "运单审核"}
        open={action?.type === "review"}
        destroyOnHidden
        okText="审核通过"
        confirmLoading={reviewMutation.isPending}
        onCancel={closeAction}
        onOk={() => {
          reviewForm.validateFields().then((values) => {
            if (actionWaybill) {
              reviewMutation.mutate({
                waybillId: actionWaybill.id,
                payload: { review_remark: values.review_remark?.trim() || "" },
              });
            }
          });
        }}
      >
        <Form form={reviewForm} layout="vertical" requiredMark={false}>
          <Form.Item name="review_remark" label="审核备注">
            <Input.TextArea rows={4} placeholder="包裹、地址和渠道信息确认结果" />
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        title={actionWaybill ? `${actionWaybill.waybill_no} 设置费用` : "设置费用"}
        open={action?.type === "fee"}
        destroyOnHidden
        okText="确认计费"
        confirmLoading={feeMutation.isPending}
        onCancel={closeAction}
        onOk={() => {
          feeForm.validateFields().then((values) => {
            if (actionWaybill) {
              feeMutation.mutate({ waybillId: actionWaybill.id, payload: buildFeePayload(values) });
            }
          });
        }}
      >
        <Form form={feeForm} layout="vertical" requiredMark={false}>
          <Form.Item name="fee_total" label="应收合计 CNY" rules={[{ required: true, message: "请输入应收合计" }]}>
            <InputNumber min={0.01} precision={2} style={{ width: "100%" }} />
          </Form.Item>
          <Row gutter={12}>
            <Col span={8}>
              <Form.Item name="freight" label="运费">
                <InputNumber min={0} precision={2} style={{ width: "100%" }} />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item name="packing" label="包装费">
                <InputNumber min={0} precision={2} style={{ width: "100%" }} />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item name="service" label="服务费">
                <InputNumber min={0} precision={2} style={{ width: "100%" }} />
              </Form.Item>
            </Col>
          </Row>
          <Form.Item name="fee_detail_note" label="费用说明">
            <Input />
          </Form.Item>
          <Form.Item name="fee_remark" label="内部备注">
            <Input.TextArea rows={3} />
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        title={actionWaybill ? `${actionWaybill.user_email} 人工充值` : "人工充值"}
        open={action?.type === "recharge"}
        destroyOnHidden
        okText="确认充值"
        confirmLoading={rechargeMutation.isPending}
        onCancel={closeAction}
        onOk={() => {
          rechargeForm.validateFields().then((values) => {
            if (actionWaybill) {
              rechargeMutation.mutate({
                userId: actionWaybill.user,
                payload: buildRechargePayload(values),
              });
            }
          });
        }}
      >
        <Alert
          type="info"
          showIcon
          className="waybill-modal-alert"
          title={actionWaybill ? `${actionWaybill.waybill_no} 当前费用 ${formatMoney(actionWaybill.fee_total)}` : ""}
        />
        <Form form={rechargeForm} layout="vertical" requiredMark={false}>
          <Form.Item name="amount" label="充值金额 CNY" rules={[{ required: true, message: "请输入充值金额" }]}>
            <InputNumber min={0.01} precision={2} style={{ width: "100%" }} />
          </Form.Item>
          <Form.Item name="remark" label="备注">
            <Input.TextArea rows={3} />
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        title={action?.type === "ship" ? "确认发货" : "添加轨迹"}
        open={action?.type === "ship" || action?.type === "tracking"}
        destroyOnHidden
        okText={action?.type === "ship" ? "确认发货" : "添加轨迹"}
        confirmLoading={shipMutation.isPending || trackingMutation.isPending}
        onCancel={closeAction}
        onOk={() => {
          trackingForm.validateFields().then((values) => {
            if (!actionWaybill || !action) {
              return;
            }
            const payload = buildTrackingPayload(values);
            if (action.type === "ship") {
              shipMutation.mutate({ waybillId: actionWaybill.id, payload });
            } else {
              trackingMutation.mutate({ waybillId: actionWaybill.id, payload });
            }
          });
        }}
      >
        <Form form={trackingForm} layout="vertical" requiredMark={false}>
          <Form.Item name="status_text" label="轨迹状态" rules={[{ required: true, message: "请输入轨迹状态" }]}>
            <Input placeholder="例如：已发货、已到达转运中心" />
          </Form.Item>
          <Form.Item name="location" label="地点">
            <Input placeholder="例如：深圳仓" />
          </Form.Item>
          <Form.Item name="description" label="说明">
            <Input.TextArea rows={3} />
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        title="创建发货批次"
        open={batchAction?.type === "create"}
        destroyOnHidden
        okText="创建批次"
        confirmLoading={createBatchMutation.isPending}
        onCancel={closeBatchAction}
        onOk={() => {
          batchForm.validateFields().then((values) => {
            createBatchMutation.mutate(buildBatchPayload(values));
          });
        }}
      >
        <Form form={batchForm} layout="vertical" requiredMark={false}>
          <Form.Item name="name" label="批次名称">
            <Input placeholder="例如：美国空运晚班" />
          </Form.Item>
          <Row gutter={12}>
            <Col span={12}>
              <Form.Item name="carrier_batch_no" label="承运商批次号">
                <Input placeholder="承运商交接批号" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="transfer_no" label="转单号">
                <Input placeholder="可留空" />
              </Form.Item>
            </Col>
          </Row>
          <Form.Item name="waybill_ids" label="待发货运单" rules={[{ required: true, message: "请选择运单" }]}>
            <Select
              mode="multiple"
              showSearch
              optionFilterProp="label"
              placeholder="选择待发货且未归批的运单"
              options={batchCandidateWaybills.map((waybill) => ({
                value: waybill.id,
                label: `${waybill.waybill_no} / ${waybill.user_email} / ${waybill.warehouse_name}`,
              }))}
            />
          </Form.Item>
          <Form.Item name="ship_note" label="发货备注">
            <Input.TextArea rows={3} />
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        title={actionBatch ? `${actionBatch.batch_no} 归批` : "归批"}
        open={batchAction?.type === "addWaybills"}
        destroyOnHidden
        okText="加入批次"
        confirmLoading={addBatchWaybillsMutation.isPending}
        onCancel={closeBatchAction}
        onOk={() => {
          batchForm.validateFields().then((values) => {
            if (actionBatch) {
              addBatchWaybillsMutation.mutate({ batchId: actionBatch.id, waybillIds: values.waybill_ids || [] });
            }
          });
        }}
      >
        <Form form={batchForm} layout="vertical" requiredMark={false}>
          <Form.Item name="waybill_ids" label="待发货运单" rules={[{ required: true, message: "请选择运单" }]}>
            <Select
              mode="multiple"
              showSearch
              optionFilterProp="label"
              placeholder="选择待发货且未归批的运单"
              options={batchCandidateWaybills
                .filter((waybill) => waybill.shipping_batch !== actionBatch?.id)
                .map((waybill) => ({
                  value: waybill.id,
                  label: `${waybill.waybill_no} / ${waybill.user_email} / ${waybill.warehouse_name}`,
                }))}
            />
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        title={batchAction?.type === "ship" ? "批量发货" : "批量添加轨迹"}
        open={batchAction?.type === "ship" || batchAction?.type === "tracking"}
        destroyOnHidden
        okText={batchAction?.type === "ship" ? "确认发货" : "添加轨迹"}
        confirmLoading={shipBatchMutation.isPending || batchTrackingMutation.isPending}
        onCancel={closeBatchAction}
        onOk={() => {
          trackingForm.validateFields().then((values) => {
            if (!actionBatch || !batchAction) {
              return;
            }
            const payload = buildTrackingPayload(values);
            if (batchAction.type === "ship") {
              shipBatchMutation.mutate({ batchId: actionBatch.id, payload });
            } else {
              batchTrackingMutation.mutate({ batchId: actionBatch.id, payload });
            }
          });
        }}
      >
        <Alert
          type="info"
          showIcon
          className="waybill-modal-alert"
          title={actionBatch ? `${actionBatch.batch_no} 共 ${actionBatch.waybill_count} 票运单` : ""}
        />
        <Form form={trackingForm} layout="vertical" requiredMark={false}>
          <Form.Item name="status_text" label="轨迹状态" rules={[{ required: true, message: "请输入轨迹状态" }]}>
            <Input placeholder="例如：批次已发货、已交接承运商" />
          </Form.Item>
          <Form.Item name="location" label="地点">
            <Input placeholder="例如：深圳仓" />
          </Form.Item>
          <Form.Item name="description" label="说明">
            <Input.TextArea rows={3} />
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        title={printPreview ? `${printPreview.batch.batch_no} 打印模板数据` : "打印模板数据"}
        open={Boolean(printPreview)}
        width={920}
        destroyOnHidden
        footer={null}
        onCancel={() => setPrintPreview(null)}
      >
        {printPreview && (
          <Space orientation="vertical" size={16} className="waybill-detail">
            <Descriptions
              bordered
              size="small"
              column={{ xs: 1, md: 3 }}
              items={[
                { key: "template", label: "模板", children: printPreview.template },
                { key: "waybill_count", label: "运单数", children: printPreview.batch.waybill_count },
                { key: "parcel_count", label: "包裹数", children: printPreview.batch.parcel_count },
                { key: "warehouse", label: "仓库", children: printPreview.batch.warehouse_name || "-" },
                { key: "channel", label: "渠道", children: printPreview.batch.channel_name || "-" },
                { key: "carrier_batch_no", label: "承运商批次号", children: printPreview.batch.carrier_batch_no || "-" },
                { key: "transfer_no", label: "转单号", children: printPreview.batch.transfer_no || "-" },
                { key: "total_weight_kg", label: "总重量 kg", children: printPreview.batch.total_weight_kg },
                { key: "generated_at", label: "生成时间", children: formatDate(printPreview.batch.generated_at) },
              ]}
            />
            <Table
              rowKey="waybill_no"
              size="small"
              dataSource={printPreview.items}
              pagination={false}
              columns={[
                { title: "运单号", dataIndex: "waybill_no" },
                { title: "转单号", dataIndex: "transfer_no", render: (value: string) => value || "-" },
                { title: "会员", dataIndex: "user_email" },
                { title: "目的地", dataIndex: "destination_country", width: 90 },
                { title: "包裹数", dataIndex: "parcel_count", width: 90 },
                {
                  title: "收件人",
                  dataIndex: "recipient",
                  render: (recipient: Record<string, unknown>) => snapshotText(recipient, "name"),
                },
              ]}
            />
          </Space>
        )}
      </Modal>
    </Space>
  );
}
