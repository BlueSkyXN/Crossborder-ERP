import {
  CheckCircleOutlined,
  CloseCircleOutlined,
  FileSearchOutlined,
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
  Modal,
  Row,
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
import type { PaymentOrder, RechargeRequest, RemittanceStatus, WalletTransaction } from "./types";

type WorkspaceContext = {
  allowedCodes: Set<string>;
};

type ActiveStatus = "ALL" | RemittanceStatus;
type ReviewAction = {
  type: "approve" | "cancel";
  remittance: RechargeRequest;
};
type ReviewFormValues = {
  review_remark?: string;
};

const remittancesQueryKey = ["admin-finance-remittances"] as const;
const walletTransactionsQueryKey = ["admin-finance-wallet-transactions"] as const;
const paymentOrdersQueryKey = ["admin-finance-payment-orders"] as const;

const remittanceStatusMeta: Record<RemittanceStatus, { color: string; label: string }> = {
  PENDING: { color: "gold", label: "待审核" },
  COMPLETED: { color: "green", label: "已入账" },
  CANCELLED: { color: "default", label: "已取消" },
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

function statusTag(status: RemittanceStatus) {
  const meta = remittanceStatusMeta[status];
  return <Tag color={meta.color}>{meta.label}</Tag>;
}

export function FinancePage() {
  const { allowedCodes } = useOutletContext<WorkspaceContext>();
  const queryClient = useQueryClient();
  const { message } = AntdApp.useApp();
  const [reviewForm] = Form.useForm<ReviewFormValues>();
  const [activeStatus, setActiveStatus] = useState<ActiveStatus>("PENDING");
  const [keyword, setKeyword] = useState("");
  const [reviewAction, setReviewAction] = useState<ReviewAction | null>(null);

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

  const remittances = useMemo(() => remittancesQuery.data ?? [], [remittancesQuery.data]);
  const walletTransactions = useMemo(
    () => walletTransactionsQuery.data ?? [],
    [walletTransactionsQuery.data],
  );
  const paymentOrders = useMemo(() => paymentOrdersQuery.data ?? [], [paymentOrdersQuery.data]);
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
  const pendingAmount = remittances
    .filter((remittance) => remittance.status === "PENDING")
    .reduce((total, remittance) => total + Number(remittance.amount || 0), 0);
  const completedAmount = remittances
    .filter((remittance) => remittance.status === "COMPLETED")
    .reduce((total, remittance) => total + Number(remittance.amount || 0), 0);
  const isReviewing = approveMutation.isPending || cancelMutation.isPending;

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
    {
      title: "状态",
      dataIndex: "status",
      width: 96,
      render: statusTag,
    },
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
    {
      title: "备注",
      dataIndex: "remark",
      ellipsis: true,
      render: (value, record) => value || record.review_remark || "-",
    },
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
          线下汇款审核、钱包流水和支付单查询。
        </Typography.Text>
      </div>

      {(remittancesQuery.isError || walletTransactionsQuery.isError || paymentOrdersQuery.isError) && (
        <Alert
          type="error"
          showIcon
          message="财务数据加载失败"
          description={getErrorMessage(remittancesQuery.error || walletTransactionsQuery.error || paymentOrdersQuery.error)}
        />
      )}

      <Row gutter={[16, 16]}>
        <Col xs={24} md={8}>
          <Card>
            <Statistic title="待审核汇款" value={remittances.filter((item) => item.status === "PENDING").length} />
          </Card>
        </Col>
        <Col xs={24} md={8}>
          <Card>
            <Statistic title="待审核金额" prefix="CNY" precision={2} value={pendingAmount} />
          </Card>
        </Col>
        <Col xs={24} md={8}>
          <Card>
            <Statistic title="已入账金额" prefix="CNY" precision={2} value={completedAmount} />
          </Card>
        </Col>
      </Row>

      <Tabs
        items={[
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
    </Space>
  );
}
