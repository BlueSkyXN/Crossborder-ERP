import { useCallback, useEffect, useState } from "react";
import { Button, Card, Descriptions, Form, Input, Modal, Select, Space, Table, Tag, Typography, message } from "antd";
import type { ColumnsType, TablePaginationConfig } from "antd/es/table";
import { adminParcels, type Parcel } from "@crossborder-erp/api-client";
import { adminClient } from "../../api/client";

const { Title } = Typography;
const statusColors: Record<string, string> = {
  FORECASTED: "blue",
  IN_WAREHOUSE: "green",
  PACKED: "orange",
  SHIPPED: "purple",
  SIGNED: "default",
};

type Filters = {
  tracking_no?: string;
  parcel_no?: string;
  status?: string;
};

export function AdminParcelsPage() {
  const [form] = Form.useForm<Filters>();
  const [items, setItems] = useState<Parcel[]>([]);
  const [pagination, setPagination] = useState({ current: 1, pageSize: 20, total: 0 });
  const [loading, setLoading] = useState(false);
  const [selected, setSelected] = useState<Parcel | null>(null);
  const [messageApi, contextHolder] = message.useMessage();

  const loadData = useCallback(
    async (page = 1, pageSize = 20) => {
      setLoading(true);
      try {
        const data = await adminParcels.list(adminClient, {
          page,
          page_size: pageSize,
          ...form.getFieldsValue(),
        });
        setItems(data.items ?? []);
        setPagination({
          current: data.pagination?.page ?? page,
          pageSize: data.pagination?.page_size ?? pageSize,
          total: data.pagination?.total ?? 0,
        });
      } catch (error) {
        messageApi.error(error instanceof Error ? error.message : "包裹列表加载失败");
      } finally {
        setLoading(false);
      }
    },
    [form, messageApi],
  );

  useEffect(() => {
    void Promise.resolve().then(() => loadData(1, 20));
  }, [loadData, pagination.pageSize]);

  const columns: ColumnsType<Parcel> = [
    { title: "包裹号", dataIndex: "parcel_no" },
    { title: "用户邮箱", dataIndex: "user_email" },
    { title: "运单号", dataIndex: "tracking_no" },
    { title: "仓库", dataIndex: "warehouse_name" },
    {
      title: "状态",
      dataIndex: "status",
      render: (value: string) => <Tag color={statusColors[value] ?? "default"}>{value}</Tag>,
    },
    { title: "重量(kg)", dataIndex: "weight_kg" },
    { title: "入库时间", dataIndex: "inbound_at" },
  ];

  const onTableChange = (next: TablePaginationConfig) => {
    void loadData(next.current ?? 1, next.pageSize ?? 20);
  };

  return (
    <div>
      {contextHolder}
      <Title level={4}>包裹管理</Title>
      <Card style={{ borderRadius: "var(--radius-card)", marginBottom: 16 }}>
        <Form form={form} layout="inline" onFinish={() => loadData(1, 20)}>
          <Form.Item name="tracking_no" label="运单号">
            <Input allowClear placeholder="运单号" />
          </Form.Item>
          <Form.Item name="parcel_no" label="包裹号">
            <Input allowClear placeholder="包裹号" />
          </Form.Item>
          <Form.Item name="status" label="状态">
            <Select
              allowClear
              style={{ width: 180 }}
              options={Object.keys(statusColors).map((value) => ({ value, label: value }))}
            />
          </Form.Item>
          <Form.Item>
            <Space>
              <Button type="primary" htmlType="submit">
                查询
              </Button>
              <Button
                onClick={() => {
                  form.resetFields();
                  void Promise.resolve().then(() => loadData(1, 20));
                }}
              >
                重置
              </Button>
            </Space>
          </Form.Item>
        </Form>
      </Card>
      <Card style={{ borderRadius: "var(--radius-card)" }}>
        <Table
          rowKey="id"
          columns={columns}
          dataSource={items}
          loading={loading}
          pagination={pagination}
          onChange={onTableChange}
          onRow={(record) => ({
            onClick: () => setSelected(record),
            style: { cursor: "pointer" },
          })}
        />
      </Card>
      <Modal title="包裹详情" open={!!selected} onCancel={() => setSelected(null)} footer={null} width={760}>
        {selected && (
          <Descriptions
            column={2}
            bordered
            size="small"
            items={Object.entries(selected).map(([key, value]) => ({
              key,
              label: key,
              children: String(value ?? "-"),
            }))}
          />
        )}
      </Modal>
    </div>
  );
}
