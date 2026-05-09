import {
  CheckCircleOutlined,
  CloseCircleOutlined,
  DollarOutlined,
  EditOutlined,
  FileSearchOutlined,
  PlusOutlined,
  ReloadOutlined,
  SearchOutlined,
} from "@ant-design/icons";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Alert,
  App as AntdApp,
  Button,
  Card,
  Col,
  Empty,
  Form,
  Input,
  InputNumber,
  Modal,
  Row,
  Select,
  Space,
  Statistic,
  Table,
  Tabs,
  Tag,
  Typography,
} from "antd";
import type { TableColumnsType } from "antd";
import { useMemo, useState } from "react";
import { useOutletContext } from "react-router-dom";

import { ForbiddenPage } from "../../pages/ForbiddenPage";
import { financeOpsApi } from "./api";
import type {
  CostType,
  CostTypePayload,
  MasterDataStatus,
  Payable,
  PayablePayload,
  PayableStatus,
  PaymentOrder,
  RechargeRequest,
  RemittanceStatus,
  Supplier,
  SupplierPayload,
  WalletTransaction,
} from "./types";

type WorkspaceContext = {
  allowedCodes: Set<string>;
};

type ActiveStatus = "ALL" | RemittanceStatus;
type ReviewAction = {
  type: "approve" | "cancel";
  remittance: RechargeRequest;
};
type SupplierAction = {
  supplier?: Supplier;
};
type CostTypeAction = {
  costType?: CostType;
};
type PayableAction = {
  type: "create" | "edit" | "settle" | "cancel";
  payable?: Payable;
};

type ReviewFormValues = {
  review_remark?: string;
};
type SupplierFormValues = SupplierPayload;
type CostTypeFormValues = CostTypePayload;
type PayableFormValues = {
  supplier_id?: number;
  cost_type_id?: number;
  amount?: number;
  currency?: string;
  source_type?: string;
  source_id?: number | null;
  description?: string;
  due_date?: string | null;
};
type PayableReviewFormValues = {
  settlement_reference?: string;
  settlement_note?: string;
  cancel_reason?: string;
};

const remittancesQueryKey = ["admin-finance-remittances"] as const;
const walletTransactionsQueryKey = ["admin-finance-wallet-transactions"] as const;
const paymentOrdersQueryKey = ["admin-finance-payment-orders"] as const;
const suppliersQueryKey = ["admin-finance-suppliers"] as const;
const costTypesQueryKey = ["admin-finance-cost-types"] as const;
const payablesQueryKey = ["admin-finance-payables"] as const;

const remittanceStatusMeta: Record<RemittanceStatus, { color: string; label: string }> = {
  PENDING: { color: "gold", label: "待审核" },
  COMPLETED: { color: "green", label: "已入账" },
  CANCELLED: { color: "default", label: "已取消" },
};

const payableStatusMeta: Record<PayableStatus, { color: string; label: string }> = {
  PENDING_REVIEW: { color: "gold", label: "待审核" },
  CONFIRMED: { color: "blue", label: "已确认" },
  SETTLED: { color: "green", label: "已核销" },
  CANCELLED: { color: "default", label: "已取消" },
};

const masterStatusMeta: Record<MasterDataStatus, { color: string; label: string }> = {
  ACTIVE: { color: "green", label: "启用" },
  DISABLED: { color: "default", label: "停用" },
};

const statusTabs: { key: ActiveStatus; label: string }[] = [
  { key: "ALL", label: "全部" },
  { key: "PENDING", label: "待审核" },
  { key: "COMPLETED", label: "已入账" },
  { key: "CANCELLED", label: "已取消" },
];

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : "请求失败";
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
  return `${currency} ${value || "0.00"}`;
}

function toDecimalString(value?: number, fractionDigits = 2) {
  if (value === undefined || value === null) {
    return undefined;
  }
  return value.toFixed(fractionDigits);
}

function remittanceStatusTag(status: RemittanceStatus) {
  const meta = remittanceStatusMeta[status];
  return <Tag color={meta.color}>{meta.label}</Tag>;
}

function payableStatusTag(status: PayableStatus) {
  const meta = payableStatusMeta[status];
  return <Tag color={meta.color}>{meta.label}</Tag>;
}

function masterStatusTag(status: MasterDataStatus) {
  const meta = masterStatusMeta[status];
  return <Tag color={meta.color}>{meta.label}</Tag>;
}

function buildSupplierPayload(values: SupplierFormValues): SupplierPayload {
  return {
    code: values.code?.trim() || "",
    name: values.name?.trim() || "",
    status: values.status || "ACTIVE",
    contact_name: values.contact_name?.trim() || "",
    phone: values.phone?.trim() || "",
    email: values.email?.trim() || "",
    address: values.address?.trim() || "",
    bank_account: values.bank_account?.trim() || "",
    remark: values.remark?.trim() || "",
  };
}

