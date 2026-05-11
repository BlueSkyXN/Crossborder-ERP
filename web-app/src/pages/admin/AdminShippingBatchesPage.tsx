import { useCallback, useEffect, useState } from "react";
import { Button, Card, Form, Input, Modal, Popconfirm, Space, Table, Tag, Typography, message } from "antd";
import type { ColumnsType, TablePaginationConfig } from "antd/es/table";
import { adminShippingBatches, type ShippingBatch } from "@crossborder-erp/api-client";
import { adminClient } from "../../api/client";

const { Title } = Typography;
const statusColors: Record<string, string> = {
  DRAFT: "default",
  LOCKED: "orange",
  SHIPPED: "green",
};

type AddForm = {
  waybill_ids: string;
};

export function AdminShippingBatchesPage() {
  const [items, setItems] = useState<ShippingBatch[]>([]);
  const [pagination, setPagination] = useState({ current: 1, pageSize: 20, total: 0 });
  const [loading, setLoading] = useState(false);
  const [creating, setCreating] = useState(false);
  const [selected, setSelected] = useState<ShippingBatch | null>(null);
  const [form] = Form.useForm<AddForm>();
  const [messageApi, contextHolder] = message.useMessage();

  const loadData = useCallback(
    async (page = 1, pageSize = 20) => {
      setLoading(true);
      try {
        const data = await adminShippingBatches.list(adminClient, {
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
        messageApi.error(error instanceof Error ? error.message : "批次列表加载失败");
      } finally {
        setLoading(false);
      }
    },
    [messageApi],
  );

  useEffect(() => {
    void Promise.resolve().then(() => loadData(1, 20));
  }, [loadData, pagination.pageSize]);

  const createBatch = useCallback(async () => {
    setCreating(true);
    try {
      await adminShippingBatches.create(adminClient, {});
      messageApi.success("批次已创建");
      void Promise.resolve().then(() => loadData(1, 20));
    } catch (error) {
      messageApi.error(error instanceof Error ? error.message : "创建失败");
    } finally {
      setCreating(false);
    }
  }, [loadData, messageApi]);

  const postAction = useCallback(
    async (row: ShippingBatch, action: "lock" | "ship") => {
      try {
        if (action === "lock") {
          await adminShippingBatches.lock(adminClient, row.id);
        } else {
          await adminShippingBatches.ship(adminClient, row.id);
        }
        messageApi.success("操作成功");
        void loadData();
      } catch (error) {
        messageApi.error(error instanceof Error ? error.message : "操作失败");
      }
    },
    [loadData, messageApi],
  );

  const addWaybills = useCallback(async () => {
    if (!selected) return;
    const values = await form.validateFields();
    const waybillIds = values.waybill_ids
      .split(/[,，\s]+/)
      .map((value) => Number(value))
      .filter(Number.isFinite);

    if (!waybillIds.length) {
      messageApi.error("请输入有效运单ID");
      return;
    }

    await adminShippingBatches.addWaybills(adminClient, selected.id, {
      waybill_ids: waybillIds,
    });
    messageApi.success("运单已加入批次");
    setSelected(null);
    form.resetFields();
    void loadData();
  }, [form, loadData, messageApi, selected]);

  const columns: ColumnsType<ShippingBatch> = [
    { title: "批次号", render: (_, row) => row.batch_no ?? row.batch_number },
    {
      title: "状态",
      dataIndex: "status",
      render: (value: string) => <Tag color={statusColors[value] ?? "default"}>{value}</Tag>,
    },
    { title: "运单数", dataIndex: "waybill_count" },
    { title: "创建时间", dataIndex: "created_at" },
    {
      title: "操作",
      render: (_, row) => (
        <Space>
          <Button
            type="link"
            onClick={() => {
              form.resetFields();
              setSelected(row);
            }}
          >
            添加运单
          </Button>
          <Popconfirm title="确认锁定批次？" onConfirm={() => void postAction(row, "lock")}>
            <Button type="link" disabled={row.status !== "DRAFT"}>
              锁定
            </Button>
          </Popconfirm>
          <Popconfirm title="确认发货？" onConfirm={() => void postAction(row, "ship")}>
            <Button type="link" disabled={row.status === "SHIPPED"}>
              发货
            </Button>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  return (
    <div>
      {contextHolder}
      <Title level={4}>发货批次</Title>
      <Card style={{ borderRadius: "var(--radius-card)", marginBottom: 16 }}>
        <Button type="primary" loading={creating} onClick={() => void createBatch()}>
          创建批次
        </Button>
      </Card>
      <Card style={{ borderRadius: "var(--radius-card)" }}>
        <Table
          rowKey="id"
          columns={columns}
          dataSource={items}
          loading={loading}
          pagination={pagination}
          onChange={(p: TablePaginationConfig) => loadData(p.current ?? 1, p.pageSize ?? 20)}
        />
      </Card>
      <Modal
        title="添加运单"
        open={!!selected}
        onOk={() => {
          void addWaybills().catch((error: unknown) => {
            messageApi.error(error instanceof Error ? error.message : "添加失败");
          });
        }}
        onCancel={() => setSelected(null)}
      >
        <Form form={form} layout="vertical">
          <Form.Item name="waybill_ids" label="运单ID" rules={[{ required: true, message: "请输入运单ID" }]}>
            <Input.TextArea rows={4} placeholder="多个ID用逗号、空格或换行分隔" />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}
