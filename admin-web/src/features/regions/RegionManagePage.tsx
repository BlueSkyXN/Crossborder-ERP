import {
  DeleteOutlined,
  EditOutlined,
  PlusOutlined,
  ReloadOutlined,
  SearchOutlined,
} from "@ant-design/icons";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Alert,
  App as AntdApp,
  Breadcrumb,
  Button,
  Card,
  Col,
  Empty,
  Form,
  Input,
  InputNumber,
  Modal,
  Row,
  Select,
  Space,
  Table,
  Tag,
  Typography,
} from "antd";
import type { TableColumnsType } from "antd";
import { useMemo, useState } from "react";
import { useOutletContext } from "react-router-dom";

import { ForbiddenPage } from "../../pages/ForbiddenPage";
import {
  createRegion,
  deleteRegion,
  fetchAdminRegions,
  updateRegion,
  type Region,
  type RegionPayload,
  type RegionQueryParams,
} from "./api";

type WorkspaceContext = {
  allowedCodes: Set<string>;
  permissionCodes: Set<string>;
};

const LEVEL_SEQUENCE = ["COUNTRY", "PROVINCE", "CITY", "DISTRICT", "ZONE"] as const;

type RegionFormValues = {
  parent_id?: number | null;
  name?: string;
  code?: string;
  level?: string;
  is_active?: boolean;
};

type RegionPathItem = {
  id: number | null;
  name: string;
};

type RegionAction =
  | { mode: "create" }
  | { mode: "edit"; record: Region }
  | null;

const activeOptions = [
  { label: "全部状态", value: "" },
  { label: "启用", value: "true" },
  { label: "停用", value: "false" },
];

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : "请求失败";
}

function activeTag(value: boolean) {
  return value ? <Tag color="green">启用</Tag> : <Tag color="default">停用</Tag>;
}

function regionLevelLabel(value: number | string) {
  const levelText = String(value);
  const labels: Record<string, string> = {
    COUNTRY: "国家/地区",
    PROVINCE: "省/州",
    CITY: "城市",
    DISTRICT: "区县",
    ZONE: "区域",
  };
  return labels[levelText] || levelText;
}

