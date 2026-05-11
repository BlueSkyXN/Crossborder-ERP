import { useCallback, useEffect, useState } from "react";
import { Button, Card, Form, Input, InputNumber, Modal, Select, Table, Tag, Typography, message } from "antd";
import type { ColumnsType, TablePaginationConfig } from "antd/es/table";
import {
  adminConfig,
  adminPurchases,
  type PurchaseOrder,
  type Warehouse,
} from "@crossborder-erp/api-client";
import { adminClient } from "../../api/client";

const { Title } = Typography;
const statusColors: Record<string, string> = {
  PENDING_REVIEW: "blue",
  PENDING_PAYMENT: "orange",
  PENDING_PROCUREMENT: "purple",
  PROCURED: "cyan",
  ARRIVED: "green",
  COMPLETED: "default",
  CANCELLED: "default",
  EXCEPTION: "red",
};

type ActionType = "review" | "procure" | "mark-arrived" | "convert-to-parcel";
type ActionForm = {
  review_remark?: string;
  purchase_amount?: number;
  external_order_no?: string;
  remark?: string;
  tracking_no?: string;
  carrier?: string;
  warehouse_id?: number;
  weight_kg?: number;
  length_cm?: number;
  width_cm?: number;
  height_cm?: number;
};

function normalizeList<T>(data: T[] | { items?: T[] }): T[] {
  return Array.isArray(data) ? data : data.items ?? [];
}

function actionByStatus(status: string): { type: ActionType; label: string } | null {
  if (status === "PENDING_REVIEW") return { type: "review", label: "审核" };
  if (status === "PENDING_PROCUREMENT" || status === "PAID") return { type: "procure", label: "采购" };
  if (status === "PROCURED" || status === "PROCURING") return { type: "mark-arrived", label: "到货" };
  if (status === "ARRIVED") return { type: "convert-to-parcel", label: "转包裹" };
  return null;
}

