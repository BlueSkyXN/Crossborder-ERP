import { useEffect, useState } from "react";
import { Button, Card, Empty, Space, Table, Tag, Typography, message } from "antd";
import { useNavigate } from "react-router-dom";
import { memberWaybills } from "@crossborder-erp/api-client";
import type { PaginatedResponse, Waybill } from "@crossborder-erp/api-client";
import { memberClient } from "../api/client";

const { Title } = Typography;

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

export function WaybillsPage() {
  const [data, setData] = useState<PaginatedResponse<Waybill>>({
    items: [],
    pagination: { page: 1, page_size: 10, total: 0, total_pages: 0 },
  });
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const navigate = useNavigate();

  useEffect(() => {
    void Promise.resolve().then(() => {
      setLoading(true);
      memberWaybills.list(memberClient, { page })
        .then(setData)
        .catch(() => message.error("运单列表加载失败"))
        .finally(() => setLoading(false));
    });
  }, [page]);

  return (
    <Card style={{ borderRadius: "var(--radius-card)" }}>
      <Space style={{ width: "100%", justifyContent: "space-between", marginBottom: 16 }}>
        <Title level={4} style={{ margin: 0 }}>
          我的运单
        </Title>
        <Button type="primary" onClick={() => navigate("/waybills/create")}>
          创建运单
        </Button>
      </Space>
      {data.items.length === 0 && !loading ? (
        <Empty description="暂无运单" />
      ) : (
        <Table<Waybill>
          rowKey="id"
          loading={loading}
          dataSource={data.items}
          onRow={(record) => ({
            onClick: () => navigate(`/waybills/${record.id}`),
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
            { title: "运单号", dataIndex: "waybill_no" },
            { title: "渠道", dataIndex: "channel_name" },
            {
              title: "状态",
              dataIndex: "status",
              render: (status: string) => (
                <Tag color={statusColors[status] ?? "default"}>{status}</Tag>
              ),
            },
            { title: "目的国", dataIndex: "destination_country" },
            { title: "费用合计", dataIndex: "fee_total", render: (value?: number) => value ?? "-" },
            { title: "创建时间", dataIndex: "created_at" },
          ]}
        />
      )}
    </Card>
  );
}
