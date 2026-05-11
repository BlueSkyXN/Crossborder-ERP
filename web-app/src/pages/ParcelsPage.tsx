import { useEffect, useState } from "react";
import { Button, Card, Empty, Space, Table, Tag, Typography, message } from "antd";
import { useNavigate } from "react-router-dom";
import { memberParcels } from "@crossborder-erp/api-client";
import type { PaginatedResponse, Parcel } from "@crossborder-erp/api-client";
import { memberClient } from "../api/client";

const { Title } = Typography;

const statusColors: Record<string, string> = {
  FORECASTED: "blue",
  IN_WAREHOUSE: "green",
  PACKED: "orange",
  SHIPPED: "purple",
  SIGNED: "default",
};

export function ParcelsPage() {
  const [data, setData] = useState<PaginatedResponse<Parcel>>({
    items: [],
    pagination: { page: 1, page_size: 10, total: 0, total_pages: 0 },
  });
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const navigate = useNavigate();

  useEffect(() => {
    void Promise.resolve().then(() => {
      setLoading(true);
      memberParcels.list(memberClient, { page })
        .then(setData)
        .catch(() => message.error("包裹列表加载失败"))
        .finally(() => setLoading(false));
    });
  }, [page]);

  return (
    <Card style={{ borderRadius: "var(--radius-card)" }}>
      <Space style={{ width: "100%", justifyContent: "space-between", marginBottom: 16 }}>
        <Title level={4} style={{ margin: 0 }}>
          我的包裹
        </Title>
        <Button type="primary" onClick={() => navigate("/parcels/forecast")}>
          提交预报
        </Button>
      </Space>
      {data.items.length === 0 && !loading ? (
        <Empty description="暂无包裹" />
      ) : (
        <Table<Parcel>
          rowKey="id"
          loading={loading}
          dataSource={data.items}
          onRow={(record) => ({
            onClick: () => navigate(`/parcels/${record.id}`),
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
            { title: "包裹号", dataIndex: "parcel_no" },
            { title: "快递单号", dataIndex: "tracking_no" },
            { title: "仓库", dataIndex: "warehouse_name" },
            {
              title: "状态",
              dataIndex: "status",
              render: (status: string) => (
                <Tag color={statusColors[status] ?? "default"}>{status}</Tag>
              ),
            },
            { title: "重量(kg)", dataIndex: "weight_kg", render: (value?: number) => value ?? "-" },
            { title: "创建时间", dataIndex: "created_at" },
          ]}
        />
      )}
    </Card>
  );
}