export function RegionManagePage() {
  const { allowedCodes, permissionCodes } = useOutletContext<WorkspaceContext>();
  const canManage = permissionCodes.has("regions.manage");
  const queryClient = useQueryClient();
  const { message, modal } = AntdApp.useApp();
  const [form] = Form.useForm<RegionFormValues>();
  const [keyword, setKeyword] = useState("");
  const [activeFilter, setActiveFilter] = useState("");
  const [manualParentId, setManualParentId] = useState<number | null>(null);
  const [path, setPath] = useState<RegionPathItem[]>([{ id: null, name: "全部地区" }]);
  const [action, setAction] = useState<RegionAction>(null);

  const currentParentId = path[path.length - 1]?.id ?? manualParentId ?? null;
  const params = useMemo<RegionQueryParams>(
    () => ({
      parent_id: currentParentId ?? undefined,
      keyword: keyword.trim() || undefined,
      is_active: activeFilter || undefined,
    }),
    [activeFilter, currentParentId, keyword],
  );

  const regionsQuery = useQuery({
    queryKey: ["admin-regions", params],
    queryFn: () => fetchAdminRegions(params),
  });

  const regions = regionsQuery.data ?? [];

  const refreshRegions = () => {
    queryClient.invalidateQueries({ queryKey: ["admin-regions"] });
  };

  const closeModal = () => {
    setAction(null);
  };

  const openCreate = () => {
    form.resetFields();
    form.setFieldsValue({
      parent_id: currentParentId,
      level: LEVEL_SEQUENCE[Math.min(path.length, LEVEL_SEQUENCE.length - 1)],
      is_active: true,
    });
    setAction({ mode: "create" });
  };

  const openEdit = (record: Region) => {
    form.setFieldsValue({
      parent_id: record.parent_id,
      name: record.name,
      code: record.code,
      level: record.level,
      is_active: record.is_active,
    });
    setAction({ mode: "edit", record });
  };

  const saveMutation = useMutation({
    mutationFn: ({ id, payload }: { id?: number; payload: RegionPayload }) =>
      id ? updateRegion(id, payload) : createRegion(payload),
    onSuccess: () => {
      refreshRegions();
      closeModal();
      message.success("地区已保存");
    },
    onError: (error) => message.error(getErrorMessage(error)),
  });

  const deleteMutation = useMutation({
    mutationFn: deleteRegion,
    onSuccess: () => {
      refreshRegions();
      message.success("地区已删除");
    },
    onError: (error) => message.error(getErrorMessage(error)),
  });

  const submitRegion = (values: RegionFormValues) => {
    const payload: RegionPayload = {
      parent_id: values.parent_id ?? null,
      name: String(values.name || "").trim(),
      code: String(values.code || "").trim(),
      level: values.level ?? "COUNTRY",
      is_active: values.is_active ?? true,
    };
    saveMutation.mutate({
      id: action?.mode === "edit" ? action.record.id : undefined,
      payload,
    });
  };

  const enterChildren = (record: Region) => {
    setManualParentId(null);
    setKeyword("");
    setPath((items) => [...items, { id: record.id, name: record.name }]);
  };

  const jumpToPath = (index: number) => {
    setManualParentId(null);
    setPath((items) => items.slice(0, index + 1));
  };

  const jumpToParent = (value: number | null) => {
    setPath([{ id: null, name: "全部地区" }]);
    setManualParentId(value);
  };

  const confirmDelete = (record: Region) => {
    modal.confirm({
      title: "确认删除地区？",
      content: `删除后不可恢复：${record.name}`,
      okText: "删除",
      okType: "danger",
      cancelText: "取消",
      onOk: () => deleteMutation.mutateAsync(record.id),
    });
  };

  const columns: TableColumnsType<Region> = [
    {
      title: "名称",
      dataIndex: "name",
      width: 220,
      render: (value: string, record) => (
        <Button type="link" onClick={() => enterChildren(record)}>
          {value}
        </Button>
      ),
    },
    { title: "编码", dataIndex: "code", width: 160, render: (value: string) => <Typography.Text copyable>{value}</Typography.Text> },
    { title: "层级", dataIndex: "level", width: 120, render: regionLevelLabel },
    { title: "状态", dataIndex: "is_active", width: 100, render: activeTag },
    {
      title: "操作",
      width: 210,
      fixed: "right",
      render: (_, record) => (
        <Space size={4}>
          <Button size="small" onClick={() => enterChildren(record)}>
            下级
          </Button>
          <Button size="small" title="编辑" icon={<EditOutlined />} disabled={!canManage} onClick={() => openEdit(record)} />
          <Button
            size="small"
            danger
            title="删除"
            icon={<DeleteOutlined />}
            disabled={!canManage}
            onClick={() => confirmDelete(record)}
          />
        </Space>
      ),
    },
  ];

  if (!allowedCodes.has("regions.view")) {
    return <ForbiddenPage />;
  }

  return (
    <Space orientation="vertical" size={16} className="workspace-page region-manage-page">
      <div className="page-heading">
        <div>
          <Typography.Title level={2}>地区管理</Typography.Title>
          <Typography.Paragraph>维护国家/地区、省州、城市等基础地区资料。</Typography.Paragraph>
        </div>
        <Space wrap>
          <Button icon={<ReloadOutlined />} onClick={refreshRegions} loading={regionsQuery.isFetching}>
            刷新
          </Button>
          {canManage && (
            <Button type="primary" icon={<PlusOutlined />} onClick={openCreate}>
              新增地区
            </Button>
          )}
        </Space>
      </div>

      {!canManage && <Alert type="info" showIcon message="当前账号只读地区，缺少 regions.manage。" />}
      {regionsQuery.isError && <Alert type="error" showIcon message={getErrorMessage(regionsQuery.error)} />}

      <Card>
        <Space orientation="vertical" size={16} className="full-width-input">
          <Breadcrumb
            items={path.map((item, index) => ({
              title: (
                <Button type="link" size="small" onClick={() => jumpToPath(index)}>
                  {item.name}
                </Button>
              ),
            }))}
          />
          <Row gutter={[12, 12]}>
            <Col xs={24} md={10}>
              <Input
                allowClear
                prefix={<SearchOutlined />}
                placeholder="搜索地区名称或编码"
                value={keyword}
                onChange={(event) => setKeyword(event.target.value)}
              />
            </Col>
            <Col xs={24} md={6}>
              <InputNumber
                min={1}
                precision={0}
                className="full-width-input"
                placeholder="按 parent_id 筛选"
                value={manualParentId}
                onChange={(value) => jumpToParent(value)}
              />
            </Col>
            <Col xs={24} md={6}>
              <Select
                className="full-width-input"
                value={activeFilter}
                options={activeOptions}
                onChange={setActiveFilter}
              />
            </Col>
          </Row>
          <Table
            rowKey="id"
            loading={regionsQuery.isLoading}
            dataSource={regions}
            columns={columns}
            pagination={{ pageSize: 10, showSizeChanger: true }}
            scroll={{ x: 820 }}
            locale={{ emptyText: <Empty description="暂无地区" /> }}
          />
        </Space>
      </Card>

      <Modal
        title={action?.mode === "edit" ? "编辑地区" : "新增地区"}
        open={Boolean(action)}
        onCancel={closeModal}
        destroyOnHidden
        footer={null}
      >
        <Form form={form} layout="vertical" onFinish={submitRegion}>
          <Form.Item name="name" label="地区名称" rules={[{ required: true, message: "请输入地区名称" }]}>
            <Input />
          </Form.Item>
          <Form.Item name="code" label="地区编码" rules={[{ required: true, message: "请输入地区编码" }]}>
            <Input />
          </Form.Item>
          <Row gutter={12}>
            <Col span={12}>
              <Form.Item name="parent_id" label="上级 parent_id">
                <InputNumber min={1} precision={0} className="full-width-input" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="level" label="层级" rules={[{ required: true, message: "请选择层级" }]}>
                <Select options={LEVEL_SEQUENCE.map((lv) => ({ label: regionLevelLabel(lv), value: lv }))} />
              </Form.Item>
            </Col>
          </Row>
          <Form.Item name="is_active" label="状态">
            <Select options={[{ label: "启用", value: true }, { label: "停用", value: false }]} />
          </Form.Item>
          <Button type="primary" htmlType="submit" block loading={saveMutation.isPending}>
            保存
          </Button>
        </Form>
      </Modal>
    </Space>
  );
}
