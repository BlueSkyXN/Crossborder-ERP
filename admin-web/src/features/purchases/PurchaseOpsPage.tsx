import {
  CheckCircleOutlined,
  CloseCircleOutlined,
  ExceptionOutlined,
  ExportOutlined,
  EyeOutlined,
  ReloadOutlined,
  SearchOutlined,
  ShoppingOutlined,
  TruckOutlined,
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
  Modal,
  Row,
  Select,
  Space,
  Statistic,
  Table,
  Tabs,
  Tag,
  Timeline,
  Typography,
} from "antd";
import type { TableColumnsType } from "antd";
import { useEffect, useMemo, useState } from "react";
import { useOutletContext } from "react-router-dom";

import { ForbiddenPage } from "../../pages/ForbiddenPage";
import { purchaseOpsApi } from "./api";
import type {
  PurchaseArrivedPayload,
  PurchaseCancelPayload,
  PurchaseConvertPayload,
  PurchaseExceptionPayload,
  PurchaseOrder,
  PurchaseOrderItem,
  PurchaseOrderStatus,
  PurchaseProcurePayload,
  PurchaseReviewPayload,
} from "./types";

type WorkspaceContext = {
  allowedCodes: Set<string>;
};

type ActiveStatus = "ALL" | PurchaseOrderStatus;
type ActionType = "review" | "procure" | "arrive" | "convert" | "exception" | "cancel";

type ActionState = {
  type: ActionType;
  orderId: number;
};

type ReviewFormValues = {
  review_remark?: string;
};

type ProcureFormValues = {
  purchase_amount?: number;
  external_order_no?: string;
  tracking_no?: string;
  remark?: string;
};

type ArrivedFormValues = {
  tracking_no?: string;
  remark?: string;
};

type ConvertFormValues = {
  warehouse_id?: number;
  tracking_no?: string;
  carrier?: string;
  weight_kg?: number;
  length_cm?: number;
  width_cm?: number;
  height_cm?: number;
  remark?: string;
};

type ExceptionFormValues = {
  remark?: string;
};

type CancelFormValues = {
  reason?: string;
};

const purchaseOrdersQueryKey = ["admin-purchase-orders"] as const;
const warehousesQueryKey = ["admin-config", "warehouses"] as const;

const purchaseStatusMeta: Record<PurchaseOrderStatus, { color: string; label: string }> = {
  PENDING_PAYMENT: { color: "orange", label: "待付款" },
  PENDING_REVIEW: { color: "gold", label: "待审核" },
  PENDING_PROCUREMENT: { color: "blue", label: "待采购" },
  PROCURED: { color: "cyan", label: "已采购" },
  ARRIVED: { color: "purple", label: "已到货" },
  COMPLETED: { color: "green", label: "已完成" },
  CANCELLED: { color: "default", label: "已取消" },
  EXCEPTION: { color: "red", label: "异常单" },
};

const statusTabs: { key: ActiveStatus; label: string }[] = [
  { key: "ALL", label: "全部" },
  { key: "PENDING_PAYMENT", label: "待付款" },
  { key: "PENDING_REVIEW", label: "待审核" },
  { key: "PENDING_PROCUREMENT", label: "待采购" },
  { key: "PROCURED", label: "已采购" },
  { key: "ARRIVED", label: "已到货" },
  { key: "COMPLETED", label: "已完成" },
  { key: "EXCEPTION", label: "异常单" },
  { key: "CANCELLED", label: "已取消" },
];

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : "请求失败";
}

function statusTag(status: PurchaseOrderStatus) {
  const meta = purchaseStatusMeta[status];
  return <Tag color={meta.color}>{meta.label}</Tag>;
}

