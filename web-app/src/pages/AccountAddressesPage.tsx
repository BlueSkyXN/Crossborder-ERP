import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Button,
  Card,
  Empty,
  Form,
  Input,
  Modal,
  Popconfirm,
  Space,
  Switch,
  Table,
  Tag,
  Typography,
  message,
} from "antd";
import { CheckCircleOutlined, DeleteOutlined, EditOutlined, PlusOutlined } from "@ant-design/icons";
import { memberAddresses } from "@crossborder-erp/api-client";
import type { Address } from "@crossborder-erp/api-client";
import { memberClient } from "../api/client";

const { Text, Title } = Typography;

type AddressForm = {
  recipient_name: string;
  phone: string;
  country: string;
  region?: string;
  city?: string;
  postal_code?: string;
  address_line: string;
  company?: string;
  is_default?: boolean;
};

const emptyForm: Partial<AddressForm> = {
  country: "US",
  is_default: false,
};

export function AccountAddressesPage() {
  const [items, setItems] = useState<Address[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Address | null>(null);
  const [form] = Form.useForm<AddressForm>();

  const load = useCallback(() => {
    setLoading(true);
    memberAddresses.list(memberClient)
      .then(setItems)
      .catch(() => message.error("海外收件地址加载失败"))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    void Promise.resolve().then(load);
  }, [load]);

  const openCreate = () => {
    setEditing(null);
    form.setFieldsValue(emptyForm);
    setModalOpen(true);
  };

  const openEdit = (address: Address) => {
    setEditing(address);
    form.setFieldsValue({
      recipient_name: address.recipient_name,
      phone: address.phone,
      country: address.country,
      region: address.region,
      city: address.city,
      postal_code: address.postal_code,
      address_line: address.address_line,
      company: address.company,
      is_default: address.is_default,
    });
    setModalOpen(true);
  };

  const closeModal = () => {
    setModalOpen(false);
    setEditing(null);
    form.resetFields();
  };

  const submit = async (values: AddressForm) => {
    setSaving(true);
    try {
      if (editing) {
        await memberAddresses.update(memberClient, editing.id, values);
        message.success("地址已更新");
      } else {
        await memberAddresses.create(memberClient, values);
        message.success("地址已新增");
      }
      closeModal();
      load();
    } catch {
      message.error(editing ? "地址更新失败" : "地址新增失败");
    } finally {
      setSaving(false);
    }
  };

  const remove = async (address: Address) => {
    try {
      await memberAddresses.remove(memberClient, address.id);
      message.success("地址已删除");
      load();
    } catch {
      message.error("地址删除失败");
    }
  };

  const setDefault = async (address: Address) => {
    try {
      await memberAddresses.setDefault(memberClient, address.id);
      message.success("默认地址已更新");
      load();
    } catch {
      message.error("默认地址更新失败");
    }
  };

  const defaultAddress = useMemo(() => items.find((address) => address.is_default), [items]);

  return (
    <Space orientation="vertical" size="large" style={{ width: "100%" }}>
      <Space style={{ width: "100%", justifyContent: "space-between" }} wrap>
        <div>
          <Title level={4} style={{ margin: 0 }}>
            海外收件地址
          </Title>
          <Text type="secondary">
            用于创建集运运单。{defaultAddress ? `当前默认：${defaultAddress.recipient_name}` : "建议先设置默认地址。"}
          </Text>
        </div>
        <Button type="primary" icon={<PlusOutlined />} onClick={openCreate}>
          新增地址
        </Button>
      </Space>

      <Card style={{ borderRadius: "var(--radius-card)" }}>
        {items.length === 0 && !loading ? (
          <Empty description="暂无海外收件地址" />
        ) : (
          <Table<Address>
            rowKey="id"
            loading={loading}
            dataSource={items}
            pagination={false}
            columns={[
              {
                title: "收件人",
                dataIndex: "recipient_name",
                render: (value, row) => (
                  <Space>
                    <Text strong>{value}</Text>
                    {row.is_default ? <Tag color="gold">默认</Tag> : null}
                  </Space>
                ),
              },
              { title: "电话", dataIndex: "phone" },
              {
                title: "国家/地区",
                render: (_, row) => [row.country, row.region, row.city].filter(Boolean).join(" / "),
              },
              {
                title: "详细地址",
                render: (_, row) => (
                  <Space orientation="vertical" size={2}>
                    <Text>{row.address_line}</Text>
                    <Text type="secondary">{row.postal_code || "-"} {row.company || ""}</Text>
                  </Space>
                ),
              },
              {
                title: "操作",
                width: 240,
                render: (_, row) => (
                  <Space wrap>
                    <Button icon={<EditOutlined />} onClick={() => openEdit(row)}>
                      编辑
                    </Button>
                    <Button
                      icon={<CheckCircleOutlined />}
                      disabled={row.is_default}
                      onClick={() => setDefault(row)}
                    >
                      设默认
                    </Button>
                    <Popconfirm title="确认删除这个地址？" onConfirm={() => remove(row)}>
                      <Button danger icon={<DeleteOutlined />}>
                        删除
                      </Button>
                    </Popconfirm>
                  </Space>
                ),
              },
            ]}
          />
        )}
      </Card>

      <Modal
        title={editing ? "编辑海外收件地址" : "新增海外收件地址"}
        open={modalOpen}
        onCancel={closeModal}
        footer={null}
        destroyOnHidden
        forceRender
      >
        <Form form={form} layout="vertical" onFinish={submit} initialValues={emptyForm}>
          <Form.Item name="recipient_name" label="收件人" rules={[{ required: true, message: "请输入收件人" }]}>
            <Input />
          </Form.Item>
          <Form.Item name="phone" label="联系电话" rules={[{ required: true, message: "请输入联系电话" }]}>
            <Input />
          </Form.Item>
          <Form.Item name="country" label="国家/地区" rules={[{ required: true, message: "请输入国家/地区" }]}>
            <Input placeholder="例如 US、JP、CA" />
          </Form.Item>
          <Form.Item name="region" label="州/省">
            <Input />
          </Form.Item>
          <Form.Item name="city" label="城市">
            <Input />
          </Form.Item>
          <Form.Item name="postal_code" label="邮政编码">
            <Input />
          </Form.Item>
          <Form.Item name="address_line" label="详细地址" rules={[{ required: true, message: "请输入详细地址" }]}>
            <Input.TextArea rows={3} />
          </Form.Item>
          <Form.Item name="company" label="公司/门牌补充">
            <Input />
          </Form.Item>
          <Form.Item name="is_default" label="设为默认" valuePropName="checked">
            <Switch />
          </Form.Item>
          <Space>
            <Button onClick={closeModal}>取消</Button>
            <Button type="primary" htmlType="submit" loading={saving}>
              保存
            </Button>
          </Space>
        </Form>
      </Modal>
    </Space>
  );
}
