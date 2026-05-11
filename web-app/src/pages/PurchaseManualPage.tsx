import { useState } from "react";
import { Button, Card, Form, Input, InputNumber, Space, Typography, message } from "antd";
import { MinusCircleOutlined, PlusOutlined } from "@ant-design/icons";
import { useNavigate } from "react-router-dom";
import { memberPurchases } from "@crossborder-erp/api-client";
import { memberClient } from "../api/client";

const { Title } = Typography;

type PurchaseItemForm = {
  name: string;
  quantity: number;
  unit_price: number;
  product_url?: string;
  remark?: string;
};

type PurchaseForm = {
  remark?: string;
  items: PurchaseItemForm[];
};

export function PurchaseManualPage() {
  const [form] = Form.useForm<PurchaseForm>();
  const [url, setUrl] = useState("");
  const [parsing, setParsing] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const navigate = useNavigate();

  const parseLink = async () => {
    if (!url) {
      message.warning("请先粘贴商品链接");
      return;
    }

    setParsing(true);
    try {
      const parsed = await memberPurchases.parseLink(memberClient, { url, source_url: url });
      const items = form.getFieldValue("items") ?? [];
      form.setFieldsValue({
        items: [
          {
            name: parsed.product_name,
            unit_price: parsed.price,
            product_url: parsed.source_url ?? url,
            quantity: 1,
            remark: parsed.currency,
          },
          ...items,
        ],
      });
      message.success("商品信息已填入表单");
    } catch {
      message.error("链接解析失败，请手动填写");
    } finally {
      setParsing(false);
    }
  };

  const onFinish = async (values: PurchaseForm) => {
    setSubmitting(true);
    try {
      await memberPurchases.submitManual(memberClient, { ...values });
      message.success("代购订单提交成功");
      navigate("/purchases");
    } catch {
      message.error("提交失败");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Space orientation="vertical" size="large" style={{ width: "100%" }}>
      <Card title="链接解析" style={{ borderRadius: "var(--radius-card)" }}>
        <Space.Compact style={{ width: "100%" }}>
          <Input
            value={url}
            onChange={(event) => setUrl(event.target.value)}
            placeholder="粘贴商品链接"
          />
          <Button type="primary" loading={parsing} onClick={parseLink}>
            解析并填入
          </Button>
        </Space.Compact>
      </Card>
      <Card style={{ borderRadius: "var(--radius-card)" }}>
        <Title level={4}>万能代购</Title>
        <Form form={form} layout="vertical" onFinish={onFinish} initialValues={{ items: [{}] }}>
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
                      rules={[{ required: true }]}
                    >
                      <InputNumber min={1} style={{ width: "100%" }} />
                    </Form.Item>
                    <Form.Item
                      name={[field.name, "unit_price"]}
                      label="单价"
                      rules={[{ required: true }]}
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
          <Form.Item name="remark" label="订单备注" style={{ marginTop: 16 }}>
            <Input.TextArea rows={4} />
          </Form.Item>
          <Button type="primary" htmlType="submit" loading={submitting}>
            提交代购订单
          </Button>
        </Form>
      </Card>
    </Space>
  );
}