function sourceTag(sourceType: PurchaseOrder["source_type"]) {
  return <Tag color={sourceType === "MANUAL" ? "geekblue" : "green"}>{sourceType === "MANUAL" ? "手工代购" : "自营商品"}</Tag>;
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

function formatMoney(value?: string | null) {
  return value ? `CNY ${value}` : "-";
}

function toDecimalString(value?: number, fractionDigits = 2) {
  if (value === undefined || value === null) {
    return undefined;
  }
  return value.toFixed(fractionDigits);
}

function buildOperationTimeline(order: PurchaseOrder) {
  const task = order.procurement_task;
  const items = [
    { time: order.created_at, label: "用户提交代购单", note: order.user_email },
    { time: order.paid_at, label: "用户完成支付", note: formatMoney(order.total_amount) },
    { time: order.reviewed_at, label: "后台审核通过", note: order.reviewed_by_name || order.review_remark },
    { time: task?.procured_at, label: "采购处理完成", note: task?.external_order_no || task?.tracking_no },
    { time: task?.arrived_at, label: "采购商品到货", note: task?.tracking_no },
    { time: order.converted_parcel?.inbound_at, label: "转入在库包裹", note: order.converted_parcel?.parcel_no },
  ].filter((item) => item.time);
  return items.map((item) => ({
    children: (
      <Space orientation="vertical" size={0}>
        <Typography.Text strong>{item.label}</Typography.Text>
        <Typography.Text type="secondary">{`${formatDate(item.time)} / ${item.note || "-"}`}</Typography.Text>
      </Space>
    ),
  }));
}

export function PurchaseOpsPage() {
  const { allowedCodes } = useOutletContext<WorkspaceContext>();
  const queryClient = useQueryClient();
  const { message } = AntdApp.useApp();
  const [reviewForm] = Form.useForm<ReviewFormValues>();
  const [procureForm] = Form.useForm<ProcureFormValues>();
  const [arrivedForm] = Form.useForm<ArrivedFormValues>();
  const [convertForm] = Form.useForm<ConvertFormValues>();
  const [exceptionForm] = Form.useForm<ExceptionFormValues>();
  const [cancelForm] = Form.useForm<CancelFormValues>();
  const [activeStatus, setActiveStatus] = useState<ActiveStatus>("ALL");
  const [keyword, setKeyword] = useState("");
  const [detailOrderId, setDetailOrderId] = useState<number | null>(null);
  const [action, setAction] = useState<ActionState | null>(null);

  const ordersQuery = useQuery({
    queryKey: purchaseOrdersQueryKey,
    queryFn: purchaseOpsApi.listPurchaseOrders,
  });
  const warehousesQuery = useQuery({
    queryKey: warehousesQueryKey,
    queryFn: purchaseOpsApi.listWarehouseOptions,
  });

  const orders = useMemo(() => ordersQuery.data ?? [], [ordersQuery.data]);
  const warehouses = useMemo(() => warehousesQuery.data ?? [], [warehousesQuery.data]);
  const detailOrder = useMemo(
    () => orders.find((order) => order.id === detailOrderId) || null,
    [detailOrderId, orders],
  );
  const actionOrder = useMemo(
    () => orders.find((order) => order.id === action?.orderId) || null,
    [action?.orderId, orders],
  );
  const warehouseOptions = warehouses.map((warehouse) => ({
    label: `${warehouse.name} (${warehouse.code})`,
    value: warehouse.id,
  }));

  const statusCounts = useMemo(() => {
    const counts = Object.fromEntries(statusTabs.map((tab) => [tab.key, 0])) as Record<ActiveStatus, number>;
    counts.ALL = orders.length;
    orders.forEach((order) => {
      counts[order.status] = (counts[order.status] || 0) + 1;
    });
    return counts;
  }, [orders]);

  const filteredOrders = useMemo(() => {
    const statusRows = activeStatus === "ALL" ? orders : orders.filter((order) => order.status === activeStatus);
    return filterRows(statusRows, keyword, (row) => [
      row.order_no,
      row.user_email,
      row.source_type,
      row.status,
      row.items.map((item) => `${item.name} ${item.product_url} ${item.sku_code || ""}`).join(" "),
      row.procurement_task?.tracking_no,
      row.converted_parcel?.parcel_no,
    ]);
  }, [activeStatus, keyword, orders]);

  useEffect(() => {
    const defaultWarehouse = warehouseOptions[0]?.value;
    if (defaultWarehouse && !convertForm.getFieldValue("warehouse_id")) {
      convertForm.setFieldValue("warehouse_id", defaultWarehouse);
    }
  }, [convertForm, warehouseOptions]);

  const replaceOrderInCache = (nextOrder: PurchaseOrder) => {
    queryClient.setQueryData<PurchaseOrder[]>(purchaseOrdersQueryKey, (current = []) =>
      current.map((order) => (order.id === nextOrder.id ? nextOrder : order)),
    );
  };

  const invalidateOrders = () => {
    queryClient.invalidateQueries({ queryKey: purchaseOrdersQueryKey });
  };

  const closeAction = () => {
    setAction(null);
  };

  const openAction = (type: ActionType, order: PurchaseOrder) => {
    setAction({ type, orderId: order.id });
    if (type === "review") {
      reviewForm.resetFields();
      reviewForm.setFieldsValue({ review_remark: order.review_remark || "" });
    }
    if (type === "procure") {
      procureForm.resetFields();
      procureForm.setFieldsValue({
        purchase_amount: Number(order.total_amount) - Number(order.service_fee || 0),
        external_order_no: order.procurement_task?.external_order_no || "",
        tracking_no: order.procurement_task?.tracking_no || "",
        remark: order.procurement_task?.remark || "",
      });
    }
    if (type === "arrive") {
      arrivedForm.resetFields();
      arrivedForm.setFieldsValue({ tracking_no: order.procurement_task?.tracking_no || "", remark: "" });
    }
    if (type === "convert") {
      convertForm.resetFields();
      convertForm.setFieldsValue({
        warehouse_id: warehouseOptions[0]?.value,
        tracking_no: order.procurement_task?.tracking_no || "",
        weight_kg: undefined,
        remark: `${order.order_no} 到货转包裹`,
      });
    }
    if (type === "exception") {
      exceptionForm.resetFields();
      exceptionForm.setFieldsValue({ remark: order.procurement_task?.remark || order.review_remark || "" });
    }
    if (type === "cancel") {
      cancelForm.resetFields();
      cancelForm.setFieldsValue({ reason: order.review_remark || "" });
    }
  };

  const handleOrderSuccess = (order: PurchaseOrder, text: string) => {
    replaceOrderInCache(order);
    invalidateOrders();
    closeAction();
    message.success(text);
  };

  const reviewMutation = useMutation({
    mutationFn: ({ orderId, payload }: { orderId: number; payload: PurchaseReviewPayload }) =>
      purchaseOpsApi.reviewPurchaseOrder(orderId, payload),
    onSuccess: (order) => handleOrderSuccess(order, `${order.order_no} 已审核`),
    onError: (error) => message.error(getErrorMessage(error)),
  });

  const procureMutation = useMutation({
    mutationFn: ({ orderId, payload }: { orderId: number; payload: PurchaseProcurePayload }) =>
      purchaseOpsApi.procurePurchaseOrder(orderId, payload),
    onSuccess: (order) => handleOrderSuccess(order, `${order.order_no} 已采购`),
    onError: (error) => message.error(getErrorMessage(error)),
  });

  const arrivedMutation = useMutation({
    mutationFn: ({ orderId, payload }: { orderId: number; payload: PurchaseArrivedPayload }) =>
      purchaseOpsApi.markPurchaseOrderArrived(orderId, payload),
    onSuccess: (order) => handleOrderSuccess(order, `${order.order_no} 已到货`),
    onError: (error) => message.error(getErrorMessage(error)),
  });

  const convertMutation = useMutation({
    mutationFn: ({ orderId, payload }: { orderId: number; payload: PurchaseConvertPayload }) =>
      purchaseOpsApi.convertPurchaseOrderToParcel(orderId, payload),
    onSuccess: (order) => handleOrderSuccess(order, `${order.order_no} 已转包裹`),
    onError: (error) => message.error(getErrorMessage(error)),
  });

  const exceptionMutation = useMutation({
    mutationFn: ({ orderId, payload }: { orderId: number; payload: PurchaseExceptionPayload }) =>
      purchaseOpsApi.markPurchaseOrderException(orderId, payload),
    onSuccess: (order) => handleOrderSuccess(order, `${order.order_no} 已标记异常`),
    onError: (error) => message.error(getErrorMessage(error)),
  });

  const cancelMutation = useMutation({
    mutationFn: ({ orderId, payload }: { orderId: number; payload: PurchaseCancelPayload }) =>
      purchaseOpsApi.cancelPurchaseOrder(orderId, payload),
    onSuccess: (order) => handleOrderSuccess(order, `${order.order_no} 已取消`),
    onError: (error) => message.error(getErrorMessage(error)),
  });

  const renderActionButtons = (order: PurchaseOrder) => (
    <Space size={4} wrap>
      <Button size="small" title="查看详情" icon={<EyeOutlined />} onClick={() => setDetailOrderId(order.id)} />
      {order.status === "PENDING_REVIEW" && (
        <Button size="small" type="primary" title="审核" icon={<CheckCircleOutlined />} onClick={() => openAction("review", order)} />
      )}
      {order.status === "PENDING_PROCUREMENT" && (
        <Button size="small" type="primary" title="采购" icon={<ShoppingOutlined />} onClick={() => openAction("procure", order)} />
      )}
      {order.status === "PROCURED" && (
        <Button size="small" type="primary" title="到货" icon={<TruckOutlined />} onClick={() => openAction("arrive", order)} />
      )}
      {order.status === "ARRIVED" && (
        <Button size="small" type="primary" title="转包裹" icon={<ExportOutlined />} onClick={() => openAction("convert", order)} />
      )}
      {["PENDING_REVIEW", "PENDING_PROCUREMENT", "PROCURED"].includes(order.status) && (
        <Button size="small" title="异常" danger icon={<ExceptionOutlined />} onClick={() => openAction("exception", order)} />
      )}
      {["PENDING_PAYMENT", "EXCEPTION"].includes(order.status) && (
        <Button size="small" title="取消" icon={<CloseCircleOutlined />} onClick={() => openAction("cancel", order)} />
      )}
    </Space>
  );

  const columns: TableColumnsType<PurchaseOrder> = [
    { title: "代购单号", dataIndex: "order_no", width: 160, render: (value: string) => <Typography.Text copyable strong>{value}</Typography.Text> },
    { title: "会员", dataIndex: "user_email", width: 220 },
    { title: "来源", dataIndex: "source_type", width: 120, render: sourceTag },
    { title: "状态", dataIndex: "status", width: 130, render: statusTag },
    { title: "金额", dataIndex: "total_amount", width: 120, render: formatMoney },
    {
      title: "采购单号",
      dataIndex: "procurement_task",
      width: 160,
      render: (value: PurchaseOrder["procurement_task"]) => value?.external_order_no || "-",
    },
    {
      title: "快递单号",
      dataIndex: "procurement_task",
      width: 180,
      render: (value: PurchaseOrder["procurement_task"]) => value?.tracking_no || "-",
    },
    { title: "创建时间", dataIndex: "created_at", width: 180, render: formatDate },
    { title: "操作", width: 260, fixed: "right", render: (_, record) => renderActionButtons(record) },
  ];

  const itemColumns: TableColumnsType<PurchaseOrderItem> = [
    { title: "商品", dataIndex: "name", width: 220, render: (value: string) => <Typography.Text strong>{value}</Typography.Text> },
    { title: "数量", dataIndex: "quantity", width: 80 },
    { title: "单价", dataIndex: "unit_price", width: 110, render: formatMoney },
    { title: "实付单价", dataIndex: "actual_price", width: 120, render: formatMoney },
    { title: "SKU", dataIndex: "sku_code", width: 130, render: (value: string | null) => value || "-" },
    { title: "备注", dataIndex: "remark", width: 160, render: (value: string) => value || "-" },
  ];

  if (!allowedCodes.has("purchases.view")) {
    return <ForbiddenPage />;
  }

  return (
    <Space orientation="vertical" size={16} className="workspace-page purchase-ops-page">
      <div className="page-heading">
        <div>
          <Typography.Title level={2}>代购处理</Typography.Title>
          <Typography.Paragraph>处理代购订单审核、采购、到货和转包裹。</Typography.Paragraph>
        </div>
        <Button icon={<ReloadOutlined />} onClick={() => ordersQuery.refetch()}>刷新</Button>
      </div>

      <Row gutter={[16, 16]}>
        <Col xs={24} md={6}><Card><Statistic title="待审核" value={statusCounts.PENDING_REVIEW} suffix="单" /></Card></Col>
        <Col xs={24} md={6}><Card><Statistic title="待采购" value={statusCounts.PENDING_PROCUREMENT} suffix="单" /></Card></Col>
        <Col xs={24} md={6}><Card><Statistic title="已到货" value={statusCounts.ARRIVED} suffix="单" /></Card></Col>
        <Col xs={24} md={6}><Card><Statistic title="异常单" value={statusCounts.EXCEPTION} suffix="单" /></Card></Col>
      </Row>

      <Card>
        <Space orientation="vertical" size={16} className="purchase-workspace">
          <Tabs
            activeKey={activeStatus}
            onChange={(key) => setActiveStatus(key as ActiveStatus)}
            items={statusTabs.map((tab) => ({ key: tab.key, label: `${tab.label} ${statusCounts[tab.key] || 0}` }))}
          />
          {(ordersQuery.error || warehousesQuery.error) && (
            <Alert type="error" showIcon title={getErrorMessage(ordersQuery.error || warehousesQuery.error)} />
          )}
          <div className="filter-bar">
            <Input
              allowClear
              prefix={<SearchOutlined />}
              placeholder="搜索单号、会员、商品、快递单号或包裹号"
              value={keyword}
              onChange={(event) => setKeyword(event.target.value)}
            />
          </div>
          <Table
            rowKey="id"
            loading={ordersQuery.isLoading}
            dataSource={filteredOrders}
            columns={columns}
            pagination={{ pageSize: 10, showSizeChanger: true }}
            scroll={{ x: 1530 }}
            locale={{ emptyText: <Empty description="暂无代购单" /> }}
          />
        </Space>
      </Card>

      <Drawer
        title={detailOrder ? `${detailOrder.order_no} 详情` : "代购详情"}
        open={Boolean(detailOrderId)}
        size={920}
        destroyOnHidden
        onClose={() => setDetailOrderId(null)}
        extra={detailOrder ? renderActionButtons(detailOrder) : null}
      >
        {detailOrder && (
          <Space orientation="vertical" size={16} className="purchase-detail">
            <Descriptions
              bordered
              column={{ xs: 1, md: 2 }}
              size="small"
              items={[
                { key: "order_no", label: "代购单号", children: detailOrder.order_no },
                { key: "status", label: "状态", children: statusTag(detailOrder.status) },
                { key: "source", label: "来源", children: sourceTag(detailOrder.source_type) },
                { key: "user", label: "会员", children: detailOrder.user_email },
                { key: "total", label: "订单金额", children: formatMoney(detailOrder.total_amount) },
                { key: "service_fee", label: "服务费", children: formatMoney(detailOrder.service_fee) },
                { key: "paid_at", label: "支付时间", children: formatDate(detailOrder.paid_at) },
                { key: "reviewed_at", label: "审核时间", children: formatDate(detailOrder.reviewed_at) },
                { key: "review_remark", label: "审核备注", children: detailOrder.review_remark || "-" },
                {
                  key: "converted",
                  label: "转入包裹",
                  children: detailOrder.converted_parcel
                    ? `${detailOrder.converted_parcel.parcel_no} / ${detailOrder.converted_parcel.status}`
                    : "-",
                },
              ]}
            />

            <Card title="商品明细" size="small">
              <Table
                rowKey="id"
                size="small"
                pagination={false}
                dataSource={detailOrder.items}
                columns={itemColumns}
                scroll={{ x: 840 }}
                locale={{ emptyText: <Empty description="暂无明细" /> }}
              />
            </Card>

            <Row gutter={[16, 16]}>
              <Col xs={24} lg={12}>
                <Card title="采购任务" size="small">
                  {detailOrder.procurement_task ? (
                    <Descriptions
                      column={1}
                      size="small"
                      items={[
                        { key: "assignee", label: "采购员", children: detailOrder.procurement_task.assignee_name || "-" },
                        { key: "status", label: "任务状态", children: detailOrder.procurement_task.status },
                        { key: "amount", label: "实采金额", children: formatMoney(detailOrder.procurement_task.purchase_amount) },
                        { key: "external", label: "外部订单", children: detailOrder.procurement_task.external_order_no || "-" },
                        { key: "tracking", label: "快递单号", children: detailOrder.procurement_task.tracking_no || "-" },
                        { key: "remark", label: "备注", children: detailOrder.procurement_task.remark || "-" },
                      ]}
                    />
                  ) : (
                    <Empty description="暂无采购任务" />
                  )}
                </Card>
              </Col>
              <Col xs={24} lg={12}>
                <Card title="处理时间线" size="small">
                  <Timeline
                    mode="left"
                    items={buildOperationTimeline(detailOrder)}
                    pending={detailOrder.status !== "COMPLETED" ? "等待下一步处理" : false}
                  />
                </Card>
              </Col>
            </Row>
          </Space>
        )}
      </Drawer>

      <Modal
        title={actionOrder ? `${actionOrder.order_no} 操作` : "代购操作"}
        open={Boolean(action)}
        onCancel={closeAction}
        destroyOnHidden
        footer={null}
      >
        {action?.type === "review" && actionOrder && (
          <Form form={reviewForm} layout="vertical" onFinish={(values) => reviewMutation.mutate({ orderId: actionOrder.id, payload: { review_remark: values.review_remark?.trim() || "" } })}>
            <Form.Item name="review_remark" label="审核备注"><Input.TextArea rows={3} /></Form.Item>
            <Button type="primary" htmlType="submit" block loading={reviewMutation.isPending}>审核通过</Button>
          </Form>
        )}

        {action?.type === "procure" && actionOrder && (
          <Form
            form={procureForm}
            layout="vertical"
            onFinish={(values) =>
              procureMutation.mutate({
                orderId: actionOrder.id,
                payload: {
                  purchase_amount: toDecimalString(values.purchase_amount),
                  external_order_no: values.external_order_no?.trim() || "",
                  tracking_no: values.tracking_no?.trim() || "",
                  remark: values.remark?.trim() || "",
                },
              })
            }
          >
            <Form.Item name="purchase_amount" label="实采金额"><InputNumber min={0} precision={2} className="full-width-input" /></Form.Item>
            <Form.Item name="external_order_no" label="外部订单号"><Input /></Form.Item>
            <Form.Item name="tracking_no" label="采购物流单号"><Input /></Form.Item>
            <Form.Item name="remark" label="采购备注"><Input.TextArea rows={3} /></Form.Item>
            <Button type="primary" htmlType="submit" block loading={procureMutation.isPending}>确认采购</Button>
          </Form>
        )}

        {action?.type === "arrive" && actionOrder && (
          <Form
            form={arrivedForm}
            layout="vertical"
            onFinish={(values) =>
              arrivedMutation.mutate({
                orderId: actionOrder.id,
                payload: { tracking_no: values.tracking_no?.trim() || "", remark: values.remark?.trim() || "" },
              })
            }
          >
            <Form.Item name="tracking_no" label="到货物流单号"><Input /></Form.Item>
            <Form.Item name="remark" label="到货备注"><Input.TextArea rows={3} /></Form.Item>
            <Button type="primary" htmlType="submit" block loading={arrivedMutation.isPending}>标记到货</Button>
          </Form>
        )}

        {action?.type === "convert" && actionOrder && (
          <Form
            form={convertForm}
            layout="vertical"
            onFinish={(values) =>
              convertMutation.mutate({
                orderId: actionOrder.id,
                payload: {
                  warehouse_id: Number(values.warehouse_id),
                  tracking_no: values.tracking_no?.trim() || "",
                  carrier: values.carrier?.trim() || "",
                  weight_kg: String(values.weight_kg ?? ""),
                  length_cm: toDecimalString(values.length_cm),
                  width_cm: toDecimalString(values.width_cm),
                  height_cm: toDecimalString(values.height_cm),
                  remark: values.remark?.trim() || "",
                },
              })
            }
          >
            <Form.Item name="warehouse_id" label="入库仓库" rules={[{ required: true, message: "请选择仓库" }]}>
              <Select options={warehouseOptions} loading={warehousesQuery.isLoading} />
            </Form.Item>
            <Form.Item name="tracking_no" label="包裹快递单号"><Input /></Form.Item>
            <Form.Item name="carrier" label="承运商"><Input /></Form.Item>
            <Row gutter={12}>
              <Col span={12}>
                <Form.Item name="weight_kg" label="重量 kg" rules={[{ required: true, message: "请输入重量" }]}>
                  <InputNumber min={0.001} precision={3} className="full-width-input" />
                </Form.Item>
              </Col>
              <Col span={12}>
                <Form.Item name="length_cm" label="长 cm"><InputNumber min={0} precision={2} className="full-width-input" /></Form.Item>
              </Col>
              <Col span={12}>
                <Form.Item name="width_cm" label="宽 cm"><InputNumber min={0} precision={2} className="full-width-input" /></Form.Item>
              </Col>
              <Col span={12}>
                <Form.Item name="height_cm" label="高 cm"><InputNumber min={0} precision={2} className="full-width-input" /></Form.Item>
              </Col>
            </Row>
            <Form.Item name="remark" label="入库备注"><Input.TextArea rows={3} /></Form.Item>
            <Button type="primary" htmlType="submit" block loading={convertMutation.isPending}>转为在库包裹</Button>
          </Form>
        )}

        {action?.type === "exception" && actionOrder && (
          <Form form={exceptionForm} layout="vertical" onFinish={(values) => exceptionMutation.mutate({ orderId: actionOrder.id, payload: { remark: values.remark?.trim() || "" } })}>
            <Form.Item name="remark" label="异常说明"><Input.TextArea rows={3} /></Form.Item>
            <Button danger htmlType="submit" block loading={exceptionMutation.isPending}>标记异常</Button>
          </Form>
        )}

        {action?.type === "cancel" && actionOrder && (
          <Form form={cancelForm} layout="vertical" onFinish={(values) => cancelMutation.mutate({ orderId: actionOrder.id, payload: { reason: values.reason?.trim() || "" } })}>
            <Form.Item name="reason" label="取消原因"><Input.TextArea rows={3} /></Form.Item>
            <Button htmlType="submit" block loading={cancelMutation.isPending}>取消订单</Button>
          </Form>
        )}
      </Modal>
    </Space>
  );
}
