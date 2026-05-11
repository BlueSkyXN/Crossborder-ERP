import { useCallback, useEffect, useState } from "react";
import {
  Button,
  Card,
  DatePicker,
  Form,
  Input,
  InputNumber,
  Modal,
  Select,
  Table,
  Tag,
  Typography,
  message,
} from "antd";
import type { ColumnsType, TablePaginationConfig } from "antd/es/table";
import { adminWaybills, type Waybill } from "@crossborder-erp/api-client";
import { adminClient } from "../../api/client";

const { Title } = Typography;
const statusColors: Record<string, string> = {
  DRAFT: "default",
  PENDING_REVIEW: "blue",
  PENDING_PACKING: "orange",
  PENDING_PAYMENT: "red",
  PENDING_SHIPMENT: "cyan",
  SHIPPED: "purple",
  IN_TRANSIT: "geekblue",
  SIGNED: "green",
  CANCELLED: "default",
  PROBLEM: "red",
};

type ActionType = "review" | "set-fee" | "ship" | "tracking-events";
type ActionForm = {
  review_remark?: string;
  fee_total?: number;
  fee_detail_json?: string;
  fee_remark?: string;
  status_text?: string;
  location?: string;
  description?: string;
  event_time?: { toISOString?: () => string };
};

function actionByStatus(status: string): { type: ActionType; label: string } | null {
  if (status === "PENDING_REVIEW") return { type: "review", label: "审核" };
  if (status === "PENDING_PACKING" || status === "PENDING_FEE") return { type: "set-fee", label: "计费" };
  if (status === "PENDING_SHIPMENT" || status === "PAID") return { type: "ship", label: "发货" };
  if (status === "SHIPPED" || status === "IN_TRANSIT") {
    return { type: "tracking-events", label: "添加轨迹" };
  }
  return null;
}

export function AdminWaybillsPage() {
  const [filterForm] = Form.useForm<{ status?: string }>();
  const [actionForm] = Form.useForm<ActionForm>();
  const [items, setItems] = useState<Waybill[]>([]);
  const [pagination, setPagination] = useState({ current: 1, pageSize: 20, total: 0 });
  const [loading, setLoading] = useState(false);
  const [action, setAction] = useState<{ type: ActionType; row: Waybill } | null>(null);
  const [messageApi, contextHolder] = message.useMessage();

  const loadData = useCallback(
    async (page = 1, pageSize = 20) => {
      setLoading(true);
      try {
        const data = await adminWaybills.list(adminClient, {
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
        messageApi.error(error instanceof Error ? error.message : "运单列表加载失败");
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
    const eventTime = values.event_time?.toISOString?.();

    if (action.type === "review") {
      await adminWaybills.review(adminClient, action.row.id, {
        review_remark: values.review_remark,
      });
    } else if (action.type === "set-fee") {
      let feeDetail: Record<string, unknown> | undefined;
      if (values.fee_detail_json?.trim()) {
        try {
          feeDetail = JSON.parse(values.fee_detail_json) as Record<string, unknown>;
        } catch {
          messageApi.error("费用明细JSON格式不正确");
          return;
        }
      }
      await adminWaybills.setFee(adminClient, action.row.id, {
        fee_total: values.fee_total,
        fee_detail_json: feeDetail,
        fee_remark: values.fee_remark,
      });
    } else if (action.type === "ship") {
      await adminWaybills.ship(adminClient, action.row.id, {
        status_text: values.status_text,
        location: values.location,
        description: values.description,
        event_time: eventTime,
      });
    } else {
      await adminWaybills.addTrackingEvent(adminClient, action.row.id, {
        status_text: values.status_text,
        location: values.location,
        description: values.description,
        event_time: eventTime,
      });
    }

    messageApi.success("操作成功");
    setAction(null);
    actionForm.resetFields();
    void loadData();
  }, [action, actionForm, loadData, messageApi]);

  const columns: ColumnsType<Waybill> = [
    { title: "运单号", dataIndex: "waybill_no" },
    { title: "用户邮箱", dataIndex: "user_email" },
    { title: "渠道", dataIndex: "channel_name" },
    {
      title: "状态",
      dataIndex: "status",
      render: (value: string) => <Tag color={statusColors[value] ?? "default"}>{value}</Tag>,
    },
    { title: "目的国", dataIndex: "destination_country" },
    { title: "费用", dataIndex: "fee_total" },
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

    if (action?.type === "set-fee") {
      return (
        <>
          <Form.Item name="fee_total" label="费用总额" rules={[{ required: true, message: "请输入费用" }]}>
            <InputNumber min={0} precision={2} style={{ width: "100%" }} />
          </Form.Item>
          <Form.Item name="fee_detail_json" label="费用明细JSON">
            <Input.TextArea rows={4} />
          </Form.Item>
          <Form.Item name="fee_remark" label="费用备注">
            <Input.TextArea rows={3} />
          </Form.Item>
        </>
      );
    }

    return (
      <>
        <Form.Item name="status_text" label="状态文本" rules={[{ required: true }]}>
          <Input />
        </Form.Item>
        <Form.Item name="location" label="地点">
          <Input />
        </Form.Item>
        <Form.Item name="description" label="描述">
          <Input.TextArea rows={3} />
        </Form.Item>
        <Form.Item name="event_time" label="事件时间">
          <DatePicker showTime style={{ width: "100%" }} />
        </Form.Item>
      </>
    );
  };

  return (
    <div>
      {contextHolder}
      <Title level={4}>运单处理</Title>
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
        title="运单操作"
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
