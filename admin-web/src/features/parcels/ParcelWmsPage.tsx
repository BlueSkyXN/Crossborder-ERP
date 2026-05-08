import {
  CheckCircleOutlined,
  EyeOutlined,
  PlusOutlined,
  ReloadOutlined,
  SearchOutlined,
} from "@ant-design/icons";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Alert,
  App as AntdApp,
  Button,
  Card,
  Col,
  Descriptions,
  Drawer,
  Empty,
  Form,
  Input,
  InputNumber,
  Row,
  Select,
  Space,
  Statistic,
  Table,
  Tabs,
  Tag,
  Typography,
} from "antd";
import type { TableColumnsType } from "antd";
import { useEffect, useMemo, useState } from "react";
import { useOutletContext } from "react-router-dom";

import { ForbiddenPage } from "../../pages/ForbiddenPage";
import { warehouseConfigApi } from "../warehouses/api";
import { parcelWmsApi } from "./api";
import type {
  InboundPayload,
  Parcel,
  ParcelStatus,
  ScanInboundPayload,
  ScanInboundResponse,
  UnclaimedParcel,
  UnclaimedParcelCreatePayload,
  UnclaimedParcelStatus,
} from "./types";

type WorkspaceContext = {
  allowedCodes: Set<string>;
};

type ActiveTab = "pending" | "scan" | "stock" | "unclaimed";

type InboundFormValues = {
  warehouse_id?: number;
  tracking_no?: string;
  weight_kg?: number;
  length_cm?: number;
  width_cm?: number;
  height_cm?: number;
  photo_file_ids?: string;
  remark?: string;
};

type UnclaimedFormValues = {
  warehouse_id?: number;
  tracking_no?: string;
  description?: string;
  weight_kg?: number;
};

const parcelQueryKey = ["admin-parcels"] as const;
const unclaimedQueryKey = ["admin-unclaimed-parcels"] as const;
const warehousesQueryKey = ["admin-config", "warehouses"] as const;

const parcelStatusMeta: Record<ParcelStatus, { color: string; label: string }> = {
  PENDING_INBOUND: { color: "gold", label: "待入库" },
  IN_STOCK: { color: "green", label: "在库" },
  PACKING_REQUESTED: { color: "blue", label: "已申请打包" },
  PACKED: { color: "cyan", label: "已打包" },
  OUTBOUND: { color: "purple", label: "已出库" },
  CANCELLED: { color: "default", label: "已取消" },
  PROBLEM: { color: "red", label: "问题包裹" },
};

const unclaimedStatusMeta: Record<UnclaimedParcelStatus, { color: string; label: string }> = {
  UNCLAIMED: { color: "gold", label: "待认领" },
  CLAIM_PENDING: { color: "blue", label: "认领待审" },
  CLAIMED: { color: "green", label: "已认领" },
};

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : "加载失败";
}

function statusTag(status: ParcelStatus) {
  const meta = parcelStatusMeta[status];
  return <Tag color={meta.color}>{meta.label}</Tag>;
}

function unclaimedStatusTag(status: UnclaimedParcelStatus) {
  const meta = unclaimedStatusMeta[status];
  return <Tag color={meta.color}>{meta.label}</Tag>;
}

function normalizeText(value: unknown) {
  return value === undefined || value === null ? "" : String(value).toLowerCase();
}

function filterRows<T>(rows: T[], keyword: string, pickText: (row: T) => unknown[]) {
  const normalized = keyword.trim().toLowerCase();
  if (!normalized) {
    return rows;
  }
  return rows.filter((row) => pickText(row).map(normalizeText).join(" ").includes(normalized));
}

function formatDate(value?: string | null) {
  if (!value) {
    return "-";
  }
  return new Date(value).toLocaleString("zh-CN", { hour12: false });
}

function formatWeight(value?: string | null) {
  return value ? `${value} kg` : "-";
}

function formatDimensions(parcel: Pick<Parcel, "length_cm" | "width_cm" | "height_cm">) {
  if (!parcel.length_cm && !parcel.width_cm && !parcel.height_cm) {
    return "-";
  }
  return `${parcel.length_cm || "-"} x ${parcel.width_cm || "-"} x ${parcel.height_cm || "-"} cm`;
}

function toDecimalString(value?: number) {
  if (value === undefined || value === null) {
    return undefined;
  }
  return String(value);
}

