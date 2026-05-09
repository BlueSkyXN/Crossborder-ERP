import {
  DeleteOutlined,
  EditOutlined,
  PlusOutlined,
  PoweroffOutlined,
  SearchOutlined,
} from "@ant-design/icons";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Alert,
  App as AntdApp,
  Button,
  Card,
  Checkbox,
  Form,
  Input,
  InputNumber,
  Modal,
  Popconfirm,
  Row,
  Col,
  Select,
  Space,
  Table,
  Tabs,
  Tag,
  Typography,
} from "antd";
import type { TableColumnsType } from "antd";
import { useMemo, useState } from "react";
import { useOutletContext } from "react-router-dom";

import { ForbiddenPage } from "../../pages/ForbiddenPage";
import { warehouseConfigApi } from "./api";
import type {
  ConfigStatus,
  PackagingMethod,
  PackagingMethodPayload,
  RatePlan,
  RatePlanPayload,
  ShippingChannel,
  ShippingChannelPayload,
  ValueAddedService,
  ValueAddedServicePayload,
  Warehouse,
  WarehousePayload,
} from "./types";

type WorkspaceContext = {
  allowedCodes: Set<string>;
  permissionCodes: Set<string>;
};

type ResourceKey =
  | "warehouses"
  | "shippingChannels"
  | "packagingMethods"
  | "valueAddedServices"
  | "ratePlans";

type ModalState = {
  resource: ResourceKey;
  mode: "create" | "edit";
  recordId?: number;
} | null;

type FormValues = Record<string, unknown>;

type SaveRequest = {
  modal: Exclude<ModalState, null>;
  values: FormValues;
};

type StatusRequest = {
  resource: ResourceKey;
  id: number;
  status: ConfigStatus;
};

type DeleteRequest = {
  resource: ResourceKey;
  id: number;
};

const resourceLabels: Record<ResourceKey, string> = {
  warehouses: "仓库",
  shippingChannels: "发货渠道",
  packagingMethods: "包装方式",
  valueAddedServices: "增值服务",
  ratePlans: "费率方案",
};

const queryKeys: Record<ResourceKey, readonly string[]> = {
  warehouses: ["admin-config", "warehouses"],
  shippingChannels: ["admin-config", "shipping-channels"],
  packagingMethods: ["admin-config", "packaging-methods"],
  valueAddedServices: ["admin-config", "value-added-services"],
  ratePlans: ["admin-config", "rate-plans"],
};

function asString(value: unknown) {
  if (value === undefined || value === null) {
    return "";
  }
  return String(value);
}

function asStatus(value: unknown): ConfigStatus {
  return value === "DISABLED" ? "DISABLED" : "ACTIVE";
}

function asPrice(value: unknown) {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed.toFixed(2) : "0.00";
}

function asRuleJson(value: unknown): Record<string, unknown> {
  const source = asString(value).trim();
  if (!source) {
    return {};
  }
  const parsed = JSON.parse(source) as unknown;
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new Error("费率规则必须是 JSON object");
  }
  return parsed as Record<string, unknown>;
}

function statusTag(status: ConfigStatus) {
  return status === "ACTIVE" ? <Tag color="green">启用</Tag> : <Tag color="default">停用</Tag>;
}

function filterRows<T>(rows: T[], keyword: string, pickText: (row: T) => string[]) {
  const normalized = keyword.trim().toLowerCase();
  if (!normalized) {
    return rows;
  }
  return rows.filter((row) => pickText(row).join(" ").toLowerCase().includes(normalized));
}

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : "加载失败";
}

function buildWarehousePayload(values: FormValues): WarehousePayload {
  return {
    code: asString(values.code).trim(),
    name: asString(values.name).trim(),
    country: asString(values.country).trim(),
    city: asString(values.city).trim(),
    status: asStatus(values.status),
    address: {
      address_line: asString(values.address_line).trim(),
      receiver_name: asString(values.receiver_name).trim(),
      phone: asString(values.phone).trim(),
      postal_code: asString(values.postal_code).trim(),
    },
  };
}

