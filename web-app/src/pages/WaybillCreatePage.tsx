import { useEffect, useMemo, useState } from "react";
import { Alert, Button, Card, Checkbox, Empty, Form, Input, Select, Space, Steps, Table, Typography, message } from "antd";
import { useNavigate } from "react-router-dom";
import { memberAddresses, memberParcels, memberWaybills } from "@crossborder-erp/api-client";
import type { Address, EntityId, Parcel } from "@crossborder-erp/api-client";
import { memberClient } from "../api/client";

const { Title, Paragraph } = Typography;

type WaybillCreateForm = {
  address_id?: EntityId;
  destination_country?: string;
  recipient_name?: string;
  recipient_phone?: string;
  recipient_address?: string;
  postal_code?: string;
  remark?: string;
};

export function WaybillCreatePage() {
  const [form] = Form.useForm<WaybillCreateForm>();
  const [parcels, setParcels] = useState<Parcel[]>([]);
  const [addresses, setAddresses] = useState<Address[]>([]);
  const [selectedParcelIds, setSelectedParcelIds] = useState<React.Key[]>([]);
  const [loading, setLoading] = useState(true);
  const [addressLoading, setAddressLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const navigate = useNavigate();
  const selectedAddressId = Form.useWatch("address_id", form);

  useEffect(() => {
    memberParcels.getPackable(memberClient)
      .then(setParcels)
      .catch(() => message.error("可打包包裹加载失败"))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    memberAddresses.list(memberClient)
      .then((data) => {
        setAddresses(data);
        const defaultAddress = data.find((address) => address.is_default) ?? data[0];
        if (defaultAddress) {
          form.setFieldsValue({
            address_id: defaultAddress.id,
            destination_country: defaultAddress.country,
          });
        }
      })
      .catch(() => message.error("海外收件地址加载失败"))
      .finally(() => setAddressLoading(false));
  }, [form]);

  const selectedCount = selectedParcelIds.length;
  const currentStep = selectedCount > 0 ? 1 : 0;
  const selectedParcels = useMemo(
    () => parcels.filter((parcel) => selectedParcelIds.includes(parcel.id)),
    [parcels, selectedParcelIds],
  );
  const selectedAddress = useMemo(
    () => addresses.find((address) => address.id === selectedAddressId),
    [addresses, selectedAddressId],
  );

  const addressOptions = useMemo(
    () => addresses.map((address) => ({
      value: address.id,
      label: [
        address.is_default ? "默认" : null,
        address.recipient_name,
        address.country,
        address.region,
        address.city,
        address.address_line,
      ].filter(Boolean).join(" / "),
    })),
    [addresses],
  );

  const onFinish = async (values: WaybillCreateForm) => {
    if (selectedParcelIds.length === 0) {
      message.warning("请至少选择一个包裹");
      return;
    }

    setSubmitting(true);
    try {
      const payload = values.address_id ? {
        parcel_ids: selectedParcelIds,
        address_id: values.address_id,
        remark: values.remark,
      } : {
        parcel_ids: selectedParcelIds,
        destination_country: values.destination_country,
        recipient_name: values.recipient_name,
        recipient_phone: values.recipient_phone,
        recipient_address: values.recipient_address,
        postal_code: values.postal_code,
        remark: values.remark,
      };
      const waybill = await memberWaybills.create(memberClient, payload);
      message.success("运单创建成功");
      navigate(`/waybills/${waybill.id}`);
    } catch {
      message.error("运单创建失败");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Space orientation="vertical" size="large" style={{ width: "100%" }}>
      <Title level={4} style={{ margin: 0 }}>
        创建运单
      </Title>
      <Steps
        current={currentStep}
        items={[
          { title: "选择包裹", content: "勾选可打包包裹" },
          { title: "填写收件信息", content: "确认收件信息并提交" },
        ]}
      />

      <Card title="Step 1：选择可打包包裹" style={{ borderRadius: "var(--radius-card)" }}>
        {parcels.length === 0 && !loading ? (
          <Empty description="暂无可创建运单的包裹" />
        ) : (
          <Table<Parcel>
            rowKey="id"
            loading={loading}
            dataSource={parcels}
            pagination={false}
            rowSelection={{
              selectedRowKeys: selectedParcelIds,
              onChange: setSelectedParcelIds,
            }}
            columns={[
              {
                title: "选择",
                dataIndex: "id",
                render: (id) => <Checkbox checked={selectedParcelIds.includes(id)} />,
              },
              { title: "包裹号", dataIndex: "parcel_no" },
              { title: "快递单号", dataIndex: "tracking_no" },
              { title: "仓库", dataIndex: "warehouse_name" },
              { title: "状态", dataIndex: "status" },
              { title: "重量(kg)", dataIndex: "weight_kg", render: (value?: number) => value ?? "-" },
            ]}
          />
        )}
        {selectedCount > 0 && (
          <Paragraph type="secondary" style={{ marginTop: 16, marginBottom: 0 }}>
            已选择 {selectedCount} 个包裹：
            {selectedParcels.map((parcel) => parcel.parcel_no).join("、")}
          </Paragraph>
        )}
      </Card>

      <Card title="Step 2：填写收件信息" style={{ borderRadius: "var(--radius-card)" }}>
        <Form
          form={form}
          layout="vertical"
          onFinish={onFinish}
          initialValues={{ destination_country: "US" }}
        >
          <Form.Item name="address_id" label="地址簿">
            <Select
              allowClear
              loading={addressLoading}
              options={addressOptions}
              placeholder="选择海外收件地址，或清空后手动填写"
              onChange={(value) => {
                const address = addresses.find((item) => item.id === value);
                if (address) {
                  form.setFieldsValue({ destination_country: address.country });
                }
              }}
            />
          </Form.Item>
          {selectedAddress ? (
            <Alert
              type="success"
              showIcon
              title={`${selectedAddress.recipient_name} / ${selectedAddress.phone}`}
              description={[
                selectedAddress.country,
                selectedAddress.region,
                selectedAddress.city,
                selectedAddress.address_line,
                selectedAddress.postal_code,
              ].filter(Boolean).join(" ")}
              action={(
                <Button size="small" onClick={() => navigate("/account/addresses")}>
                  管理地址
                </Button>
              )}
              style={{ marginBottom: 16 }}
            />
          ) : (
            <>
              {addresses.length === 0 && !addressLoading ? (
                <Alert
                  type="info"
                  showIcon
                  title="还没有地址簿记录"
                  description="可以先手动填写本次收件信息，或到地址簿新增常用地址。"
                  action={(
                    <Button size="small" onClick={() => navigate("/account/addresses")}>
                      新增地址
                    </Button>
                  )}
                  style={{ marginBottom: 16 }}
                />
              ) : null}
              <Form.Item
                name="destination_country"
                label="目的国家/地区"
                rules={[{ required: true, message: "请输入目的国家/地区" }]}
              >
                <Input placeholder="例如：US、JP、CA" />
              </Form.Item>
              <Form.Item
                name="recipient_name"
                label="收件人姓名"
                rules={[{ required: true, message: "请输入收件人姓名" }]}
              >
                <Input />
              </Form.Item>
              <Form.Item
                name="recipient_phone"
                label="收件人电话"
                rules={[{ required: true, message: "请输入收件人电话" }]}
              >
                <Input />
              </Form.Item>
              <Form.Item
                name="recipient_address"
                label="收件地址"
                rules={[{ required: true, message: "请输入收件地址" }]}
              >
                <Input.TextArea rows={3} />
              </Form.Item>
              <Form.Item name="postal_code" label="邮政编码">
                <Input />
              </Form.Item>
            </>
          )}
          <Form.Item name="remark" label="备注">
            <Input.TextArea rows={3} />
          </Form.Item>
          <Space>
            <Button onClick={() => navigate("/waybills")}>取消</Button>
            <Button
              type="primary"
              htmlType="submit"
              loading={submitting}
              disabled={selectedParcelIds.length === 0}
            >
              提交创建
            </Button>
          </Space>
        </Form>
      </Card>
    </Space>
  );
}
