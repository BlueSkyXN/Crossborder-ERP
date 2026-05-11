import { useCallback, useEffect, useState } from "react";
import { Button, Card, Descriptions, Empty, Space, Spin, Table, Tag, Typography, message } from "antd";
import { useNavigate, useParams } from "react-router-dom";
import { memberPurchases } from "@crossborder-erp/api-client";
import type { PurchaseOrder, PurchaseOrderItem } from "@crossborder-erp/api-client";
import { memberClient } from "../api/client";

const { Title, Link } = Typography;

const statusColors: Record<string, string> = {
  PENDING_REVIEW: "blue",
  PENDING_PAYMENT: "orange",
  PAID: "cyan",
  PROCURING: "purple",
  ARRIVED: "green",
  CONVERTED: "default",
  CANCELLED: "default",
  EXCEPTION: "red",
};

export function PurchaseDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [order, setOrder] = useState<PurchaseOrder | null>(null);
  const [loading, setLoading] = useState(true);
  const [paying, setPaying] = useState(false);

  const load = useCallback(() => {
    if (!id) return;
    setLoading(true);
    memberPurchases.getById(memberClient, id)
      .then(setOrder)
      .catch(() => message.error("代购详情加载失败"))
      .finally(() => setLoading(false));
  }, [id]);

  useEffect(() => {
    void Promise.resolve().then(load);
  }, [load]);

  const pay = async () => {
    if (!id) return;
    setPaying(true);
    try {
      await memberPurchases.pay(memberClient, id, {
        idempotency_key: `purchase-pay-${id}-${Date.now()}`,
      });
      message.success("支付成功");
      load();
    } catch {
      message.error("支付失败");
    } finally {
      setPaying(false);
    }
  };

  if (loading) {
    return <Spin size="large" style={{ display: "block", margin: "120px auto" }} />;
  }
  if (!order) return <Empty description="未找到订单" />;

  return (
    <Space orientation="vertical" size="large" style={{ width: "100%" }}>
      <Space>
        <Button onClick={() => navigate("/purchases")}>返回代购列表</Button>
        <Title level={4} style={{ margin: 0 }}>
          代购详情
        </Title>
        {order.status === "PENDING_PAYMENT" && (
          <Button type="primary" loading={paying} onClick={pay}>
            支付
          </Button>
        )}
      </Space>
      <Card style={{ borderRadius: "var(--radius-card)" }}>
        <Descriptions
          bordered
          column={2}
          items={[
            { key: "order_no", label: "订单号", children: order.order_no },
            {
              key: "status",
              label: "状态",
              children: <Tag color={statusColors[order.status] ?? "default"}>{order.status}</Tag>,
            },
            { key: "total", label: "商品金额", children: order.total_amount ?? "-" },
            { key: "fee", label: "服务费", children: order.service_fee ?? "-" },
            { key: "created", label: "创建时间", children: order.created_at },
            { key: "updated", label: "更新时间", children: order.updated_at },
          ]}
        />
      </Card>
      <Card title="商品明细" style={{ borderRadius: "var(--radius-card)" }}>
        <Table<PurchaseOrderItem>
          rowKey="id"
          dataSource={order.items ?? []}
          pagination={false}
          columns={[
            { title: "商品名称", dataIndex: "name" },
            { title: "数量", dataIndex: "quantity" },
            { title: "单价", dataIndex: "unit_price" },
            { title: "实际采购价", dataIndex: "actual_price" },
            {
              title: "商品链接",
              dataIndex: "product_url",
              render: (url?: string) => (url ? <Link href={url} target="_blank">查看</Link> : "-"),
            },
          ]}
        />
      </Card>
      {order.procurement_task && (
        <Card title="采购任务" style={{ borderRadius: "var(--radius-card)" }}>
          <Descriptions
            column={2}
            items={[
              { key: "status", label: "状态", children: order.procurement_task.status },
              { key: "amount", label: "采购金额", children: order.procurement_task.purchase_amount ?? "-" },
              {
                key: "external",
                label: "外部订单号",
                children: order.procurement_task.external_order_no ?? "-",
              },
              { key: "tracking", label: "快递单号", children: order.procurement_task.tracking_no ?? "-" },
              { key: "remark", label: "备注", children: order.procurement_task.remark ?? "-" },
            ]}
          />
        </Card>
      )}
      {order.converted_parcel && (
        <Card title="已转换包裹" style={{ borderRadius: "var(--radius-card)" }}>
          <Button type="link" onClick={() => navigate(`/parcels/${order.converted_parcel?.id ?? ""}`)}>
            {order.converted_parcel.parcel_no} · {order.converted_parcel.tracking_no} · {order.converted_parcel.status}
          </Button>
        </Card>
      )}
    </Space>
  );
}
