import { useEffect, useState } from "react";
import { Button, Card, Col, Empty, Row, Space, Spin, Tag, Typography, message } from "antd";
import { CopyOutlined, EnvironmentOutlined } from "@ant-design/icons";
import { memberWarehouses } from "@crossborder-erp/api-client";
import type { MemberWarehouseAddress, Warehouse } from "@crossborder-erp/api-client";
import { memberClient } from "../api/client";

const { Text, Title, Paragraph } = Typography;

export function WarehouseAddressPage() {
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [addresses, setAddresses] = useState<Record<string, MemberWarehouseAddress>>({});
  const [loading, setLoading] = useState(true);
  const [addressLoading, setAddressLoading] = useState<string | null>(null);

  useEffect(() => {
    memberWarehouses.list(memberClient)
      .then(setWarehouses)
      .catch(() => message.error("仓库列表加载失败"))
      .finally(() => setLoading(false));
  }, []);

  const loadAddress = async (warehouse: Warehouse) => {
    const key = String(warehouse.id);
    if (addresses[key]) return;
    setAddressLoading(key);
    try {
      const data = await memberWarehouses.getAddress(memberClient, warehouse.id);
      setAddresses((prev) => ({ ...prev, [key]: data }));
    } catch {
      message.error("收货地址加载失败");
    } finally {
      setAddressLoading(null);
    }
  };

  const copyAddress = async (address: MemberWarehouseAddress) => {
    try {
      await navigator.clipboard.writeText(address.full_address);
      message.success("地址已复制");
    } catch {
      message.error("复制失败，请手动复制");
    }
  };

  if (loading) {
    return <Spin size="large" style={{ display: "block", margin: "120px auto" }} />;
  }

  return (
    <div>
      <Title level={4}>仓库地址</Title>
      {warehouses.length === 0 ? <Empty description="暂无可用仓库" /> : null}
      <Row gutter={[16, 16]}>
        {warehouses.map((warehouse) => {
          const address = addresses[String(warehouse.id)];
          return (
            <Col xs={24} md={12} xl={8} key={warehouse.id}>
              <Card
                title={warehouse.name}
                style={{ borderRadius: "var(--radius-card)" }}
                extra={(
                  <Tag color={warehouse.status === "ACTIVE" ? "green" : "default"}>
                    {warehouse.status}
                  </Tag>
                )}
              >
                <Space orientation="vertical" size="middle" style={{ width: "100%" }}>
                  <Space>
                    <EnvironmentOutlined />
                    <Text>{warehouse.country} · {warehouse.city}</Text>
                  </Space>
                  <Text type="secondary">仓库代码：{warehouse.code}</Text>
                  <Text type="secondary">默认地址：{warehouse.address?.address_line ?? "-"}</Text>
                  <Button
                    loading={addressLoading === String(warehouse.id)}
                    onClick={() => loadAddress(warehouse)}
                  >
                    查看收货地址
                  </Button>
                  {address && (
                    <Card
                      size="small"
                      style={{ borderRadius: "var(--radius-card)", background: "#fafafa" }}
                    >
                      <Space orientation="vertical" style={{ width: "100%" }}>
                        <Text strong>
                          会员专属识别码：<Tag color="gold">{address.member_warehouse_code}</Tag>
                        </Text>
                        <Text>收件人：{address.receiver_name}</Text>
                        <Text>电话：{address.phone}</Text>
                        <Text>邮编：{address.postal_code}</Text>
                        <Paragraph copyable={false} style={{ marginBottom: 0 }}>
                          {address.full_address}
                        </Paragraph>
                        <Button
                          type="primary"
                          icon={<CopyOutlined />}
                          onClick={() => copyAddress(address)}
                        >
                          一键复制
                        </Button>
                      </Space>
                    </Card>
                  )}
                </Space>
              </Card>
            </Col>
          );
        })}
      </Row>
    </div>
  );
}
