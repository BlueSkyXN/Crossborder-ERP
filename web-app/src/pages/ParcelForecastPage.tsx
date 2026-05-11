import { useEffect, useState } from "react";
import { Button, Card, Form, Input, InputNumber, Select, Space, Typography, message } from "antd";
import { MinusCircleOutlined, PlusOutlined } from "@ant-design/icons";
import { useNavigate } from "react-router-dom";
import { memberParcels, memberWarehouses } from "@crossborder-erp/api-client";
import type { Warehouse } from "@crossborder-erp/api-client";
import { memberClient } from "../api/client";

const { Title } = Typography;

type ParcelItemForm = {
  name: string;
  quantity: number;
  declared_value: number;
  product_url?: string;
  remark?: string;
};

type ParcelForecastForm = {
  warehouse_id: string | number;
  tracking_no: string;
  carrier?: string;
  remark?: string;
  items: ParcelItemForm[];
};

export function ParcelForecastPage() {
  const [form] = Form.useForm<ParcelForecastForm>();
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    memberWarehouses.list(memberClient)
      .then(setWarehouses)
      .catch(() => message.error("仓库列表加载失败"));
  }, []);

  const onFinish = async (values: ParcelForecastForm) => {
    setSubmitting(true);
    try {
      await memberParcels.forecast(memberClient, { ...values });
      message.success("包裹预报提交成功");
      form.resetFields();
    } catch {
      message.error("包裹预报提交失败");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Card style={{ borderRadius: "var(--radius-card)" }}>
      <Title level={4}>提交包裹预报</Title>
      <Form form={form} layout="vertical" onFinish={onFinish} initialValues={{ items: [{}] }}>
        <Form.Item
          name="warehouse_id"
          label="收货仓库"
          rules={[{ required: true, message: "请选择仓库" }]}
        >
          <Select
            placeholder="请选择仓库"
            options={warehouses.map((warehouse) => ({
              value: warehouse.id,
              label: `${warehouse.name}（${warehouse.code}）`,
            }))}
          />
        </Form.Item>
        <Form.Item
          name="tracking_no"
          label="国内快递单号"
          rules={[{ required: true, message: "请输入快递单号" }]}
        >
          <Input />
        </Form.Item>
        <Form.Item name="carrier" label="承运商">
          <Input placeholder="如：顺丰、中通" />
        </Form.Item>
        <Form.Item name="remark" label="备注">
          <Input.TextArea rows={3} />
        </Form.Item>
        <Form.List name="items">
          {(fields, { add, remove }) => (
            <Space orientation="vertical" style={{ width: "100%" }}>
              {fields.map((field) => (
                <Card
                  key={field.key}
                  size="small"
                  title={`商品 ${field.name + 1}`}
                  style={{ borderRadius: "var(--radius-card)" }}
                  extra={fields.length > 1 && (
                    <MinusCircleOutlined onClick={() => remove(field.name)} />
                  )}
                >
                  <Form.Item
                    name={[field.name, "name"]}
                    label="商品名称"
                    rules={[{ required: true, message: "请输入商品名称" }]}
                  >
                    <Input />
                  </Form.Item>
                  <Form.Item
                    name={[field.name, "quantity"]}
                    label="数量"
                    rules={[{ required: true, message: "请输入数量" }]}
                  >
                    <InputNumber min={1} style={{ width: "100%" }} />
                  </Form.Item>
                  <Form.Item
                    name={[field.name, "declared_value"]}
                    label="申报价值"
                    rules={[{ required: true, message: "请输入申报价值" }]}
                  >
                    <InputNumber min={0} precision={2} style={{ width: "100%" }} />
                  </Form.Item>
                  <Form.Item name={[field.name, "product_url"]} label="商品链接">
                    <Input />
                  </Form.Item>
                  <Form.Item name={[field.name, "remark"]} label="商品备注">
                    <Input />
                  </Form.Item>
                </Card>
              ))}
              <Button icon={<PlusOutlined />} onClick={() => add()} block>
                添加商品
              </Button>
            </Space>
          )}
        </Form.List>
        <Space style={{ marginTop: 24 }}>
          <Button type="primary" htmlType="submit" loading={submitting}>
            提交预报
          </Button>
          <Button onClick={() => navigate("/parcels")}>前往我的包裹</Button>
        </Space>
      </Form>
    </Card>
  );
}
