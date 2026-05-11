import { useCallback, useEffect, useState } from "react";
import { Button, Card, Descriptions, Empty, Space, Spin, Table, Tag, Timeline, Typography, message } from "antd";
import { useNavigate, useParams } from "react-router-dom";
import { memberWaybills } from "@crossborder-erp/api-client";
import type { Waybill, WaybillParcel } from "@crossborder-erp/api-client";
import { memberClient } from "../api/client";

const { Title, Text } = Typography;

type RecipientSnapshot = {
  name?: string;
  recipient_name?: string;
  phone?: string;
  recipient_phone?: string;
  address?: string;
  recipient_address?: string;
  postal_code?: string;
};

const statusColors: Record<string, string> = {
  DRAFT: "default",
  PENDING_REVIEW: "blue",
  PENDING_FEE: "orange",
  PENDING_PAYMENT: "red",
  PAID: "cyan",
  SHIPPED: "purple",
  IN_TRANSIT: "geekblue",
  SIGNED: "green",
  CANCELLED: "default",
};

export function WaybillDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [waybill, setWaybill] = useState<Waybill | null>(null);
  const [loading, setLoading] = useState(true);
  const [acting, setActing] = useState(false);

  const load = useCallback(() => {
    if (!id) return;
    setLoading(true);
    memberWaybills.getById(memberClient, id)
      .then(setWaybill)
      .catch(() => message.error("运单详情加载失败"))
      .finally(() => setLoading(false));
  }, [id]);

  useEffect(() => {
    void Promise.resolve().then(load);
  }, [load]);

  const pay = async () => {
    if (!id) return;
    setActing(true);
    try {
      await memberWaybills.pay(memberClient, id, {
        idempotency_key: `waybill-pay-${id}-${Date.now()}`,
      });
      message.success("支付成功");
      load();
    } catch {
      message.error("操作失败");
    } finally {
      setActing(false);
    }
  };

  const confirmReceipt = async () => {
    if (!id) return;
    setActing(true);
    try {
      await memberWaybills.confirmReceipt(memberClient, id);
      message.success("已确认收货");
      load();
    } catch {
      message.error("操作失败");
    } finally {
      setActing(false);
    }
  };

  if (loading) {
    return <Spin size="large" style={{ display: "block", margin: "120px auto" }} />;
  }
  if (!waybill) return <Empty description="未找到运单" />;

  const recipient = (waybill.recipient_snapshot ?? {}) as RecipientSnapshot;
  const events = [...(waybill.tracking_events ?? [])].sort(
    (a, b) => new Date(b.event_time).getTime() - new Date(a.event_time).getTime(),
  );

  return (
    <Space orientation="vertical" size="large" style={{ width: "100%" }}>
      <Space wrap>
        <Button onClick={() => navigate("/waybills")}>返回运单列表</Button>
        <Title level={4} style={{ margin: 0 }}>
          运单详情
        </Title>
        {waybill.status === "PENDING_PAYMENT" && (
          <Button type="primary" loading={acting} onClick={pay}>
            余额支付
          </Button>
        )}
        {["SIGNED", "SHIPPED"].includes(waybill.status) && (
          <Button type="primary" loading={acting} onClick={confirmReceipt}>
            确认收货
          </Button>
        )}
      </Space>
      <Card style={{ borderRadius: "var(--radius-card)" }}>
        <Descriptions
          bordered
          column={2}
          items={[
            { key: "waybill_no", label: "运单号", children: waybill.waybill_no },
            {
              key: "status",
              label: "状态",
              children: <Tag color={statusColors[waybill.status] ?? "default"}>{waybill.status}</Tag>,
            },
            { key: "channel", label: "渠道", children: waybill.channel_name },
            { key: "country", label: "目的国", children: waybill.destination_country },
            { key: "fee", label: "费用合计", children: waybill.fee_total ?? "-" },
            { key: "created", label: "创建时间", children: waybill.created_at },
            { key: "updated", label: "更新时间", children: waybill.updated_at },
            { key: "remark", label: "备注", children: waybill.remark ?? "-" },
          ]}
        />
      </Card>
      <Card title="收件人信息" style={{ borderRadius: "var(--radius-card)" }}>
        <Descriptions
          column={2}
          items={[
            { key: "name", label: "姓名", children: recipient.name ?? recipient.recipient_name ?? "-" },
            { key: "phone", label: "电话", children: recipient.phone ?? recipient.recipient_phone ?? "-" },
            {
              key: "address",
              label: "地址",
              children: recipient.address ?? recipient.recipient_address ?? "-",
              span: 2,
            },
            { key: "postal", label: "邮编", children: recipient.postal_code ?? "-" },
          ]}
        />
      </Card>
      <Card title="包裹列表" style={{ borderRadius: "var(--radius-card)" }}>
        <Table<WaybillParcel>
          rowKey="id"
          dataSource={waybill.parcels ?? []}
          pagination={false}
          columns={[
            { title: "包裹号", dataIndex: "parcel_no" },
            { title: "快递单号", dataIndex: "tracking_no" },
            { title: "重量(kg)", dataIndex: "weight_kg", render: (value?: number) => value ?? "-" },
          ]}
        />
      </Card>
      <Card title="物流轨迹" style={{ borderRadius: "var(--radius-card)" }}>
        {events.length === 0 ? (
          <Empty description="暂无轨迹" />
        ) : (
          <Timeline
            items={events.map((event) => ({
              children: (
                <div>
                  <Text strong>{event.status_text}</Text>
                  <div>{event.event_time} · {event.location ?? "未知地点"}</div>
                  <div>{event.description}</div>
                </div>
              ),
            }))}
          />
        )}
      </Card>
    </Space>
  );
}
