import { useCallback, useEffect, useState } from "react";
import { Button, Card, Form, Input, Modal, Space, Table, Tag, Typography, message } from "antd";
import type { ColumnsType, TablePaginationConfig } from "antd/es/table";
import { adminParcels, type UnclaimedParcel } from "@crossborder-erp/api-client";
import { adminClient } from "../../api/client";

const { Title } = Typography;
const statusColors: Record<string, string> = {
  UNCLAIMED: "orange",
  CLAIM_PENDING: "blue",
  CLAIMED: "blue",
  APPROVED: "green",
  REJECTED: "red",
};

type ReviewForm = {
  review_note?: string;
};

export function AdminUnclaimedPage() {
  const [items, setItems] = useState<UnclaimedParcel[]>([]);
  const [pagination, setPagination] = useState({ current: 1, pageSize: 20, total: 0 });
  const [loading, setLoading] = useState(false);
  const [action, setAction] = useState<{
    type: "approve" | "reject";
    row: UnclaimedParcel;
  } | null>(null);
  const [form] = Form.useForm<ReviewForm>();
  const [messageApi, contextHolder] = message.useMessage();

  const loadData = useCallback(
    async (page = 1, pageSize = 20) => {
      setLoading(true);
      try {
        const data = await adminParcels.listUnclaimed(adminClient, {
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
        messageApi.error(error instanceof Error ? error.message : "无主包裹加载失败");
      } finally {
        setLoading(false);
      }
    },
    [messageApi],
  );

  useEffect(() => {
    void Promise.resolve().then(() => loadData(1, 20));
  }, [loadData, pagination.pageSize]);

  const submitAction = useCallback(async () => {
    if (!action) return;
    const values = await form.validateFields();
    if (action.type === "approve") {
      await adminParcels.approveClaim(adminClient, action.row.id, values);
    } else {
      await adminParcels.rejectClaim(adminClient, action.row.id, values);
    }
    messageApi.success(action.type === "approve" ? "已审核通过" : "已驳回");
    setAction(null);
    form.resetFields();
    void loadData();
  }, [action, form, loadData, messageApi]);

  const columns: ColumnsType<UnclaimedParcel> = [
    { title: "运单号", dataIndex: "tracking_no" },
    { title: "仓库", dataIndex: "warehouse_name" },
    {
      title: "状态",
      dataIndex: "status",
      render: (value: string) => <Tag color={statusColors[value] ?? "default"}>{value}</Tag>,
    },
    { title: "认领人", dataIndex: "claimed_by_email" },
    { title: "重量(kg)", dataIndex: "weight_kg" },
    { title: "创建时间", dataIndex: "created_at" },
    {
      title: "操作",
      render: (_, row) => (row.status === "CLAIM_PENDING" ? (
        <Space>
          <Button
            type="link"
            onClick={() => {
              form.resetFields();
              setAction({ type: "approve", row });
            }}
          >
            通过
          </Button>
          <Button
            type="link"
            danger
            onClick={() => {
              form.resetFields();
              setAction({ type: "reject", row });
            }}
          >
            驳回
          </Button>
        </Space>
      ) : null),
    },
  ];

  const onTableChange = (next: TablePaginationConfig) => {
    void loadData(next.current ?? 1, next.pageSize ?? 20);
  };

  return (
    <div>
      {contextHolder}
      <Title level={4}>无主包裹</Title>
      <Card style={{ borderRadius: "var(--radius-card)" }}>
        <Table
          rowKey="id"
          columns={columns}
          dataSource={items}
          loading={loading}
          pagination={pagination}
          onChange={onTableChange}
        />
      </Card>
      <Modal
        title={action?.type === "approve" ? "审核通过" : "驳回认领"}
        open={!!action}
        onOk={() => {
          void submitAction().catch((error: unknown) => {
            messageApi.error(error instanceof Error ? error.message : "操作失败");
          });
        }}
        onCancel={() => setAction(null)}
      >
        <Form form={form} layout="vertical">
          <Form.Item name="review_note" label="审核备注">
            <Input.TextArea rows={4} />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}
