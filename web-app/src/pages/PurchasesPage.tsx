import { useEffect, useState } from "react";
import { Button, Card, Empty, Space, Table, Tag, Typography, message } from "antd";
import { useNavigate } from "react-router-dom";
import { memberPurchases } from "@crossborder-erp/api-client";
import type { PaginatedResponse, PurchaseOrder } from "@crossborder-erp/api-client";
import { memberClient } from "../api/client";

const { Title } = Typography;

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

export function PurchasesPage() {
  const [data, setData] = useState<PaginatedResponse<PurchaseOrder>>({
    items: [],
    pagination: { page: 1, page_size: 10, total: 0, total_pages: 0 },
  });
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const navigate = useNavigate();

  useEffect(() => {
    void Promise.resolve().then(() => {
      setLoading(true);
      memberPurchases.list(memberClient, { page })
        .then(setData)
        .catch(() => message.error("代购订单加载失败"))
        .finally(() => setLoading(false));
    });
  }, [page]);

  return (
    <Card style={{ borderRadius: "var(--radius-card)" }}>
      <Space style={{ width: "100%", justifyContent: "space-between", marginBottom: 16 }}>
        <Title level={4} style={{ margin: 0 }}>
          我的代购订单
        </Title>
        <Button type="primary" onClick={() => navigate("/purchase/manual")}>
          新建代购
        </Button>
      </Space>
      {data.items.length === 0 && !loading ? (
        <Empty description="暂无代购订单" />
      ) : (
        <Table<PurchaseOrder>
          rowKey="id"
          loading={loading}
          dataSource={data.items}
          onRow={(record) => ({
            onClick: () => navigate(`/purchases/${record.id}`),
            style: { cursor: "pointer" },
          })}
          pagination={{
            current: data.pagination.page,
            pageSize: data.pagination.page_size,
            total: data.pagination.total,
            onChange: (nextPage) => {
              setLoading(true);
              setPage(nextPage);
            },
          }}
          columns={[
            { title: "订单号", dataIndex: "order_no" },
            {
              title: "状态",
              dataIndex: "status",
              render: (status: string) => (
                <Tag color={statusColors[status] ?? "default"}>{status}</Tag>
              ),
            },
            { title: "来源", dataIndex: "source_type" },
            { title: "商品金额", dataIndex: "total_amount" },
            { title: "服务费", dataIndex: "service_fee" },
            { title: "创建时间", dataIndex: "created_at" },
          ]}
        />
      )}
    </Card>
  );
}