export function AdminPurchasesPage() {
  const [filterForm] = Form.useForm<{ status?: string }>();
  const [actionForm] = Form.useForm<ActionForm>();
  const [items, setItems] = useState<PurchaseOrder[]>([]);
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [pagination, setPagination] = useState({ current: 1, pageSize: 20, total: 0 });
  const [loading, setLoading] = useState(false);
  const [action, setAction] = useState<{ type: ActionType; row: PurchaseOrder } | null>(null);
  const [messageApi, contextHolder] = message.useMessage();

  useEffect(() => {
    adminConfig.warehouses
      .list(adminClient)
      .then((data) => setWarehouses(normalizeList(data)))
      .catch(() => undefined);
  }, []);

  const loadData = useCallback(
    async (page = 1, pageSize = 20) => {
      setLoading(true);
      try {
        const data = await adminPurchases.list(adminClient, {
          page,
          page_size: pageSize,
          ...filterForm.getFieldsValue(),
        });
        setItems(data.items ?? []);
        setPagination({
          current: data.pagination?.page ?? page,
          pageSize: data.pagination?.page_size ?? pageSize,
          total: data.pagination?.total ?? 0,
        });
      } catch (error) {
        messageApi.error(error instanceof Error ? error.message : "代购订单加载失败");
      } finally {
        setLoading(false);
      }
    },
    [filterForm, messageApi],
  );

  useEffect(() => {
    void Promise.resolve().then(() => loadData(1, 20));
  }, [loadData, pagination.pageSize]);

  const submitAction = useCallback(async () => {
    if (!action) return;
    const values = await actionForm.validateFields();

    if (action.type === "review") {
      await adminPurchases.review(adminClient, action.row.id, {
        review_remark: values.review_remark,
      });
    } else if (action.type === "procure") {
      await adminPurchases.markProcured(adminClient, action.row.id, {
        purchase_amount: values.purchase_amount,
        external_order_no: values.external_order_no,
        remark: values.remark,
      });
    } else if (action.type === "mark-arrived") {
      await adminPurchases.markArrived(adminClient, action.row.id, {
        tracking_no: values.tracking_no,
        remark: values.remark,
      });
    } else {
      await adminPurchases.convertToParcel(adminClient, action.row.id, {
        warehouse_id: values.warehouse_id,
        tracking_no: values.tracking_no,
        carrier: values.carrier,
        weight_kg: values.weight_kg,
        length_cm: values.length_cm,
        width_cm: values.width_cm,
        height_cm: values.height_cm,
        remark: values.remark,
      });
    }

    messageApi.success("操作成功");
    setAction(null);
    actionForm.resetFields();
    void loadData();
  }, [action, actionForm, loadData, messageApi]);

  const columns: ColumnsType<PurchaseOrder> = [
    { title: "订单号", dataIndex: "order_no" },
    { title: "用户邮箱", dataIndex: "user_email" },
    {
      title: "状态",
      dataIndex: "status",
      render: (value: string) => <Tag color={statusColors[value] ?? "default"}>{value}</Tag>,
    },
    { title: "来源", dataIndex: "source_type" },
    { title: "总金额", dataIndex: "total_amount" },
    { title: "创建时间", dataIndex: "created_at" },
    {
      title: "操作",
      render: (_, row) => {
        const item = actionByStatus(row.status);
        return item ? (
          <Button
            type="link"
            onClick={() => {
              actionForm.resetFields();
              setAction({ type: item.type, row });
            }}
          >
            {item.label}
          </Button>
        ) : null;
      },
    },
  ];

  const renderActionForm = () => {
    if (action?.type === "review") {
      return (
        <Form.Item name="review_remark" label="审核备注">
          <Input.TextArea rows={4} />
        </Form.Item>
      );
    }

    if (action?.type === "procure") {
      return (
        <>
          <Form.Item name="purchase_amount" label="采购金额" rules={[{ required: true }]}>
            <InputNumber min={0} precision={2} style={{ width: "100%" }} />
          </Form.Item>
          <Form.Item name="external_order_no" label="外部订单号">
            <Input />
          </Form.Item>
          <Form.Item name="remark" label="备注">
            <Input.TextArea rows={3} />
          </Form.Item>
        </>
      );
    }

    if (action?.type === "mark-arrived") {
      return (
        <>
          <Form.Item name="tracking_no" label="运单号" rules={[{ required: true }]}>
            <Input />
          </Form.Item>
          <Form.Item name="remark" label="备注">
            <Input.TextArea rows={3} />
          </Form.Item>
        </>
      );
    }

    return (
      <>
        <Form.Item name="warehouse_id" label="仓库" rules={[{ required: true }]}>
          <Select
            options={warehouses.map((warehouse) => ({
              value: warehouse.id,
              label: warehouse.name ?? warehouse.code ?? `仓库${warehouse.id}`,
            }))}
          />
        </Form.Item>
        <Form.Item name="tracking_no" label="运单号">
          <Input />
        </Form.Item>
        <Form.Item name="carrier" label="承运商">
          <Input />
        </Form.Item>
        <Form.Item name="weight_kg" label="重量(kg)" rules={[{ required: true }]}>
          <InputNumber min={0} precision={3} style={{ width: "100%" }} />
        </Form.Item>
        <Form.Item name="length_cm" label="长(cm)">
          <InputNumber min={0} precision={2} style={{ width: "100%" }} />
        </Form.Item>
        <Form.Item name="width_cm" label="宽(cm)">
          <InputNumber min={0} precision={2} style={{ width: "100%" }} />
        </Form.Item>
        <Form.Item name="height_cm" label="高(cm)">
          <InputNumber min={0} precision={2} style={{ width: "100%" }} />
        </Form.Item>
        <Form.Item name="remark" label="备注">
          <Input.TextArea rows={3} />
        </Form.Item>
      </>
    );
  };

  return (
    <div>
      {contextHolder}
      <Title level={4}>代购订单</Title>
      <Card style={{ borderRadius: "var(--radius-card)", marginBottom: 16 }}>
        <Form form={filterForm} layout="inline" onFinish={() => loadData(1, 20)}>
          <Form.Item name="status" label="状态">
            <Select
              allowClear
              style={{ width: 200 }}
              options={Object.keys(statusColors).map((value) => ({ value, label: value }))}
            />
          </Form.Item>
          <Form.Item>
            <Button type="primary" htmlType="submit">
              查询
            </Button>
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
          onChange={(p: TablePaginationConfig) => loadData(p.current ?? 1, p.pageSize ?? 20)}
        />
      </Card>
      <Modal
        title="订单操作"
        open={!!action}
        onOk={() => {
          void submitAction().catch((error: unknown) => {
            messageApi.error(error instanceof Error ? error.message : "操作失败");
          });
        }}
        onCancel={() => setAction(null)}
      >
        <Form form={actionForm} layout="vertical">
          {renderActionForm()}
        </Form>
      </Modal>
    </div>
  );
}