function parsePhotoFileIds(value?: string) {
  return (value || "")
    .split(/[\n,，]+/)
    .map((fileId) => fileId.trim())
    .filter(Boolean);
}

function buildInboundPayload(values: InboundFormValues): InboundPayload {
  const photoFileIds = parsePhotoFileIds(values.photo_file_ids);
  return {
    weight_kg: String(values.weight_kg ?? ""),
    length_cm: toDecimalString(values.length_cm),
    width_cm: toDecimalString(values.width_cm),
    height_cm: toDecimalString(values.height_cm),
    photo_file_ids: photoFileIds.length > 0 ? photoFileIds : undefined,
    remark: values.remark?.trim() || "",
  };
}

function buildScanInboundPayload(values: InboundFormValues): ScanInboundPayload {
  return {
    ...buildInboundPayload(values),
    warehouse_id: Number(values.warehouse_id),
    tracking_no: String(values.tracking_no || "").trim(),
  };
}

function buildUnclaimedPayload(values: UnclaimedFormValues): UnclaimedParcelCreatePayload {
  return {
    warehouse_id: Number(values.warehouse_id),
    tracking_no: String(values.tracking_no || "").trim(),
    description: values.description?.trim() || "",
    weight_kg: toDecimalString(values.weight_kg),
  };
}

