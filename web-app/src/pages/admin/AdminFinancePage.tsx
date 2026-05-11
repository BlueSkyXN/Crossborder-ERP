import { useCallback, useEffect, useState } from "react";
import { Button, Card, Form, Input, InputNumber, Modal, Select, Space, Table, Tabs, Tag, Typography, message } from "antd";
import type { ColumnsType, TablePaginationConfig } from "antd/es/table";
import { adminFinance, type Remittance, type WalletTransaction } from "@crossborder-erp/api-client";
import { adminClient } from "../../api/client";

const { Title } = Typography;
const remittanceColors: Record<string, string> = {
  PENDING: "blue",
  COMPLETED: "green",
  APPROVED: "green",
  CANCELLED: "default",
  REJECTED: "red",
};

type ReviewForm = {
  review_remark?: string;
};

type WalletForm = {
  user_id: number;
  amount: number;
  remark?: string;
  action: "recharge" | "deduct";
};

function RemittanceTab() {
  const [items, setItems] = useState<Remittance[]>([]);
  const [pagination, setPagination] = useState({ current: 1, pageSize: 20, total: 0 });
  const [loading, setLoading] = useState(false);
  const [action, setAction] = useState<{ type: "approve" | "cancel"; row: Remittance } | null>(null);
  const [form] = Form.useForm<ReviewForm>();
  const [messageApi, contextHolder] = message.useMessage();

  const loadData = useCallback(
    async (page = 1, pageSize = 20) => {
      setLoading(true);
      try {
        const data = await adminFinance.listRemittances(adminClient, {
          page,
          page_size: pageSize,
        });
        setItems(data.items ?? []);
        setPagination({
          current: data.pagination?.page ?? page,
          pageSize: data.pagination?.page_size ?? pageSize,
          total: data.pagination?.total ?? 0,
        });
      } catch (error) {
        messageApi.error(error instanceof Error ? error.message : "汇款列表加载失败");
      } finally {
        setLoading(false);
      }
    },
    [messageApi],
  );

  useEffect(() => {
    void Promise.resolve().then(() => loadData(1, 20));
  }, [loadData, pagination.pageSize]);

  const submit = useCallback(async () => {
    if (!action) return;
    const values = await form.validateFields();
    if (action.type === "approve") {
      await adminFinance.approveRemittance(adminClient, action.row.id, values);
    } else {
      await adminFinance.cancelRemittance(adminClient, action.row.id, values);
    }
    messageApi.success("操作成功");
    setAction(null);
    form.resetFields();
    void loadData();
  }, [action, form, loadData, messageApi]);

  const columns: ColumnsType<Remittance> = [
    { title: "申请号", dataIndex: "request_no" },
    { title: "用户", dataIndex: "user_email" },
    { title: "金额", render: (_, row) => `${row.amount ?? "-"} ${row.currency ?? ""}` },
    {
      title: "状态",
      dataIndex: "status",
      render: (value: string) => <Tag color={remittanceColors[value] ?? "default"}>{value}</Tag>,
    },
    { title: "凭证", dataIndex: "proof_file_name" },
    { title: "创建时间", dataIndex: "created_at" },
    {
      title: "操作",
      render: (_, row) => (row.status === "PENDING" ? (
        <Space>
          <Button type="link" onClick={() => setAction({ type: "approve", row })}>
            通过
          </Button>
          <Button type="link" danger onClick={() => setAction({ type: "cancel", row })}>
            取消
          </Button>
        </Space>
      ) : null),
    },
  ];

  return (
    <>
      {contextHolder}
      <Table
        rowKey="id"
        columns={columns}
        dataSource={items}
        loading={loading}
        pagination={pagination}
        onChange={(p: TablePaginationConfig) => loadData(p.current ?? 1, p.pageSize ?? 20)}
      />
      <Modal
        title="汇款审核"
        open={!!action}
        onOk={() => {
          void submit().catch((error: unknown) => {
            messageApi.error(error instanceof Error ? error.message : "操作失败");
          });
        }}
        onCancel={() => setAction(null)}
      >
        <Form form={form} layout="vertical">
          <Form.Item name="review_remark" label="审核备注">
            <Input.TextArea rows={4} />
          </Form.Item>
        </Form>
      </Modal>
    </>
  );
}

