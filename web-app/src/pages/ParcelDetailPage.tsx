import { useEffect, useState } from "react";
import { Button, Card, Descriptions, Empty, Image, Space, Spin, Table, Tag, Typography, message } from "antd";
import { useNavigate, useParams } from "react-router-dom";
import { memberParcels } from "@crossborder-erp/api-client";
import type { Parcel, ParcelItem } from "@crossborder-erp/api-client";
import { memberClient } from "../api/client";

const { Title } = Typography;

const statusColors: Record<string, string> = {
  FORECASTED: "blue",
  IN_WAREHOUSE: "green",
  PACKED: "orange",
  SHIPPED: "purple",
  SIGNED: "default",
};

export function ParcelDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [parcel, setParcel] = useState<Parcel | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!id) return;
    void Promise.resolve().then(() => {
      setLoading(true);
      memberParcels.getById(memberClient, id)
        .then(setParcel)
        .catch(() => message.error("包裹详情加载失败"))
        .finally(() => setLoading(false));
    });
  }, [id]);

  if (loading) {
    return <Spin size="large" style={{ display: "block", margin: "120px auto" }} />;
  }
  if (!parcel) return <Empty description="未找到包裹" />;

  const hasDimensions = [parcel.length_cm, parcel.width_cm, parcel.height_cm].every(
    (value) => value !== undefined && value !== null,
  );
  const dimensions = hasDimensions
    ? `${parcel.length_cm} × ${parcel.width_cm} × ${parcel.height_cm} cm`
    : "-";

  return (
    <Space orientation="vertical" size="large" style={{ width: "100%" }}>
      <Space>
        <Button onClick={() => navigate("/parcels")}>返回包裹列表</Button>
        <Title level={4} style={{ margin: 0 }}>
          包裹详情
        </Title>
      </Space>
      <Card style={{ borderRadius: "var(--radius-card)" }}>
        <Descriptions
          column={2}
          bordered
          items={[
            { key: "parcel_no", label: "包裹号", children: parcel.parcel_no },
            {
              key: "status",
              label: "状态",
              children: <Tag color={statusColors[parcel.status] ?? "default"}>{parcel.status}</Tag>,
            },
            { key: "tracking_no", label: "快递单号", children: parcel.tracking_no },
            { key: "carrier", label: "承运商", children: parcel.carrier ?? "-" },
            { key: "warehouse_name", label: "仓库", children: parcel.warehouse_name },
            { key: "weight", label: "重量", children: parcel.weight_kg ? `${parcel.weight_kg} kg` : "-" },
            { key: "dimensions", label: "尺寸", children: dimensions },
            { key: "inbound_at", label: "入库时间", children: parcel.inbound_at ?? "-" },
            { key: "created_at", label: "创建时间", children: parcel.created_at },
            { key: "updated_at", label: "更新时间", children: parcel.updated_at },
            { key: "remark", label: "备注", children: parcel.remark ?? "-", span: 2 },
          ]}
        />
      </Card>
      <Card title="商品明细" style={{ borderRadius: "var(--radius-card)" }}>
        <Table<ParcelItem>
          rowKey="id"
          dataSource={parcel.items ?? []}
          pagination={false}
          columns={[
            { title: "商品名称", dataIndex: "name" },
            { title: "数量", dataIndex: "quantity" },
            { title: "申报价值", dataIndex: "declared_value" },
          ]}
        />
      </Card>
      <Card title="包裹照片" style={{ borderRadius: "var(--radius-card)" }}>
        {(parcel.photos ?? []).length === 0 ? (
          <Empty description="暂无照片" />
        ) : (
          <Image.PreviewGroup>
            {parcel.photos.map((photo) => (
              <Image
                key={photo.id}
                width={160}
                src={photo.download_url}
                alt={photo.file_name}
                style={{ marginRight: 12, marginBottom: 12 }}
              />
            ))}
          </Image.PreviewGroup>
        )}
      </Card>
    </Space>
  );
}