export function ParcelWmsPage() {
  const { allowedCodes } = useOutletContext<WorkspaceContext>();
  const queryClient = useQueryClient();
  const { message } = AntdApp.useApp();
  const [scanForm] = Form.useForm<InboundFormValues>();
  const [inboundForm] = Form.useForm<InboundFormValues>();
  const [unclaimedForm] = Form.useForm<UnclaimedFormValues>();
  const [activeTab, setActiveTab] = useState<ActiveTab>("pending");
  const [keyword, setKeyword] = useState("");
  const [detailParcel, setDetailParcel] = useState<Parcel | null>(null);
  const [inboundParcel, setInboundParcel] = useState<Parcel | null>(null);
  const [scanResult, setScanResult] = useState<ScanInboundResponse | null>(null);

  const parcelsQuery = useQuery({
    queryKey: parcelQueryKey,
    queryFn: parcelWmsApi.listParcels,
  });
  const unclaimedQuery = useQuery({
    queryKey: unclaimedQueryKey,
    queryFn: parcelWmsApi.listUnclaimedParcels,
  });
  const warehousesQuery = useQuery({
    queryKey: warehousesQueryKey,
    queryFn: warehouseConfigApi.listWarehouses,
  });

  const parcels = useMemo(() => parcelsQuery.data ?? [], [parcelsQuery.data]);
  const unclaimedParcels = useMemo(() => unclaimedQuery.data ?? [], [unclaimedQuery.data]);
  const pendingParcels = useMemo(
    () => parcels.filter((parcel) => parcel.status === "PENDING_INBOUND"),
    [parcels],
  );
  const stockParcels = useMemo(
    () => parcels.filter((parcel) => parcel.status === "IN_STOCK"),
    [parcels],
  );
  const warehouseOptions = useMemo(
    () =>
      (warehousesQuery.data ?? []).map((warehouse) => ({
        label: `${warehouse.name} (${warehouse.code})`,
        value: warehouse.id,
      })),
    [warehousesQuery.data],
  );

  useEffect(() => {
    const defaultWarehouseId = warehouseOptions[0]?.value;
    if (!defaultWarehouseId) {
      return;
    }
    if (!scanForm.getFieldValue("warehouse_id")) {
      scanForm.setFieldValue("warehouse_id", defaultWarehouseId);
    }
    if (!unclaimedForm.getFieldValue("warehouse_id")) {
      unclaimedForm.setFieldValue("warehouse_id", defaultWarehouseId);
    }
  }, [scanForm, unclaimedForm, warehouseOptions]);

  const invalidateParcelData = () => {
    queryClient.invalidateQueries({ queryKey: parcelQueryKey });
    queryClient.invalidateQueries({ queryKey: unclaimedQueryKey });
  };

  const inboundMutation = useMutation({
    mutationFn: ({ parcelId, payload }: { parcelId: number; payload: InboundPayload }) =>
      parcelWmsApi.inboundParcel(parcelId, payload),
    onSuccess: (parcel) => {
      invalidateParcelData();
      setInboundParcel(null);
      inboundForm.resetFields();
      message.success(`${parcel.parcel_no} 已入库`);
    },
    onError: (error) => message.error(getErrorMessage(error)),
  });

  const scanMutation = useMutation({
    mutationFn: parcelWmsApi.scanInbound,
    onSuccess: (result) => {
      invalidateParcelData();
      setScanResult(result);
      if (result.parcel) {
        message.success(`${result.parcel.parcel_no} 已扫描入库`);
        scanForm.resetFields(["tracking_no", "weight_kg", "length_cm", "width_cm", "height_cm", "photo_file_ids", "remark"]);
      } else if (result.unclaimed_parcel) {
        message.warning(
          result.created_unclaimed
            ? `${result.unclaimed_parcel.tracking_no} 已登记为无主包裹`
            : `${result.unclaimed_parcel.tracking_no} 已存在无主记录`,
        );
        scanForm.resetFields(["tracking_no", "weight_kg", "length_cm", "width_cm", "height_cm", "photo_file_ids", "remark"]);
      }
    },
    onError: (error) => message.error(getErrorMessage(error)),
  });

  const unclaimedCreateMutation = useMutation({
    mutationFn: parcelWmsApi.createUnclaimedParcel,
    onSuccess: (unclaimed) => {
      queryClient.invalidateQueries({ queryKey: unclaimedQueryKey });
      unclaimedForm.resetFields();
      message.success(`${unclaimed.tracking_no} 已登记`);
    },
    onError: (error) => message.error(getErrorMessage(error)),
  });

  const openInbound = (parcel: Parcel) => {
    setInboundParcel(parcel);
    inboundForm.resetFields();
    inboundForm.setFieldsValue({
      weight_kg: parcel.weight_kg ? Number(parcel.weight_kg) : undefined,
      length_cm: parcel.length_cm ? Number(parcel.length_cm) : undefined,
      width_cm: parcel.width_cm ? Number(parcel.width_cm) : undefined,
      height_cm: parcel.height_cm ? Number(parcel.height_cm) : undefined,
    });
  };

  const parcelColumns: TableColumnsType<Parcel> = [
    {
      title: "包裹号",
      dataIndex: "parcel_no",
      width: 130,
      render: (value: string) => <Typography.Text strong>{value}</Typography.Text>,
    },
    { title: "快递单号", dataIndex: "tracking_no", width: 180 },
    { title: "会员", dataIndex: "user_email", width: 200 },
    { title: "仓库", dataIndex: "warehouse_name", width: 140 },
    { title: "状态", dataIndex: "status", width: 110, render: statusTag },
    {
      title: "重量",
      dataIndex: "weight_kg",
      width: 110,
      render: (value: string | null) => formatWeight(value),
    },
    { title: "创建时间", dataIndex: "created_at", width: 180, render: formatDate },
    {
      title: "操作",
      width: 150,
      fixed: "right",
      render: (_, record) => (
        <Space size={4}>
          <Button
            size="small"
            title="查看详情"
            icon={<EyeOutlined />}
            onClick={() => setDetailParcel(record)}
          />
          {record.status === "PENDING_INBOUND" && (
            <Button
              size="small"
              type="primary"
              title="入库"
              icon={<CheckCircleOutlined />}
              onClick={() => openInbound(record)}
            />
          )}
        </Space>
      ),
    },
  ];

  const unclaimedColumns: TableColumnsType<UnclaimedParcel> = [
    { title: "快递单号", dataIndex: "tracking_no", width: 180 },
    { title: "仓库", dataIndex: "warehouse_name", width: 140 },
    { title: "状态", dataIndex: "status", width: 120, render: unclaimedStatusTag },
    {
      title: "重量",
      dataIndex: "weight_kg",
      width: 110,
      render: (value: string | null) => formatWeight(value),
    },
    { title: "说明", dataIndex: "description" },
    { title: "登记时间", dataIndex: "created_at", width: 180, render: formatDate },
  ];

  const filteredPending = filterRows(pendingParcels, keyword, (row) => [
    row.parcel_no,
    row.tracking_no,
    row.user_email,
    row.warehouse_name,
  ]);
  const filteredStock = filterRows(stockParcels, keyword, (row) => [
    row.parcel_no,
    row.tracking_no,
    row.user_email,
    row.warehouse_name,
  ]);
  const filteredUnclaimed = filterRows(unclaimedParcels, keyword, (row) => [
    row.tracking_no,
    row.warehouse_name,
    row.description,
  ]);

  const renderParcelTable = (rows: Parcel[], emptyDescription: string) => (
    <Table
      rowKey="id"
      loading={parcelsQuery.isLoading}
      dataSource={rows}
      columns={parcelColumns}
      pagination={{ pageSize: 8, showSizeChanger: true }}
      scroll={{ x: 1090 }}
      locale={{ emptyText: <Empty description={emptyDescription} /> }}
    />
  );

  if (!allowedCodes.has("parcels.view")) {
    return <ForbiddenPage />;
  }

  return (
    <Space orientation="vertical" size={16} className="workspace-page parcel-wms-page">
      <div className="page-heading">
        <div>
          <Typography.Title level={2}>包裹入库</Typography.Title>
          <Typography.Paragraph>待入库、扫描入库、在库包裹和无主包裹。</Typography.Paragraph>
        </div>
        <Space wrap>
          <Button
            icon={<ReloadOutlined />}
            onClick={() => {
              parcelsQuery.refetch();
              unclaimedQuery.refetch();
            }}
          >
            刷新
          </Button>
          <Button type="primary" icon={<PlusOutlined />} onClick={() => setActiveTab("unclaimed")}>
            登记无主包裹
          </Button>
        </Space>
      </div>

      <Row gutter={[16, 16]}>
        <Col xs={24} md={8}>
          <Card>
            <Statistic title="待入库" value={pendingParcels.length} suffix="件" styles={{ content: { color: "#f59e0b" } }} />
          </Card>
        </Col>
        <Col xs={24} md={8}>
          <Card>
            <Statistic title="在库可处理" value={stockParcels.length} suffix="件" styles={{ content: { color: "#10b981" } }} />
          </Card>
        </Col>
        <Col xs={24} md={8}>
          <Card>
            <Statistic title="无主包裹" value={unclaimedParcels.length} suffix="件" styles={{ content: { color: "#2563eb" } }} />
          </Card>
        </Col>
      </Row>

      <Card>
        <Space orientation="vertical" size={16} className="parcel-workspace">
          <Tabs
            activeKey={activeTab}
            onChange={(key) => {
              setActiveTab(key as ActiveTab);
              setKeyword("");
            }}
            items={[
              { key: "pending", label: "待入库" },
              { key: "scan", label: "扫描入库" },
              { key: "stock", label: "在库包裹" },
              { key: "unclaimed", label: "无主包裹" },
            ]}
          />

          {(parcelsQuery.error || unclaimedQuery.error || warehousesQuery.error) && (
            <Alert
              type="error"
              showIcon
              title={getErrorMessage(parcelsQuery.error || unclaimedQuery.error || warehousesQuery.error)}
            />
          )}

          {activeTab !== "scan" && (
            <div className="filter-bar">
              <Input
                allowClear
                prefix={<SearchOutlined />}
                placeholder="搜索包裹号、快递单号、会员或仓库"
                value={keyword}
                onChange={(event) => setKeyword(event.target.value)}
              />
            </div>
          )}

          {activeTab === "pending" && renderParcelTable(filteredPending, "暂无待入库包裹")}
          {activeTab === "stock" && renderParcelTable(filteredStock, "暂无在库包裹")}
          {activeTab === "scan" && (
            <Row gutter={[16, 16]} align="stretch">
              <Col xs={24} lg={14}>
                <Card title="扫描入库" className="scan-card">
                  <Form
                    form={scanForm}
                    layout="vertical"
                    requiredMark={false}
                    initialValues={{ warehouse_id: warehouseOptions[0]?.value }}
                    onFinish={(values) => scanMutation.mutate(buildScanInboundPayload(values))}
                  >
                    <Form.Item name="tracking_no" label="快递单号" rules={[{ required: true }]}>
                      <Input
                        size="large"
                        className="scan-tracking-input"
                        autoFocus
                        placeholder="扫描或输入快递单号"
                      />
                    </Form.Item>
                    <Row gutter={12}>
                      <Col xs={24} md={12}>
                        <Form.Item name="warehouse_id" label="入库仓库" rules={[{ required: true }]}>
                          <Select
                            loading={warehousesQuery.isLoading}
                            options={warehouseOptions}
                            placeholder="选择仓库"
                          />
                        </Form.Item>
                      </Col>
                      <Col xs={24} md={12}>
                        <Form.Item name="weight_kg" label="重量 kg" rules={[{ required: true }]}>
                          <InputNumber min={0.001} precision={3} style={{ width: "100%" }} />
                        </Form.Item>
                      </Col>
                      <Col xs={24} md={8}>
                        <Form.Item name="length_cm" label="长 cm">
                          <InputNumber min={0} precision={2} style={{ width: "100%" }} />
                        </Form.Item>
                      </Col>
                      <Col xs={24} md={8}>
                        <Form.Item name="width_cm" label="宽 cm">
                          <InputNumber min={0} precision={2} style={{ width: "100%" }} />
                        </Form.Item>
                      </Col>
                      <Col xs={24} md={8}>
                        <Form.Item name="height_cm" label="高 cm">
                          <InputNumber min={0} precision={2} style={{ width: "100%" }} />
                        </Form.Item>
                      </Col>
                    </Row>
                    <Form.Item name="photo_file_ids" label="图片凭证">
                      <Input.TextArea rows={2} placeholder="多个文件 ID 用逗号或换行分隔" />
                    </Form.Item>
                    <Form.Item name="remark" label="备注">
                      <Input.TextArea rows={3} />
                    </Form.Item>
                    <Button type="primary" htmlType="submit" loading={scanMutation.isPending} icon={<SearchOutlined />}>
                      搜索并入库
                    </Button>
                  </Form>
                </Card>
              </Col>
              <Col xs={24} lg={10}>
                <Card title="扫描结果">
                  {!scanResult && <Empty description="暂无扫描结果" />}
                  {scanResult?.parcel && (
                    <Space orientation="vertical" size={12} className="scan-result">
                      <Alert type="success" showIcon title={`${scanResult.parcel.parcel_no} 已入库`} />
                      <Descriptions
                        column={1}
                        size="small"
                        items={[
                          { key: "tracking", label: "快递单号", children: scanResult.parcel.tracking_no },
                          { key: "member", label: "会员", children: scanResult.parcel.user_email },
                          { key: "warehouse", label: "仓库", children: scanResult.parcel.warehouse_name },
                          { key: "status", label: "状态", children: statusTag(scanResult.parcel.status) },
                        ]}
                      />
                    </Space>
                  )}
                  {scanResult?.unclaimed_parcel && (
                    <Space orientation="vertical" size={12} className="scan-result">
                      <Alert type="warning" showIcon title="未匹配预报，已进入无主包裹队列" />
                      <Descriptions
                        column={1}
                        size="small"
                        items={[
                          { key: "tracking", label: "快递单号", children: scanResult.unclaimed_parcel.tracking_no },
                          { key: "warehouse", label: "仓库", children: scanResult.unclaimed_parcel.warehouse_name },
                          {
                            key: "status",
                            label: "状态",
                            children: unclaimedStatusTag(scanResult.unclaimed_parcel.status),
                          },
                        ]}
                      />
                    </Space>
                  )}
                </Card>
              </Col>
            </Row>
          )}
          {activeTab === "unclaimed" && (
            <Row gutter={[16, 16]}>
              <Col xs={24} lg={16}>
                <Table
                  rowKey="id"
                  loading={unclaimedQuery.isLoading}
                  dataSource={filteredUnclaimed}
                  columns={unclaimedColumns}
                  pagination={{ pageSize: 8, showSizeChanger: true }}
                  scroll={{ x: 860 }}
                  locale={{ emptyText: <Empty description="暂无无主包裹" /> }}
                />
              </Col>
              <Col xs={24} lg={8}>
                <Card title="无主包裹登记">
                  <Form
                    form={unclaimedForm}
                    layout="vertical"
                    requiredMark={false}
                    onFinish={(values) => unclaimedCreateMutation.mutate(buildUnclaimedPayload(values))}
                  >
                    <Form.Item name="tracking_no" label="快递单号" rules={[{ required: true }]}>
                      <Input />
                    </Form.Item>
                    <Form.Item name="warehouse_id" label="所在仓库" rules={[{ required: true }]}>
                      <Select
                        loading={warehousesQuery.isLoading}
                        options={warehouseOptions}
                        placeholder="选择仓库"
                      />
                    </Form.Item>
                    <Form.Item name="weight_kg" label="重量 kg">
                      <InputNumber min={0.001} precision={3} style={{ width: "100%" }} />
                    </Form.Item>
                    <Form.Item name="description" label="说明">
                      <Input.TextArea rows={4} />
                    </Form.Item>
                    <Button
                      type="primary"
                      htmlType="submit"
                      loading={unclaimedCreateMutation.isPending}
                      icon={<PlusOutlined />}
                    >
                      登记
                    </Button>
                  </Form>
                </Card>
              </Col>
            </Row>
          )}
        </Space>
      </Card>

      <Drawer
        title={detailParcel ? `${detailParcel.parcel_no} 详情` : "包裹详情"}
        open={Boolean(detailParcel)}
        size={720}
        destroyOnHidden
        onClose={() => setDetailParcel(null)}
      >
        {detailParcel && (
          <Space orientation="vertical" size={16} className="parcel-detail">
            <Descriptions
              bordered
              column={1}
              size="small"
              items={[
                { key: "parcel_no", label: "包裹号", children: detailParcel.parcel_no },
                { key: "tracking_no", label: "快递单号", children: detailParcel.tracking_no },
                { key: "carrier", label: "承运商", children: detailParcel.carrier || "-" },
                { key: "member", label: "会员", children: detailParcel.user_email },
                { key: "warehouse", label: "仓库", children: detailParcel.warehouse_name },
                { key: "status", label: "状态", children: statusTag(detailParcel.status) },
                { key: "weight", label: "重量", children: formatWeight(detailParcel.weight_kg) },
                { key: "dimensions", label: "体积", children: formatDimensions(detailParcel) },
                { key: "inbound_at", label: "入库时间", children: formatDate(detailParcel.inbound_at) },
                { key: "remark", label: "备注", children: detailParcel.remark || "-" },
              ]}
            />
            <Card title="商品明细" size="small">
              <Table
                rowKey="id"
                size="small"
                pagination={false}
                dataSource={detailParcel.items}
                columns={[
                  { title: "名称", dataIndex: "name" },
                  { title: "数量", dataIndex: "quantity", width: 80 },
                  { title: "申报价值", dataIndex: "declared_value", width: 120 },
                  { title: "备注", dataIndex: "remark" },
                ]}
                locale={{ emptyText: <Empty description="暂无商品明细" /> }}
              />
            </Card>
            <Card title="图片凭证" size="small">
              {detailParcel.photos.length === 0 ? (
                <Empty description="暂无图片凭证" />
              ) : (
                <Space wrap>
                  {detailParcel.photos.map((photo) => (
                    <Tag key={photo.id} color="blue">
                      {photo.file_id}
                    </Tag>
                  ))}
                </Space>
              )}
            </Card>
          </Space>
        )}
      </Drawer>

      <Drawer
        title={inboundParcel ? `${inboundParcel.parcel_no} 入库` : "包裹入库"}
        open={Boolean(inboundParcel)}
        size={520}
        destroyOnHidden
        onClose={() => setInboundParcel(null)}
        extra={
          <Button
            type="primary"
            loading={inboundMutation.isPending}
            onClick={() => {
              inboundForm.validateFields().then((values) => {
                if (inboundParcel) {
                  inboundMutation.mutate({
                    parcelId: inboundParcel.id,
                    payload: buildInboundPayload(values),
                  });
                }
              });
            }}
          >
            确认入库
          </Button>
        }
      >
        {inboundParcel && (
          <Space orientation="vertical" size={16} className="parcel-detail">
            <Alert
              type="info"
              showIcon
              title={`${inboundParcel.tracking_no} / ${inboundParcel.user_email}`}
            />
            <Form form={inboundForm} layout="vertical" requiredMark={false}>
              <Form.Item name="weight_kg" label="重量 kg" rules={[{ required: true }]}>
                <InputNumber min={0.001} precision={3} style={{ width: "100%" }} />
              </Form.Item>
              <Row gutter={12}>
                <Col span={8}>
                  <Form.Item name="length_cm" label="长 cm">
                    <InputNumber min={0} precision={2} style={{ width: "100%" }} />
                  </Form.Item>
                </Col>
                <Col span={8}>
                  <Form.Item name="width_cm" label="宽 cm">
                    <InputNumber min={0} precision={2} style={{ width: "100%" }} />
                  </Form.Item>
                </Col>
                <Col span={8}>
                  <Form.Item name="height_cm" label="高 cm">
                    <InputNumber min={0} precision={2} style={{ width: "100%" }} />
                  </Form.Item>
                </Col>
              </Row>
              <Form.Item name="photo_file_ids" label="图片凭证">
                <Input.TextArea rows={2} placeholder="多个文件 ID 用逗号或换行分隔" />
              </Form.Item>
              <Form.Item name="remark" label="备注">
                <Input.TextArea rows={4} />
              </Form.Item>
            </Form>
          </Space>
        )}
      </Drawer>
    </Space>
  );
}