function WalletTab() {
  const [form] = Form.useForm<WalletForm>();
  const [loading, setLoading] = useState(false);
  const [messageApi, contextHolder] = message.useMessage();

  const submit = async (values: WalletForm) => {
    setLoading(true);
    try {
      const payload = { amount: values.amount, remark: values.remark };
      if (values.action === "recharge") {
        await adminFinance.rechargeWallet(adminClient, values.user_id, payload);
      } else {
        await adminFinance.deductWallet(adminClient, values.user_id, payload);
      }
      messageApi.success("钱包操作成功");
      form.resetFields();
    } catch (error) {
      messageApi.error(error instanceof Error ? error.message : "钱包操作失败");
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      {contextHolder}
      <Form
        form={form}
        layout="vertical"
        style={{ maxWidth: 520 }}
        initialValues={{ action: "recharge" }}
        onFinish={(values) => void submit(values)}
      >
        <Form.Item name="user_id" label="用户ID" rules={[{ required: true }]}>
          <InputNumber min={1} precision={0} style={{ width: "100%" }} />
        </Form.Item>
        <Form.Item name="amount" label="金额" rules={[{ required: true }]}>
          <InputNumber min={0} precision={2} style={{ width: "100%" }} />
        </Form.Item>
        <Form.Item name="remark" label="备注">
          <Input.TextArea rows={3} />
        </Form.Item>
        <Form.Item name="action" label="操作类型" rules={[{ required: true }]}>
          <Select
            options={[
              { value: "recharge", label: "充值" },
              { value: "deduct", label: "扣款" },
            ]}
          />
        </Form.Item>
        <Button type="primary" htmlType="submit" loading={loading}>
          提交
        </Button>
      </Form>
    </>
  );
}

function TransactionsTab() {
  const [items, setItems] = useState<WalletTransaction[]>([]);
  const [pagination, setPagination] = useState({ current: 1, pageSize: 20, total: 0 });
  const [loading, setLoading] = useState(false);
  const [messageApi, contextHolder] = message.useMessage();

  const loadData = useCallback(
    async (page = 1, pageSize = 20) => {
      setLoading(true);
      try {
        const data = await adminFinance.listTransactions(adminClient, {
          page,
          page_size: pageSize,
        });
        setItems(data.items ?? []);
        setPagination({
          current: data.pagination?.page ?? page,
          pageSize: data.pagination?.page_size ?? pageSize,
          total: data.pagination?.total ?? 0,
        });
      } catch (error) {
        messageApi.error(error instanceof Error ? error.message : "流水加载失败");
      } finally {
        setLoading(false);
      }
    },
    [messageApi],
  );

  useEffect(() => {
    void Promise.resolve().then(() => loadData(1, 20));
  }, [loadData, pagination.pageSize]);

  const columns: ColumnsType<WalletTransaction> = [
    { title: "用户", dataIndex: "user_email" },
    { title: "类型", dataIndex: "type" },
    { title: "方向", dataIndex: "direction" },
    { title: "金额", dataIndex: "amount" },
    { title: "余额", dataIndex: "balance_after" },
    { title: "业务", dataIndex: "business_type" },
    { title: "备注", dataIndex: "remark" },
    { title: "时间", dataIndex: "created_at" },
  ];

  return (
    <>
      {contextHolder}
      <Table
        rowKey="id"
        columns={columns}
        dataSource={items}
        loading={loading}
        pagination={pagination}
        onChange={(p: TablePaginationConfig) => loadData(p.current ?? 1, p.pageSize ?? 20)}
      />
    </>
  );
}

export function AdminFinancePage() {
  return (
    <div>
      <Title level={4}>财务中心</Title>
      <Card style={{ borderRadius: "var(--radius-card)" }}>
        <Tabs
          items={[
            { key: "remittances", label: "汇款审核", children: <RemittanceTab /> },
            { key: "wallet", label: "钱包充值/扣款", children: <WalletTab /> },
            { key: "transactions", label: "交易流水", children: <TransactionsTab /> },
          ]}
        />
      </Card>
    </div>
  );
}
