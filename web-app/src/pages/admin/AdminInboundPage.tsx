import { useCallback, useEffect, useState } from "react";
import {
  Alert,
  Button,
  Card,
  Descriptions,
  Form,
  Input,
  InputNumber,
  Select,
  Space,
  Table,
  Typography,
  message,
} from "antd";
import type { ColumnsType } from "antd/es/table";
import {
  adminConfig,
  adminParcels,
  type ScanInboundResponse,
  type Warehouse,
} from "@crossborder-erp/api-client";
import { adminClient } from "../../api/client";

const { Title } = Typography;

type ScanForm = {
  warehouse_id: number;
  tracking_no: string;
  weight_kg: number;
  length_cm?: number;
  width_cm?: number;
  height_cm?: number;
  remark?: string;
};

type HistoryRow = {
  key: number;
  time: string;
  tracking_no: string;
  result: string;
  warehouse?: string;
  weight_kg?: number;
};

function normalizeList<T>(data: T[] | { items?: T[] }): T[] {
  return Array.isArray(data) ? data : data.items ?? [];
}

export function AdminInboundPage() {
  const [form] = Form.useForm<ScanForm>();
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<ScanInboundResponse | null>(null);
  const [history, setHistory] = useState<HistoryRow[]>([]);
  const [messageApi, contextHolder] = message.useMessage();

  useEffect(() => {
    adminConfig.warehouses
      .list(adminClient)
      .then((data) => setWarehouses(normalizeList(data)))
      .catch(() => messageApi.error("仓库列表加载失败"));
  }, [messageApi]);

  const onFinish = useCallback(
    async (values: ScanForm) => {
      setLoading(true);
      try {
        const data = await adminParcels.scanInbound(adminClient, {
          ...values,
          photo_file_ids: [],
        });
        setResult(data);

        const warehouse = warehouses.find((item) => item.id === values.warehouse_id);
        setHistory((rows) => [
          {
            key: Date.now(),
            time: new Date().toLocaleString(),
            tracking_no: values.tracking_no,
            warehouse: warehouse?.name ?? warehouse?.code,
            weight_kg: values.weight_kg,
            result: data.parcel ? "匹配包裹" : "创建无主包裹",
          },
          ...rows,
        ].slice(0, 20));
        messageApi.success("入库扫描完成");
        form.resetFields();
      } catch (error) {
        messageApi.error(error instanceof Error ? error.message : "入库扫描失败");
      } finally {
        setLoading(false);
      }
    },
    [form, messageApi, warehouses],
  );

  const columns: ColumnsType<HistoryRow> = [
    { title: "时间", dataIndex: "time" },
    { title: "运单号", dataIndex: "tracking_no" },
    { title: "仓库", dataIndex: "warehouse" },
    { title: "重量(kg)", dataIndex: "weight_kg" },
    { title: "结果", dataIndex: "result" },
  ];

  return (
    <div>
      {contextHolder}
      <Title level={4}>包裹入库</Title>
      <Card style={{ borderRadius: "var(--radius-card)", marginBottom: 16 }}>
        <Form form={form} layout="vertical" onFinish={onFinish}>
          <Space wrap align="start" size={16}>
            <Form.Item
              name="warehouse_id"
              label="仓库"
              rules={[{ required: true, message: "请选择仓库" }]}
            >
              <Select
                style={{ width: 220 }}
                placeholder="选择仓库"
                options={warehouses.map((item) => ({
                  value: item.id,
                  label: item.name ?? item.code ?? `仓库${item.id}`,
                }))}
              />
            </Form.Item>
            <Form.Item
              name="tracking_no"
              label="运单号"
              rules={[{ required: true, message: "请输入运单号" }]}
            >
              <Input style={{ width: 260 }} placeholder="扫描或输入运单号" autoFocus />
            </Form.Item>
            <Form.Item
              name="weight_kg"
              label="重量(kg)"
              rules={[{ required: true, message: "请输入重量" }]}
            >
              <InputNumber min={0} precision={3} style={{ width: 130 }} />
            </Form.Item>
            <Form.Item name="length_cm" label="长(cm)">
              <InputNumber min={0} precision={1} style={{ width: 110 }} />
            </Form.Item>
            <Form.Item name="width_cm" label="宽(cm)">
              <InputNumber min={0} precision={1} style={{ width: 110 }} />
            </Form.Item>
            <Form.Item name="height_cm" label="高(cm)">
              <InputNumber min={0} precision={1} style={{ width: 110 }} />
            </Form.Item>
          </Space>
          <Form.Item name="remark" label="备注">
            <Input.TextArea rows={2} placeholder="可填写异常说明或入库备注" />
          </Form.Item>
          <Button type="primary" htmlType="submit" loading={loading}>
            确认入库
          </Button>
        </Form>
      </Card>

      {result && (
        <Card style={{ borderRadius: "var(--radius-card)", marginBottom: 16 }}>
          <Alert
            type={result.created_unclaimed ? "warning" : "success"}
            showIcon
            title={result.created_unclaimed ? "无主包裹已创建" : "已匹配预报包裹"}
            style={{ marginBottom: 12 }}
          />
          {result.parcel && (
            <Descriptions size="small" column={3} bordered>
              <Descriptions.Item label="包裹号">{result.parcel.parcel_no}</Descriptions.Item>
              <Descriptions.Item label="用户">{result.parcel.user_email}</Descriptions.Item>
              <Descriptions.Item label="运单号">{result.parcel.tracking_no}</Descriptions.Item>
              <Descriptions.Item label="仓库">{result.parcel.warehouse_name}</Descriptions.Item>
              <Descriptions.Item label="状态">{result.parcel.status}</Descriptions.Item>
              <Descriptions.Item label="重量">{result.parcel.weight_kg}</Descriptions.Item>
            </Descriptions>
          )}
        </Card>
      )}

      <Card title="最近扫描" style={{ borderRadius: "var(--radius-card)" }}>
        <Table size="small" rowKey="key" columns={columns} dataSource={history} pagination={false} />
      </Card>
    </div>
  );
}