function buildShippingChannelPayload(values: FormValues): ShippingChannelPayload {
  return {
    code: asString(values.code).trim(),
    name: asString(values.name).trim(),
    billing_method: asString(values.billing_method || "weight").trim(),
    status: asStatus(values.status),
  };
}

function buildPackagingMethodPayload(values: FormValues): PackagingMethodPayload {
  return {
    code: asString(values.code).trim(),
    name: asString(values.name).trim(),
    price: asPrice(values.price),
    is_default: Boolean(values.is_default),
    status: asStatus(values.status),
  };
}

function buildValueAddedServicePayload(values: FormValues): ValueAddedServicePayload {
  return {
    code: asString(values.code).trim(),
    name: asString(values.name).trim(),
    price: asPrice(values.price),
    status: asStatus(values.status),
  };
}

function buildRatePlanPayload(values: FormValues): RatePlanPayload {
  return {
    channel: Number(values.channel),
    name: asString(values.name).trim(),
    rule_json: asRuleJson(values.rule_json),
    status: asStatus(values.status),
  };
}

export function WarehouseConfigPage() {
  const { allowedCodes, permissionCodes } = useOutletContext<WorkspaceContext>();
  const canManage = permissionCodes.has("warehouses.manage");
  const queryClient = useQueryClient();
  const { message } = AntdApp.useApp();
  const [form] = Form.useForm<FormValues>();
  const [activeResource, setActiveResource] = useState<ResourceKey>("warehouses");
  const [keyword, setKeyword] = useState("");
  const [modalState, setModalState] = useState<ModalState>(null);

  const warehousesQuery = useQuery({
    queryKey: queryKeys.warehouses,
    queryFn: warehouseConfigApi.listWarehouses,
  });
  const shippingChannelsQuery = useQuery({
    queryKey: queryKeys.shippingChannels,
    queryFn: warehouseConfigApi.listShippingChannels,
  });
  const packagingMethodsQuery = useQuery({
    queryKey: queryKeys.packagingMethods,
    queryFn: warehouseConfigApi.listPackagingMethods,
  });
  const valueAddedServicesQuery = useQuery({
    queryKey: queryKeys.valueAddedServices,
    queryFn: warehouseConfigApi.listValueAddedServices,
  });
  const ratePlansQuery = useQuery({
    queryKey: queryKeys.ratePlans,
    queryFn: warehouseConfigApi.listRatePlans,
  });

  const shippingChannels = useMemo(
    () => shippingChannelsQuery.data ?? [],
    [shippingChannelsQuery.data],
  );
  const channelNameById = useMemo(
    () => new Map(shippingChannels.map((channel) => [channel.id, channel.name])),
    [shippingChannels],
  );

  const invalidateResource = (resource: ResourceKey) => {
    queryClient.invalidateQueries({ queryKey: queryKeys[resource] });
    if (resource === "shippingChannels") {
      queryClient.invalidateQueries({ queryKey: queryKeys.ratePlans });
    }
  };

  const saveMutation = useMutation({
    mutationFn: async ({ modal, values }: SaveRequest): Promise<unknown> => {
      const id = modal.recordId;
      if (modal.resource === "warehouses") {
        const payload = buildWarehousePayload(values);
        return modal.mode === "create"
          ? warehouseConfigApi.createWarehouse(payload)
          : warehouseConfigApi.updateWarehouse(Number(id), payload);
      }
      if (modal.resource === "shippingChannels") {
        const payload = buildShippingChannelPayload(values);
        return modal.mode === "create"
          ? warehouseConfigApi.createShippingChannel(payload)
          : warehouseConfigApi.updateShippingChannel(Number(id), payload);
      }
      if (modal.resource === "packagingMethods") {
        const payload = buildPackagingMethodPayload(values);
        return modal.mode === "create"
          ? warehouseConfigApi.createPackagingMethod(payload)
          : warehouseConfigApi.updatePackagingMethod(Number(id), payload);
      }
      if (modal.resource === "valueAddedServices") {
        const payload = buildValueAddedServicePayload(values);
        return modal.mode === "create"
          ? warehouseConfigApi.createValueAddedService(payload)
          : warehouseConfigApi.updateValueAddedService(Number(id), payload);
      }
      const payload = buildRatePlanPayload(values);
      return modal.mode === "create"
        ? warehouseConfigApi.createRatePlan(payload)
        : warehouseConfigApi.updateRatePlan(Number(id), payload);
    },
    onSuccess: (_result, variables) => {
      invalidateResource(variables.modal.resource);
      setModalState(null);
      form.resetFields();
      message.success("保存成功");
    },
    onError: (error) => message.error(getErrorMessage(error)),
  });

  const statusMutation = useMutation({
    mutationFn: ({ resource, id, status }: StatusRequest): Promise<unknown> => {
      if (resource === "warehouses") {
        return warehouseConfigApi.updateWarehouse(id, { status });
      }
      if (resource === "shippingChannels") {
        return warehouseConfigApi.updateShippingChannel(id, { status });
      }
      if (resource === "packagingMethods") {
        return warehouseConfigApi.updatePackagingMethod(id, { status });
      }
      if (resource === "valueAddedServices") {
        return warehouseConfigApi.updateValueAddedService(id, { status });
      }
      return warehouseConfigApi.updateRatePlan(id, { status });
    },
    onSuccess: (_result, variables) => {
      invalidateResource(variables.resource);
      message.success("状态已更新");
    },
    onError: (error) => message.error(getErrorMessage(error)),
  });

  const deleteMutation = useMutation({
    mutationFn: ({ resource, id }: DeleteRequest): Promise<unknown> => {
      if (resource === "warehouses") {
        return warehouseConfigApi.deleteWarehouse(id);
      }
      if (resource === "shippingChannels") {
        return warehouseConfigApi.deleteShippingChannel(id);
      }
      if (resource === "packagingMethods") {
        return warehouseConfigApi.deletePackagingMethod(id);
      }
      if (resource === "valueAddedServices") {
        return warehouseConfigApi.deleteValueAddedService(id);
      }
      return warehouseConfigApi.deleteRatePlan(id);
    },
    onSuccess: (_result, variables) => {
      invalidateResource(variables.resource);
      message.success("已删除");
    },
    onError: (error) => message.error(getErrorMessage(error)),
  });

  const openCreate = (resource: ResourceKey) => {
    form.resetFields();
    form.setFieldsValue({
      status: "ACTIVE",
      country: "中国",
      billing_method: "weight",
      price: 0,
      is_default: false,
      rule_json: JSON.stringify(
        { TODO_CONFIRM: "首重续重、体积重、偏远费、保险费后续确认" },
        null,
        2,
      ),
    });
    setModalState({ resource, mode: "create" });
  };

  const openEdit = (resource: ResourceKey, record: FormValues & { id: number }) => {
    form.resetFields();
    if (resource === "warehouses") {
      const warehouse = record as unknown as Warehouse;
      form.setFieldsValue({
        ...warehouse,
        address_line: warehouse.address?.address_line,
        receiver_name: warehouse.address?.receiver_name,
        phone: warehouse.address?.phone,
        postal_code: warehouse.address?.postal_code,
      });
    } else if (resource === "ratePlans") {
      const ratePlan = record as unknown as RatePlan;
      form.setFieldsValue({
        ...ratePlan,
        rule_json: JSON.stringify(ratePlan.rule_json || {}, null, 2),
      });
    } else {
      form.setFieldsValue(record);
    }
    setModalState({ resource, mode: "edit", recordId: record.id });
  };

  const renderActions = <T extends { id: number; status: ConfigStatus }>(
    resource: ResourceKey,
    record: T,
  ) => {
    if (!canManage) {
      return "-";
    }
    const nextStatus = record.status === "ACTIVE" ? "DISABLED" : "ACTIVE";
    return (
      <Space size={4}>
        <Button
          size="small"
          title="编辑"
          icon={<EditOutlined />}
          onClick={() => openEdit(resource, record)}
        />
        <Popconfirm
          title={nextStatus === "DISABLED" ? "确认停用？" : "确认启用？"}
          okText="确认"
          cancelText="取消"
          onConfirm={() => statusMutation.mutate({ resource, id: record.id, status: nextStatus })}
        >
          <Button size="small" title={nextStatus === "DISABLED" ? "停用" : "启用"} icon={<PoweroffOutlined />} />
        </Popconfirm>
        <Popconfirm
          title={`确认删除该${resourceLabels[resource]}？`}
          okText="删除"
          cancelText="取消"
          okButtonProps={{ danger: true }}
          onConfirm={() => deleteMutation.mutate({ resource, id: record.id })}
        >
          <Button danger size="small" title="删除" icon={<DeleteOutlined />} />
        </Popconfirm>
      </Space>
    );
  };

  const warehouseColumns: TableColumnsType<Warehouse> = [
    { title: "编码", dataIndex: "code", width: 120 },
    { title: "名称", dataIndex: "name" },
    { title: "地区", render: (_, record) => `${record.country} / ${record.city}` },
    { title: "状态", dataIndex: "status", render: statusTag, width: 100 },
    { title: "收件信息", render: (_, record) => record.address?.address_line || "-" },
    { title: "操作", render: (_, record) => renderActions("warehouses", record), width: 150 },
  ];

  const shippingChannelColumns: TableColumnsType<ShippingChannel> = [
    { title: "编码", dataIndex: "code", width: 150 },
    { title: "名称", dataIndex: "name" },
    { title: "计费方式", dataIndex: "billing_method" },
    { title: "状态", dataIndex: "status", render: statusTag, width: 100 },
    { title: "操作", render: (_, record) => renderActions("shippingChannels", record), width: 150 },
  ];

  const packagingColumns: TableColumnsType<PackagingMethod> = [
    { title: "编码", dataIndex: "code", width: 150 },
    { title: "名称", dataIndex: "name" },
    { title: "价格", dataIndex: "price", width: 120 },
    { title: "默认", dataIndex: "is_default", render: (value: boolean) => (value ? "是" : "否") },
    { title: "状态", dataIndex: "status", render: statusTag, width: 100 },
    { title: "操作", render: (_, record) => renderActions("packagingMethods", record), width: 150 },
  ];

  const valueAddedColumns: TableColumnsType<ValueAddedService> = [
    { title: "编码", dataIndex: "code", width: 150 },
    { title: "名称", dataIndex: "name" },
    { title: "价格", dataIndex: "price", width: 120 },
    { title: "状态", dataIndex: "status", render: statusTag, width: 100 },
    { title: "操作", render: (_, record) => renderActions("valueAddedServices", record), width: 150 },
  ];

  const ratePlanColumns: TableColumnsType<RatePlan> = [
    { title: "名称", dataIndex: "name" },
    { title: "渠道", dataIndex: "channel", render: (id: number) => channelNameById.get(id) || id },
    {
      title: "规则",
      dataIndex: "rule_json",
      render: (rule: Record<string, unknown>) => asString(rule.TODO_CONFIRM || JSON.stringify(rule)),
    },
    { title: "状态", dataIndex: "status", render: statusTag, width: 100 },
    { title: "操作", render: (_, record) => renderActions("ratePlans", record), width: 150 },
  ];

  const renderTable = () => {
    const commonPagination = { pageSize: 8, showSizeChanger: true };
    if (activeResource === "warehouses") {
      return (
        <Table
          rowKey="id"
          loading={warehousesQuery.isLoading}
          dataSource={filterRows(warehousesQuery.data ?? [], keyword, (row) => [
            row.code,
            row.name,
            row.country,
            row.city,
            row.address?.address_line || "",
          ])}
          columns={warehouseColumns}
          pagination={commonPagination}
          scroll={{ x: 900 }}
        />
      );
    }
    if (activeResource === "shippingChannels") {
      return (
        <Table
          rowKey="id"
          loading={shippingChannelsQuery.isLoading}
          dataSource={filterRows(shippingChannels, keyword, (row) => [
            row.code,
            row.name,
            row.billing_method,
          ])}
          columns={shippingChannelColumns}
          pagination={commonPagination}
          scroll={{ x: 760 }}
        />
      );
    }
    if (activeResource === "packagingMethods") {
      return (
        <Table
          rowKey="id"
          loading={packagingMethodsQuery.isLoading}
          dataSource={filterRows(packagingMethodsQuery.data ?? [], keyword, (row) => [row.code, row.name])}
          columns={packagingColumns}
          pagination={commonPagination}
          scroll={{ x: 760 }}
        />
      );
    }
    if (activeResource === "valueAddedServices") {
      return (
        <Table
          rowKey="id"
          loading={valueAddedServicesQuery.isLoading}
          dataSource={filterRows(valueAddedServicesQuery.data ?? [], keyword, (row) => [
            row.code,
            row.name,
          ])}
          columns={valueAddedColumns}
          pagination={commonPagination}
          scroll={{ x: 720 }}
        />
      );
    }
    return (
      <Table
        rowKey="id"
        loading={ratePlansQuery.isLoading}
        dataSource={filterRows(ratePlansQuery.data ?? [], keyword, (row) => [
          row.name,
          channelNameById.get(row.channel) || "",
        ])}
        columns={ratePlanColumns}
        pagination={commonPagination}
        scroll={{ x: 820 }}
      />
    );
  };

  const activeQueryError =
    activeResource === "warehouses"
      ? warehousesQuery.error
      : activeResource === "shippingChannels"
        ? shippingChannelsQuery.error
        : activeResource === "packagingMethods"
          ? packagingMethodsQuery.error
          : activeResource === "valueAddedServices"
            ? valueAddedServicesQuery.error
            : ratePlansQuery.error;

  const renderFormFields = () => {
    if (modalState?.resource === "warehouses") {
      return (
        <>
          <Row gutter={12}>
            <Col span={12}>
              <Form.Item name="code" label="仓库编码" rules={[{ required: true }]}>
                <Input />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="name" label="仓库名称" rules={[{ required: true }]}>
                <Input />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="country" label="国家/地区" rules={[{ required: true }]}>
                <Input />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="city" label="城市" rules={[{ required: true }]}>
                <Input />
              </Form.Item>
            </Col>
          </Row>
          <Form.Item name="address_line" label="仓库地址" rules={[{ required: true }]}>
            <Input />
          </Form.Item>
          <Row gutter={12}>
            <Col span={12}>
              <Form.Item name="receiver_name" label="收件人" rules={[{ required: true }]}>
                <Input />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="phone" label="电话" rules={[{ required: true }]}>
                <Input />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="postal_code" label="邮编">
                <Input />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="status" label="状态" rules={[{ required: true }]}>
                <Select options={statusOptions} />
              </Form.Item>
            </Col>
          </Row>
        </>
      );
    }

    if (modalState?.resource === "ratePlans") {
      return (
        <>
          <Form.Item name="channel" label="渠道" rules={[{ required: true }]}>
            <Select
              options={shippingChannels.map((channel) => ({ label: channel.name, value: channel.id }))}
            />
          </Form.Item>
          <Form.Item name="name" label="费率名称" rules={[{ required: true }]}>
            <Input />
          </Form.Item>
          <Form.Item name="rule_json" label="简版规则 JSON" rules={[{ required: true }]}>
            <Input.TextArea rows={5} />
          </Form.Item>
          <Form.Item name="status" label="状态" rules={[{ required: true }]}>
            <Select options={statusOptions} />
          </Form.Item>
        </>
      );
    }

    const showBillingMethod = modalState?.resource === "shippingChannels";
    const showDefault = modalState?.resource === "packagingMethods";
    const showPrice =
      modalState?.resource === "packagingMethods" || modalState?.resource === "valueAddedServices";

    return (
      <>
        <Row gutter={12}>
          <Col span={12}>
            <Form.Item name="code" label="编码" rules={[{ required: true }]}>
              <Input />
            </Form.Item>
          </Col>
          <Col span={12}>
            <Form.Item name="name" label="名称" rules={[{ required: true }]}>
              <Input />
            </Form.Item>
          </Col>
        </Row>
        {showBillingMethod && (
          <Form.Item name="billing_method" label="计费方式" rules={[{ required: true }]}>
            <Select options={[{ label: "按重量", value: "weight" }]} />
          </Form.Item>
        )}
        {showPrice && (
          <Form.Item name="price" label="价格" rules={[{ required: true }]}>
            <InputNumber min={0} precision={2} style={{ width: "100%" }} />
          </Form.Item>
        )}
        {showDefault && (
          <Form.Item name="is_default" valuePropName="checked">
            <Checkbox>默认包装</Checkbox>
          </Form.Item>
        )}
        <Form.Item name="status" label="状态" rules={[{ required: true }]}>
          <Select options={statusOptions} />
        </Form.Item>
      </>
    );
  };

  if (!allowedCodes.has("warehouses.view")) {
    return <ForbiddenPage />;
  }

  return (
    <Space orientation="vertical" size={16} className="workspace-page">
      <div className="page-heading">
        <div>
          <Typography.Title level={2}>基础配置</Typography.Title>
          <Typography.Paragraph>仓库、渠道、包装、增值服务和简版费率。</Typography.Paragraph>
        </div>
        {canManage && (
          <Button type="primary" icon={<PlusOutlined />} onClick={() => openCreate(activeResource)}>
            新建{resourceLabels[activeResource]}
          </Button>
        )}
      </div>

      <Card>
        <Space orientation="vertical" size={16} className="config-page">
          {!canManage && <Alert type="info" showIcon message="当前账号只读基础配置，缺少 warehouses.manage。" />}
          <Tabs
            activeKey={activeResource}
            onChange={(key) => {
              setActiveResource(key as ResourceKey);
              setKeyword("");
            }}
            items={[
              { key: "warehouses", label: "仓库" },
              { key: "shippingChannels", label: "发货渠道" },
              { key: "packagingMethods", label: "包装方式" },
              { key: "valueAddedServices", label: "增值服务" },
              { key: "ratePlans", label: "费率方案" },
            ]}
          />
          <div className="filter-bar">
            <Input
              allowClear
              prefix={<SearchOutlined />}
              placeholder={`搜索${resourceLabels[activeResource]}`}
              value={keyword}
              onChange={(event) => setKeyword(event.target.value)}
            />
          </div>
          {activeQueryError && (
            <Alert type="error" showIcon title={getErrorMessage(activeQueryError)} />
          )}
          {renderTable()}
        </Space>
      </Card>

      <Modal
        title={
          modalState
            ? `${modalState.mode === "create" ? "新建" : "编辑"}${resourceLabels[modalState.resource]}`
            : ""
        }
        open={Boolean(modalState)}
        destroyOnHidden
        confirmLoading={saveMutation.isPending}
        onCancel={() => setModalState(null)}
        onOk={() => {
          form.validateFields().then((values) => {
            if (modalState) {
              saveMutation.mutate({ modal: modalState, values });
            }
          });
        }}
      >
        <Form form={form} layout="vertical" requiredMark={false}>
          {renderFormFields()}
        </Form>
      </Modal>
    </Space>
  );
}

const statusOptions = [
  { label: "启用", value: "ACTIVE" },
  { label: "停用", value: "DISABLED" },
];