function buildCostTypePayload(values: CostTypeFormValues): CostTypePayload {
  return {
    code: values.code?.trim() || "",
    name: values.name?.trim() || "",
    category: values.category?.trim() || "",
    status: values.status || "ACTIVE",
    remark: values.remark?.trim() || "",
  };
}

function buildPayablePayload(values: PayableFormValues): PayablePayload {
  return {
    supplier_id: Number(values.supplier_id),
    cost_type_id: Number(values.cost_type_id),
    amount: toDecimalString(values.amount) || "0.00",
    currency: values.currency?.trim() || "CNY",
    source_type: values.source_type?.trim() || "",
    source_id: values.source_id ?? null,
    description: values.description?.trim() || "",
    due_date: values.due_date || null,
  };
}

export function FinancePage() {
  const { allowedCodes } = useOutletContext<WorkspaceContext>();
  const queryClient = useQueryClient();
  const { message } = AntdApp.useApp();
  const [reviewForm] = Form.useForm<ReviewFormValues>();
  const [supplierForm] = Form.useForm<SupplierFormValues>();
  const [costTypeForm] = Form.useForm<CostTypeFormValues>();
  const [payableForm] = Form.useForm<PayableFormValues>();
  const [payableReviewForm] = Form.useForm<PayableReviewFormValues>();
  const [activeStatus, setActiveStatus] = useState<ActiveStatus>("PENDING");
  const [keyword, setKeyword] = useState("");
  const [payableKeyword, setPayableKeyword] = useState("");
  const [masterKeyword, setMasterKeyword] = useState("");
  const [reviewAction, setReviewAction] = useState<ReviewAction | null>(null);
  const [supplierAction, setSupplierAction] = useState<SupplierAction | null>(null);
  const [costTypeAction, setCostTypeAction] = useState<CostTypeAction | null>(null);
  const [payableAction, setPayableAction] = useState<PayableAction | null>(null);

  const hasPermission = allowedCodes.has("finance.view");
  const remittancesQuery = useQuery({
    queryKey: remittancesQueryKey,
    queryFn: financeOpsApi.listRemittances,
    enabled: hasPermission,
  });
  const walletTransactionsQuery = useQuery({
    queryKey: walletTransactionsQueryKey,
    queryFn: financeOpsApi.listWalletTransactions,
    enabled: hasPermission,
  });
  const paymentOrdersQuery = useQuery({
    queryKey: paymentOrdersQueryKey,
    queryFn: financeOpsApi.listPaymentOrders,
    enabled: hasPermission,
  });
  const suppliersQuery = useQuery({
    queryKey: suppliersQueryKey,
    queryFn: financeOpsApi.listSuppliers,
    enabled: hasPermission,
  });
  const costTypesQuery = useQuery({
    queryKey: costTypesQueryKey,
    queryFn: financeOpsApi.listCostTypes,
    enabled: hasPermission,
  });
  const payablesQuery = useQuery({
    queryKey: payablesQueryKey,
    queryFn: financeOpsApi.listPayables,
    enabled: hasPermission,
  });

  const remittances = useMemo(() => remittancesQuery.data ?? [], [remittancesQuery.data]);
  const walletTransactions = useMemo(
    () => walletTransactionsQuery.data ?? [],
    [walletTransactionsQuery.data],
  );
  const paymentOrders = useMemo(() => paymentOrdersQuery.data ?? [], [paymentOrdersQuery.data]);
  const suppliers = useMemo(() => suppliersQuery.data ?? [], [suppliersQuery.data]);
  const costTypes = useMemo(() => costTypesQuery.data ?? [], [costTypesQuery.data]);
  const payables = useMemo(() => payablesQuery.data ?? [], [payablesQuery.data]);
  const activeSuppliers = useMemo(() => suppliers.filter((supplier) => supplier.status === "ACTIVE"), [suppliers]);
  const activeCostTypes = useMemo(() => costTypes.filter((costType) => costType.status === "ACTIVE"), [costTypes]);

  const filteredRemittances = useMemo(() => {
    const byStatus =
      activeStatus === "ALL"
        ? remittances
        : remittances.filter((remittance) => remittance.status === activeStatus);
    return filterRows(byStatus, keyword, (remittance) => [
      remittance.request_no,
      remittance.user_email,
      remittance.proof_file_id,
      remittance.proof_file_name,
      remittance.remark,
      remittance.review_remark,
    ]);
  }, [activeStatus, keyword, remittances]);

  const filteredPayables = useMemo(
    () =>
      filterRows(payables, payableKeyword, (payable) => [
        payable.payable_no,
        payable.supplier_name,
        payable.cost_type_name,
        payable.source_type,
        payable.description,
        payable.settlement_reference,
      ]),
    [payableKeyword, payables],
  );
  const filteredSuppliers = useMemo(
    () =>
      filterRows(suppliers, masterKeyword, (supplier) => [
        supplier.code,
        supplier.name,
        supplier.contact_name,
        supplier.phone,
        supplier.email,
      ]),
    [masterKeyword, suppliers],
  );
  const filteredCostTypes = useMemo(
    () =>
      filterRows(costTypes, masterKeyword, (costType) => [
        costType.code,
        costType.name,
        costType.category,
      ]),
    [costTypes, masterKeyword],
  );

  const pendingAmount = remittances
    .filter((remittance) => remittance.status === "PENDING")
    .reduce((total, remittance) => total + Number(remittance.amount || 0), 0);
  const confirmedPayableAmount = payables
    .filter((payable) => payable.status === "CONFIRMED")
    .reduce((total, payable) => total + Number(payable.amount || 0), 0);
  const pendingPayableCount = payables.filter((payable) => payable.status === "PENDING_REVIEW").length;

  const invalidatePayables = () => queryClient.invalidateQueries({ queryKey: payablesQueryKey });
  const invalidateSuppliers = () => queryClient.invalidateQueries({ queryKey: suppliersQueryKey });
  const invalidateCostTypes = () => queryClient.invalidateQueries({ queryKey: costTypesQueryKey });

  const approveMutation = useMutation({
    mutationFn: ({ remittanceId, values }: { remittanceId: number; values: ReviewFormValues }) =>
      financeOpsApi.approveRemittance(remittanceId, values),
    onSuccess: () => {
      message.success("汇款已审核入账");
      setReviewAction(null);
      reviewForm.resetFields();
      queryClient.invalidateQueries({ queryKey: remittancesQueryKey });
      queryClient.invalidateQueries({ queryKey: walletTransactionsQueryKey });
    },
    onError: (error) => message.error(getErrorMessage(error)),
  });

  const cancelMutation = useMutation({
    mutationFn: ({ remittanceId, values }: { remittanceId: number; values: ReviewFormValues }) =>
      financeOpsApi.cancelRemittance(remittanceId, values),
    onSuccess: () => {
      message.success("汇款单已取消");
      setReviewAction(null);
      reviewForm.resetFields();
      queryClient.invalidateQueries({ queryKey: remittancesQueryKey });
    },
    onError: (error) => message.error(getErrorMessage(error)),
  });

  const isReviewing = approveMutation.isPending || cancelMutation.isPending;

  const supplierMutation = useMutation({
    mutationFn: ({ supplier, payload }: { supplier?: Supplier; payload: SupplierPayload }) =>
      supplier
        ? financeOpsApi.updateSupplier(supplier.id, payload)
        : financeOpsApi.createSupplier(payload),
    onSuccess: () => {
      message.success("供应商已保存");
      setSupplierAction(null);
      supplierForm.resetFields();
      invalidateSuppliers();
    },
    onError: (error) => message.error(getErrorMessage(error)),
  });

  const costTypeMutation = useMutation({
    mutationFn: ({ costType, payload }: { costType?: CostType; payload: CostTypePayload }) =>
      costType
        ? financeOpsApi.updateCostType(costType.id, payload)
        : financeOpsApi.createCostType(payload),
    onSuccess: () => {
      message.success("成本类型已保存");
      setCostTypeAction(null);
      costTypeForm.resetFields();
      invalidateCostTypes();
    },
    onError: (error) => message.error(getErrorMessage(error)),
  });

  const payableMutation = useMutation({
    mutationFn: ({ payable, payload }: { payable?: Payable; payload: PayablePayload }) =>
      payable
        ? financeOpsApi.updatePayable(payable.id, payload)
        : financeOpsApi.createPayable(payload),
    onSuccess: () => {
      message.success("应付款已保存");
      setPayableAction(null);
      payableForm.resetFields();
      invalidatePayables();
    },
    onError: (error) => message.error(getErrorMessage(error)),
  });

  const confirmPayableMutation = useMutation({
    mutationFn: financeOpsApi.confirmPayable,
    onSuccess: () => {
      message.success("应付款已确认");
      invalidatePayables();
    },
    onError: (error) => message.error(getErrorMessage(error)),
  });

  const settlePayableMutation = useMutation({
    mutationFn: ({ payableId, values }: { payableId: number; values: PayableReviewFormValues }) =>
      financeOpsApi.settlePayable(payableId, {
        settlement_reference: values.settlement_reference?.trim() || "",
        settlement_note: values.settlement_note?.trim() || "",
      }),
    onSuccess: () => {
      message.success("应付款已核销");
      setPayableAction(null);
      payableReviewForm.resetFields();
      invalidatePayables();
    },
    onError: (error) => message.error(getErrorMessage(error)),
  });

  const cancelPayableMutation = useMutation({
    mutationFn: ({ payableId, values }: { payableId: number; values: PayableReviewFormValues }) =>
      financeOpsApi.cancelPayable(payableId, { cancel_reason: values.cancel_reason?.trim() || "" }),
    onSuccess: () => {
      message.success("应付款已取消");
      setPayableAction(null);
      payableReviewForm.resetFields();
      invalidatePayables();
    },
    onError: (error) => message.error(getErrorMessage(error)),
  });

  const openSupplierModal = (supplier?: Supplier) => {
    setSupplierAction({ supplier });
    supplierForm.resetFields();
    supplierForm.setFieldsValue(
      supplier || {
        status: "ACTIVE",
      },
    );
  };

  const openCostTypeModal = (costType?: CostType) => {
    setCostTypeAction({ costType });
    costTypeForm.resetFields();
    costTypeForm.setFieldsValue(
      costType || {
        status: "ACTIVE",
      },
    );
  };

  const openPayableModal = (payable?: Payable) => {
    setPayableAction({ type: payable ? "edit" : "create", payable });
    payableForm.resetFields();
    payableForm.setFieldsValue(
      payable
        ? {
            supplier_id: payable.supplier,
            cost_type_id: payable.cost_type,
            amount: Number(payable.amount || 0),
            currency: payable.currency,
            source_type: payable.source_type,
            source_id: payable.source_id,
            description: payable.description,
            due_date: payable.due_date,
          }
        : {
            currency: "CNY",
          },
    );
  };

  const openPayableReviewModal = (type: "settle" | "cancel", payable: Payable) => {
    setPayableAction({ type, payable });
    payableReviewForm.resetFields();
  };

  if (!hasPermission) {
    return <ForbiddenPage />;
  }

  const remittanceColumns: TableColumnsType<RechargeRequest> = [
    {
      title: "汇款单",
      dataIndex: "request_no",
      width: 132,
      render: (value, record) => (
        <Space orientation="vertical" size={0}>
          <Typography.Text strong>{value}</Typography.Text>
          <Typography.Text type="secondary">{formatDate(record.created_at)}</Typography.Text>
        </Space>
      ),
    },
    {
      title: "会员",
      dataIndex: "user_email",
      width: 200,
      render: (value) => <Typography.Text copyable>{value}</Typography.Text>,
    },
    {
      title: "金额",
      dataIndex: "amount",
      width: 128,
      render: (value, record) => <Typography.Text strong>{formatMoney(value, record.currency)}</Typography.Text>,
    },
    { title: "状态", dataIndex: "status", width: 96, render: remittanceStatusTag },
    {
      title: "凭证",
      dataIndex: "proof_file_id",
      width: 210,
      render: (value, record) => (
        <Space orientation="vertical" size={0}>
          <Typography.Text copyable>{record.proof_file_name || value}</Typography.Text>
          <Typography.Text type="secondary">{value}</Typography.Text>
          {record.proof_download_url && (
            <Button
              href={record.proof_download_url}
              target="_blank"
              rel="noreferrer"
              size="small"
              icon={<FileSearchOutlined />}
            >
              查看凭证
            </Button>
          )}
        </Space>
      ),
    },
    { title: "备注", dataIndex: "remark", ellipsis: true, render: (value, record) => value || record.review_remark || "-" },
    {
      title: "审核",
      width: 180,
      render: (_, record) => (
        <Space orientation="vertical" size={0}>
          <Typography.Text>{record.operator_name || "-"}</Typography.Text>
          <Typography.Text type="secondary">{formatDate(record.reviewed_at)}</Typography.Text>
        </Space>
      ),
    },
    {
      title: "操作",
      width: 184,
      fixed: "right",
      render: (_, record) => (
        <Space>
          <Button
            icon={<CheckCircleOutlined />}
            type="primary"
            size="small"
            disabled={record.status !== "PENDING"}
            onClick={() => setReviewAction({ type: "approve", remittance: record })}
          >
            通过
          </Button>
          <Button
            danger
            icon={<CloseCircleOutlined />}
            size="small"
            disabled={record.status !== "PENDING"}
            onClick={() => setReviewAction({ type: "cancel", remittance: record })}
          >
            取消
          </Button>
        </Space>
      ),
    },
  ];

  const payableColumns: TableColumnsType<Payable> = [
    { title: "应付单", dataIndex: "payable_no", width: 140, render: (value) => <Typography.Text copyable strong>{value}</Typography.Text> },
    { title: "供应商", dataIndex: "supplier_name", width: 180 },
    { title: "成本类型", dataIndex: "cost_type_name", width: 150 },
    { title: "状态", dataIndex: "status", width: 110, render: payableStatusTag },
    { title: "金额", dataIndex: "amount", width: 130, render: (value, record) => formatMoney(value, record.currency) },
    { title: "来源", dataIndex: "source_type", width: 140, render: (value, record) => value ? `${value}${record.source_id ? ` #${record.source_id}` : ""}` : "-" },
    { title: "到期日", dataIndex: "due_date", width: 120, render: (value) => value || "-" },
    { title: "说明", dataIndex: "description", ellipsis: true, render: (value) => value || "-" },
    {
      title: "核销",
      width: 190,
      render: (_, record) => (
        <Space orientation="vertical" size={0}>
          <Typography.Text>{record.settlement_reference || "-"}</Typography.Text>
          <Typography.Text type="secondary">{formatDate(record.settled_at)}</Typography.Text>
        </Space>
      ),
    },
    {
      title: "操作",
      width: 250,
      fixed: "right",
      render: (_, record) => (
        <Space size={4} wrap>
          <Button
            size="small"
            icon={<EditOutlined />}
            disabled={record.status !== "PENDING_REVIEW"}
            onClick={() => openPayableModal(record)}
          />
          <Button
            size="small"
            type="primary"
            icon={<CheckCircleOutlined />}
            disabled={record.status !== "PENDING_REVIEW"}
            loading={confirmPayableMutation.isPending}
            onClick={() => confirmPayableMutation.mutate(record.id)}
          >
            确认
          </Button>
          <Button
            size="small"
            icon={<DollarOutlined />}
            disabled={record.status !== "CONFIRMED"}
            onClick={() => openPayableReviewModal("settle", record)}
          >
            核销
          </Button>
          <Button
            size="small"
            danger
            icon={<CloseCircleOutlined />}
            disabled={record.status === "SETTLED" || record.status === "CANCELLED"}
            onClick={() => openPayableReviewModal("cancel", record)}
          />
        </Space>
      ),
    },
  ];

  const supplierColumns: TableColumnsType<Supplier> = [
    { title: "编码", dataIndex: "code", width: 140, render: (value) => <Typography.Text copyable>{value}</Typography.Text> },
    { title: "名称", dataIndex: "name", width: 180 },
    { title: "状态", dataIndex: "status", width: 90, render: masterStatusTag },
    { title: "联系人", dataIndex: "contact_name", width: 120, render: (value) => value || "-" },
    { title: "电话", dataIndex: "phone", width: 140, render: (value) => value || "-" },
    { title: "邮箱", dataIndex: "email", width: 180, render: (value) => value || "-" },
    { title: "备注", dataIndex: "remark", ellipsis: true, render: (value) => value || "-" },
    {
      title: "操作",
      width: 90,
      fixed: "right",
      render: (_, record) => <Button size="small" icon={<EditOutlined />} onClick={() => openSupplierModal(record)} />,
    },
  ];

  const costTypeColumns: TableColumnsType<CostType> = [
    { title: "编码", dataIndex: "code", width: 150, render: (value) => <Typography.Text copyable>{value}</Typography.Text> },
    { title: "名称", dataIndex: "name", width: 180 },
    { title: "分类", dataIndex: "category", width: 140, render: (value) => value || "-" },
    { title: "状态", dataIndex: "status", width: 90, render: masterStatusTag },
    { title: "备注", dataIndex: "remark", ellipsis: true, render: (value) => value || "-" },
    {
      title: "操作",
      width: 90,
      fixed: "right",
      render: (_, record) => <Button size="small" icon={<EditOutlined />} onClick={() => openCostTypeModal(record)} />,
    },
  ];

  const transactionColumns: TableColumnsType<WalletTransaction> = [
    { title: "ID", dataIndex: "id", width: 86 },
    { title: "会员", dataIndex: "user_email", width: 210 },
    { title: "类型", dataIndex: "type", width: 170, render: (value) => <Tag>{value}</Tag> },
    {
      title: "方向",
      dataIndex: "direction",
      width: 88,
      render: (value) => <Tag color={value === "INCREASE" ? "green" : "red"}>{value === "INCREASE" ? "增加" : "减少"}</Tag>,
    },
    { title: "金额", dataIndex: "amount", width: 120, render: (value) => <Typography.Text strong>{value}</Typography.Text> },
    { title: "余额", dataIndex: "balance_after", width: 120 },
    { title: "业务", dataIndex: "business_type", width: 160 },
    { title: "备注", dataIndex: "remark", ellipsis: true },
    { title: "时间", dataIndex: "created_at", width: 180, render: formatDate },
  ];

  const paymentOrderColumns: TableColumnsType<PaymentOrder> = [
    { title: "支付单", dataIndex: "payment_no", width: 140 },
    { title: "会员", dataIndex: "user_email", width: 210 },
    { title: "业务", dataIndex: "business_type", width: 150 },
    { title: "状态", dataIndex: "status", width: 110, render: (value) => <Tag>{value}</Tag> },
    { title: "金额", dataIndex: "amount", width: 130, render: (value, record) => formatMoney(value, record.currency) },
    { title: "支付时间", dataIndex: "paid_at", width: 180, render: formatDate },
    { title: "备注", dataIndex: "remark", ellipsis: true },
  ];

  return (
    <Space orientation="vertical" size="large" style={{ width: "100%" }}>
      <div>
        <Typography.Title level={3} style={{ marginBottom: 4 }}>
          财务管理
        </Typography.Title>
        <Typography.Text type="secondary">
          线下汇款审核、钱包流水、支付单、供应商和应付款。
        </Typography.Text>
      </div>

      {(remittancesQuery.isError ||
        walletTransactionsQuery.isError ||
        paymentOrdersQuery.isError ||
        suppliersQuery.isError ||
        costTypesQuery.isError ||
        payablesQuery.isError) && (
        <Alert
          type="error"
          showIcon
          message="财务数据加载失败"
          description={getErrorMessage(
            remittancesQuery.error ||
              walletTransactionsQuery.error ||
              paymentOrdersQuery.error ||
              suppliersQuery.error ||
              costTypesQuery.error ||
              payablesQuery.error,
          )}
        />
      )}

      <Row gutter={[16, 16]}>
        <Col xs={24} md={6}>
          <Card>
            <Statistic title="待审核汇款" value={remittances.filter((item) => item.status === "PENDING").length} />
          </Card>
        </Col>
        <Col xs={24} md={6}>
          <Card>
            <Statistic title="待审核金额" prefix="CNY" precision={2} value={pendingAmount} />
          </Card>
        </Col>
        <Col xs={24} md={6}>
          <Card>
            <Statistic title="已确认应付" prefix="CNY" precision={2} value={confirmedPayableAmount} />
          </Card>
        </Col>
        <Col xs={24} md={6}>
          <Card>
            <Statistic title="待审核应付" value={pendingPayableCount} suffix="笔" />
          </Card>
        </Col>
      </Row>

      <Tabs
        items={[
          {
            key: "payables",
            label: "应付款",
            children: (
              <Card
                title="应付款"
                extra={
                  <Space wrap>
                    <Input
                      allowClear
                      prefix={<SearchOutlined />}
                      placeholder="搜索单号、供应商、成本类型"
                      value={payableKeyword}
                      onChange={(event) => setPayableKeyword(event.target.value)}
                      style={{ width: 280 }}
                    />
                    <Button icon={<PlusOutlined />} type="primary" onClick={() => openPayableModal()}>
                      新建应付款
                    </Button>
                    <Button icon={<ReloadOutlined />} onClick={invalidatePayables}>
                      刷新
                    </Button>
                  </Space>
                }
              >
                <Table
                  rowKey="id"
                  loading={payablesQuery.isLoading}
                  columns={payableColumns}
                  dataSource={filteredPayables}
                  locale={{ emptyText: <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="暂无应付款" /> }}
                  scroll={{ x: 1500 }}
                  pagination={{ pageSize: 10, showSizeChanger: false }}
                />
              </Card>
            ),
          },
          {
            key: "suppliers",
            label: "供应商",
            children: (
              <Card
                title="供应商"
                extra={
                  <Space wrap>
                    <Input
                      allowClear
                      prefix={<SearchOutlined />}
                      placeholder="搜索编码、名称、联系人"
                      value={masterKeyword}
                      onChange={(event) => setMasterKeyword(event.target.value)}
                      style={{ width: 260 }}
                    />
                    <Button icon={<PlusOutlined />} type="primary" onClick={() => openSupplierModal()}>
                      新建供应商
                    </Button>
                  </Space>
                }
              >
                <Table
                  rowKey="id"
                  loading={suppliersQuery.isLoading}
                  columns={supplierColumns}
                  dataSource={filteredSuppliers}
                  scroll={{ x: 1120 }}
                  pagination={{ pageSize: 10, showSizeChanger: false }}
                />
              </Card>
            ),
          },
          {
            key: "cost-types",
            label: "成本类型",
            children: (
              <Card
                title="成本类型"
                extra={
                  <Space wrap>
                    <Button icon={<PlusOutlined />} type="primary" onClick={() => openCostTypeModal()}>
                      新建成本类型
                    </Button>
                  </Space>
                }
              >
                <Table
                  rowKey="id"
                  loading={costTypesQuery.isLoading}
                  columns={costTypeColumns}
                  dataSource={filteredCostTypes}
                  scroll={{ x: 900 }}
                  pagination={{ pageSize: 10, showSizeChanger: false }}
                />
              </Card>
            ),
          },
          {
            key: "remittances",
            label: "线下汇款",
            children: (
              <Card
                title="汇款审核"
                extra={
                  <Space wrap>
                    <Input
                      allowClear
                      prefix={<SearchOutlined />}
                      placeholder="搜索单号、会员、凭证"
                      value={keyword}
                      onChange={(event) => setKeyword(event.target.value)}
                      style={{ width: 260 }}
                    />
                    <Button
                      icon={<ReloadOutlined />}
                      onClick={() => queryClient.invalidateQueries({ queryKey: remittancesQueryKey })}
                    >
                      刷新
                    </Button>
                  </Space>
                }
              >
                <Tabs
                  activeKey={activeStatus}
                  onChange={(key) => setActiveStatus(key as ActiveStatus)}
                  items={statusTabs.map((item) => ({ key: item.key, label: item.label }))}
                />
                <Table
                  rowKey="id"
                  size="middle"
                  loading={remittancesQuery.isLoading}
                  columns={remittanceColumns}
                  dataSource={filteredRemittances}
                  locale={{ emptyText: <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="暂无线下汇款单" /> }}
                  scroll={{ x: 1280 }}
                  pagination={{ pageSize: 10, showSizeChanger: false }}
                />
              </Card>
            ),
          },
          {
            key: "transactions",
            label: "钱包流水",
            children: (
              <Card title="钱包流水">
                <Table
                  rowKey="id"
                  loading={walletTransactionsQuery.isLoading}
                  columns={transactionColumns}
                  dataSource={walletTransactions}
                  scroll={{ x: 1120 }}
                  pagination={{ pageSize: 10, showSizeChanger: false }}
                />
              </Card>
            ),
          },
          {
            key: "payment-orders",
            label: "支付单",
            children: (
              <Card title="支付单">
                <Table
                  rowKey="id"
                  loading={paymentOrdersQuery.isLoading}
                  columns={paymentOrderColumns}
                  dataSource={paymentOrders}
                  scroll={{ x: 1040 }}
                  pagination={{ pageSize: 10, showSizeChanger: false }}
                />
              </Card>
            ),
          },
        ]}
      />

      <Modal
        title={reviewAction?.type === "approve" ? "审核通过线下汇款" : "取消线下汇款单"}
        open={Boolean(reviewAction)}
        forceRender
        okText={reviewAction?.type === "approve" ? "确认入账" : "确认取消"}
        okButtonProps={{ danger: reviewAction?.type === "cancel" }}
        confirmLoading={isReviewing}
        onCancel={() => {
          setReviewAction(null);
          reviewForm.resetFields();
        }}
        onOk={() => {
          if (!reviewAction) {
            return;
          }
          const values = reviewForm.getFieldsValue();
          if (reviewAction.type === "approve") {
            approveMutation.mutate({ remittanceId: reviewAction.remittance.id, values });
            return;
          }
          cancelMutation.mutate({ remittanceId: reviewAction.remittance.id, values });
        }}
      >
        {reviewAction && (
          <Space orientation="vertical" size="middle" style={{ width: "100%" }}>
            <Alert
              type={reviewAction.type === "approve" ? "info" : "warning"}
              showIcon
              icon={<FileSearchOutlined />}
              message={`${reviewAction.remittance.request_no} / ${reviewAction.remittance.user_email}`}
              description={`金额 ${formatMoney(reviewAction.remittance.amount, reviewAction.remittance.currency)}，凭证 ${reviewAction.remittance.proof_file_name || reviewAction.remittance.proof_file_id}`}
            />
            <Form form={reviewForm} layout="vertical">
              <Form.Item name="review_remark" label="审核备注">
                <Input.TextArea rows={3} maxLength={255} showCount placeholder="填写入账或取消原因" />
              </Form.Item>
            </Form>
          </Space>
        )}
      </Modal>

      <Modal
        title={supplierAction?.supplier ? "编辑供应商" : "新建供应商"}
        open={Boolean(supplierAction)}
        destroyOnHidden
        okText="保存"
        confirmLoading={supplierMutation.isPending}
        onCancel={() => setSupplierAction(null)}
        onOk={() => {
          supplierForm.validateFields().then((values) => {
            supplierMutation.mutate({ supplier: supplierAction?.supplier, payload: buildSupplierPayload(values) });
          });
        }}
      >
        <Form form={supplierForm} layout="vertical" requiredMark={false}>
          <Row gutter={12}>
            <Col span={12}>
              <Form.Item name="code" label="编码" rules={[{ required: true, message: "请输入编码" }]}>
                <Input />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="status" label="状态" initialValue="ACTIVE">
                <Select options={[{ value: "ACTIVE", label: "启用" }, { value: "DISABLED", label: "停用" }]} />
              </Form.Item>
            </Col>
          </Row>
          <Form.Item name="name" label="名称" rules={[{ required: true, message: "请输入名称" }]}>
            <Input />
          </Form.Item>
          <Row gutter={12}>
            <Col span={12}>
              <Form.Item name="contact_name" label="联系人">
                <Input />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="phone" label="电话">
                <Input />
              </Form.Item>
            </Col>
          </Row>
          <Form.Item name="email" label="邮箱">
            <Input />
          </Form.Item>
          <Form.Item name="bank_account" label="结算账户">
            <Input />
          </Form.Item>
          <Form.Item name="remark" label="备注">
            <Input.TextArea rows={3} />
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        title={costTypeAction?.costType ? "编辑成本类型" : "新建成本类型"}
        open={Boolean(costTypeAction)}
        destroyOnHidden
        okText="保存"
        confirmLoading={costTypeMutation.isPending}
        onCancel={() => setCostTypeAction(null)}
        onOk={() => {
          costTypeForm.validateFields().then((values) => {
            costTypeMutation.mutate({ costType: costTypeAction?.costType, payload: buildCostTypePayload(values) });
          });
        }}
      >
        <Form form={costTypeForm} layout="vertical" requiredMark={false}>
          <Row gutter={12}>
            <Col span={12}>
              <Form.Item name="code" label="编码" rules={[{ required: true, message: "请输入编码" }]}>
                <Input />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="status" label="状态" initialValue="ACTIVE">
                <Select options={[{ value: "ACTIVE", label: "启用" }, { value: "DISABLED", label: "停用" }]} />
              </Form.Item>
            </Col>
          </Row>
          <Form.Item name="name" label="名称" rules={[{ required: true, message: "请输入名称" }]}>
            <Input />
          </Form.Item>
          <Form.Item name="category" label="分类">
            <Input placeholder="例如：LOGISTICS、WAREHOUSE、PURCHASE" />
          </Form.Item>
          <Form.Item name="remark" label="备注">
            <Input.TextArea rows={3} />
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        title={payableAction?.type === "edit" ? "编辑应付款" : "新建应付款"}
        open={payableAction?.type === "create" || payableAction?.type === "edit"}
        destroyOnHidden
        okText="保存"
        confirmLoading={payableMutation.isPending}
        onCancel={() => setPayableAction(null)}
        onOk={() => {
          payableForm.validateFields().then((values) => {
            payableMutation.mutate({ payable: payableAction?.payable, payload: buildPayablePayload(values) });
          });
        }}
      >
        <Form form={payableForm} layout="vertical" requiredMark={false}>
          <Form.Item name="supplier_id" label="供应商" rules={[{ required: true, message: "请选择供应商" }]}>
            <Select
              showSearch
              optionFilterProp="label"
              options={activeSuppliers.map((supplier) => ({
                value: supplier.id,
                label: `${supplier.code} / ${supplier.name}`,
              }))}
            />
          </Form.Item>
          <Form.Item name="cost_type_id" label="成本类型" rules={[{ required: true, message: "请选择成本类型" }]}>
            <Select
              showSearch
              optionFilterProp="label"
              options={activeCostTypes.map((costType) => ({
                value: costType.id,
                label: `${costType.code} / ${costType.name}`,
              }))}
            />
          </Form.Item>
          <Row gutter={12}>
            <Col span={12}>
              <Form.Item name="amount" label="金额" rules={[{ required: true, message: "请输入金额" }]}>
                <InputNumber min={0.01} precision={2} style={{ width: "100%" }} />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="currency" label="币种" initialValue="CNY">
                <Input />
              </Form.Item>
            </Col>
          </Row>
          <Row gutter={12}>
            <Col span={12}>
              <Form.Item name="source_type" label="来源类型">
                <Input placeholder="例如：WAYBILL_BATCH" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="source_id" label="来源 ID">
                <InputNumber min={1} precision={0} style={{ width: "100%" }} />
              </Form.Item>
            </Col>
          </Row>
          <Form.Item name="due_date" label="到期日">
            <Input type="date" />
          </Form.Item>
          <Form.Item name="description" label="说明">
            <Input.TextArea rows={3} />
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        title={payableAction?.type === "settle" ? "核销应付款" : "取消应付款"}
        open={payableAction?.type === "settle" || payableAction?.type === "cancel"}
        destroyOnHidden
        okText={payableAction?.type === "settle" ? "确认核销" : "确认取消"}
        okButtonProps={{ danger: payableAction?.type === "cancel" }}
        confirmLoading={settlePayableMutation.isPending || cancelPayableMutation.isPending}
        onCancel={() => setPayableAction(null)}
        onOk={() => {
          const payable = payableAction?.payable;
          const actionType = payableAction?.type;
          if (!payable || !actionType) {
            return;
          }
          payableReviewForm.validateFields().then((values) => {
            if (actionType === "settle") {
              settlePayableMutation.mutate({ payableId: payable.id, values });
              return;
            }
            cancelPayableMutation.mutate({ payableId: payable.id, values });
          });
        }}
      >
        {payableAction?.payable && (
          <Space orientation="vertical" size="middle" style={{ width: "100%" }}>
            <Alert
              type={payableAction.type === "settle" ? "info" : "warning"}
              showIcon
              message={`${payableAction.payable.payable_no} / ${payableAction.payable.supplier_name}`}
              description={`金额 ${formatMoney(payableAction.payable.amount, payableAction.payable.currency)}`}
            />
            <Form form={payableReviewForm} layout="vertical" requiredMark={false}>
              {payableAction.type === "settle" ? (
                <>
                  <Form.Item name="settlement_reference" label="核销凭证号">
                    <Input placeholder="例如：银行流水号、付款单号" />
                  </Form.Item>
                  <Form.Item name="settlement_note" label="核销备注">
                    <Input.TextArea rows={3} />
                  </Form.Item>
                </>
              ) : (
                <Form.Item name="cancel_reason" label="取消原因">
                  <Input.TextArea rows={3} />
                </Form.Item>
              )}
            </Form>
          </Space>
        )}
      </Modal>
    </Space>
  );
}
