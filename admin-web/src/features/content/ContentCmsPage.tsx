import {
  EditOutlined,
  EyeInvisibleOutlined,
  FileTextOutlined,
  PlusOutlined,
  ReloadOutlined,
  SendOutlined,
} from "@ant-design/icons";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Alert,
  App as AntdApp,
  Button,
  Card,
  Col,
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
import { useMemo, useState } from "react";
import { useOutletContext } from "react-router-dom";

import { ForbiddenPage } from "../../pages/ForbiddenPage";
import { contentCmsApi } from "./api";
import type {
  ContentCategory,
  ContentCategoryPayload,
  ContentCategoryStatus,
  ContentPage,
  ContentPagePayload,
  ContentStatus,
  ContentType,
} from "./types";

type WorkspaceContext = {
  allowedCodes: Set<string>;
};

type ActiveTab = "pages" | "categories";
type TypeFilter = "ALL" | ContentType;

const pagesQueryKey = ["admin-content-pages"] as const;
const categoriesQueryKey = ["admin-content-categories"] as const;

const contentTypes: Array<{ value: ContentType; label: string }> = [
  { value: "ANNOUNCEMENT", label: "公告" },
  { value: "HELP", label: "帮助" },
  { value: "TERMS", label: "服务条款" },
  { value: "PRIVACY", label: "隐私政策" },
  { value: "ABOUT", label: "关于我们" },
];

const statusMeta: Record<ContentStatus, { color: string; label: string }> = {
  DRAFT: { color: "gold", label: "草稿" },
  PUBLISHED: { color: "green", label: "已发布" },
  HIDDEN: { color: "default", label: "已隐藏" },
};

const categoryStatusMeta: Record<ContentCategoryStatus, { color: string; label: string }> = {
  ACTIVE: { color: "green", label: "启用" },
  DISABLED: { color: "default", label: "停用" },
};

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : "请求失败";
}

function formatDate(value?: string | null) {
  if (!value) {
    return "-";
  }
  return new Date(value).toLocaleString("zh-CN", { hour12: false });
}

function contentTypeLabel(type: ContentType) {
  return contentTypes.find((item) => item.value === type)?.label || type;
}

function statusTag(status: ContentStatus) {
  const meta = statusMeta[status];
  return <Tag color={meta.color}>{meta.label}</Tag>;
}

function categoryStatusTag(status: ContentCategoryStatus) {
  const meta = categoryStatusMeta[status];
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

function buildCategoryPayload(values: ContentCategoryPayload): ContentCategoryPayload {
  return {
    type: values.type,
    slug: values.slug.trim(),
    name: values.name.trim(),
    description: values.description?.trim() || "",
    sort_order: values.sort_order ?? 0,
    status: values.status || "ACTIVE",
  };
}

function buildPagePayload(values: ContentPagePayload): ContentPagePayload {
  return {
    category_id: values.category_id ?? null,
    type: values.type,
    slug: values.slug.trim(),
    title: values.title.trim(),
    summary: values.summary?.trim() || "",
    body: values.body,
    status: values.status || "DRAFT",
    sort_order: values.sort_order ?? 0,
    published_at: values.published_at || null,
  };
}

export function ContentCmsPage() {
  const { allowedCodes } = useOutletContext<WorkspaceContext>();
  const queryClient = useQueryClient();
  const { message } = AntdApp.useApp();
  const [pageForm] = Form.useForm<ContentPagePayload>();
  const [categoryForm] = Form.useForm<ContentCategoryPayload>();
  const [activeTab, setActiveTab] = useState<ActiveTab>("pages");
  const [typeFilter, setTypeFilter] = useState<TypeFilter>("ALL");
  const [keyword, setKeyword] = useState("");
  const [editingPage, setEditingPage] = useState<ContentPage | null>(null);
  const [editingCategory, setEditingCategory] = useState<ContentCategory | null>(null);
  const [pageDrawerOpen, setPageDrawerOpen] = useState(false);
  const [categoryDrawerOpen, setCategoryDrawerOpen] = useState(false);

  const hasPermission = allowedCodes.has("content.view");
  const pagesQuery = useQuery({
    queryKey: pagesQueryKey,
    queryFn: contentCmsApi.listPages,
    enabled: hasPermission,
  });
  const categoriesQuery = useQuery({
    queryKey: categoriesQueryKey,
    queryFn: contentCmsApi.listCategories,
    enabled: hasPermission,
  });

  const pages = useMemo(() => pagesQuery.data ?? [], [pagesQuery.data]);
  const categories = useMemo(() => categoriesQuery.data ?? [], [categoriesQuery.data]);
  const categoryOptions = useMemo(
    () =>
      categories.map((category) => ({
        label: `${category.name} (${contentTypeLabel(category.type)})`,
        value: category.id,
      })),
    [categories],
  );

  const invalidateContent = () => {
    queryClient.invalidateQueries({ queryKey: pagesQueryKey });
    queryClient.invalidateQueries({ queryKey: categoriesQueryKey });
  };

  const createPageMutation = useMutation({
    mutationFn: contentCmsApi.createPage,
    onSuccess: (page) => {
      invalidateContent();
      setPageDrawerOpen(false);
      pageForm.resetFields();
      message.success(`${page.title} 已创建`);
    },
    onError: (error) => message.error(getErrorMessage(error)),
  });

  const updatePageMutation = useMutation({
    mutationFn: ({ pageId, payload }: { pageId: number; payload: ContentPagePayload }) =>
      contentCmsApi.updatePage(pageId, payload),
    onSuccess: (page) => {
      invalidateContent();
      setPageDrawerOpen(false);
      setEditingPage(null);
      message.success(`${page.title} 已更新`);
    },
    onError: (error) => message.error(getErrorMessage(error)),
  });

  const publishPageMutation = useMutation({
    mutationFn: contentCmsApi.publishPage,
    onSuccess: (page) => {
      invalidateContent();
      message.success(`${page.title} 已发布`);
    },
    onError: (error) => message.error(getErrorMessage(error)),
  });

  const hidePageMutation = useMutation({
    mutationFn: contentCmsApi.hidePage,
    onSuccess: (page) => {
      invalidateContent();
      message.warning(`${page.title} 已隐藏`);
    },
    onError: (error) => message.error(getErrorMessage(error)),
  });

  const createCategoryMutation = useMutation({
    mutationFn: contentCmsApi.createCategory,
    onSuccess: (category) => {
      invalidateContent();
      setCategoryDrawerOpen(false);
      categoryForm.resetFields();
      message.success(`${category.name} 已创建`);
    },
    onError: (error) => message.error(getErrorMessage(error)),
  });

  const updateCategoryMutation = useMutation({
    mutationFn: ({ categoryId, payload }: { categoryId: number; payload: ContentCategoryPayload }) =>
      contentCmsApi.updateCategory(categoryId, payload),
    onSuccess: (category) => {
      invalidateContent();
      setCategoryDrawerOpen(false);
      setEditingCategory(null);
      message.success(`${category.name} 已更新`);
    },
    onError: (error) => message.error(getErrorMessage(error)),
  });

  const disableCategoryMutation = useMutation({
    mutationFn: contentCmsApi.disableCategory,
    onSuccess: (category) => {
      invalidateContent();
      message.warning(`${category.name} 已停用`);
    },
    onError: (error) => message.error(getErrorMessage(error)),
  });

  const openPageDrawer = (page?: ContentPage) => {
    setEditingPage(page ?? null);
    setPageDrawerOpen(true);
    pageForm.setFieldsValue(
      page
        ? {
            category_id: page.category,
            type: page.type,
            slug: page.slug,
            title: page.title,
            summary: page.summary,
            body: page.body,
            status: page.status,
            sort_order: page.sort_order,
            published_at: page.published_at,
          }
        : {
            category_id: null,
            type: "HELP",
            status: "DRAFT",
            sort_order: 0,
            slug: "",
            title: "",
            summary: "",
            body: "",
            published_at: null,
          },
    );
  };

  const openCategoryDrawer = (category?: ContentCategory) => {
    setEditingCategory(category ?? null);
    setCategoryDrawerOpen(true);
    categoryForm.setFieldsValue(
      category
        ? {
            type: category.type,
            slug: category.slug,
            name: category.name,
            description: category.description,
            sort_order: category.sort_order,
            status: category.status,
          }
        : {
            type: "HELP",
            slug: "",
            name: "",
            description: "",
            sort_order: 0,
            status: "ACTIVE",
          },
    );
  };

  const submitPage = () => {
    pageForm.validateFields().then((values) => {
      const payload = buildPagePayload(values);
      if (editingPage) {
        updatePageMutation.mutate({ pageId: editingPage.id, payload });
        return;
      }
      createPageMutation.mutate(payload);
    });
  };

  const submitCategory = () => {
    categoryForm.validateFields().then((values) => {
      const payload = buildCategoryPayload(values);
      if (editingCategory) {
        updateCategoryMutation.mutate({ categoryId: editingCategory.id, payload });
        return;
      }
      createCategoryMutation.mutate(payload);
    });
  };

  if (!hasPermission) {
    return <ForbiddenPage />;
  }

  const filteredPages = filterRows(
    typeFilter === "ALL" ? pages : pages.filter((page) => page.type === typeFilter),
    keyword,
    (page) => [page.slug, page.title, page.summary, page.category_name, contentTypeLabel(page.type)],
  );
  const filteredCategories = filterRows(
    typeFilter === "ALL" ? categories : categories.filter((category) => category.type === typeFilter),
    keyword,
    (category) => [category.slug, category.name, category.description, contentTypeLabel(category.type)],
  );

  const pageColumns: TableColumnsType<ContentPage> = [
    {
      title: "内容",
      dataIndex: "title",
      width: 260,
      render: (value: string, record) => (
        <Space orientation="vertical" size={0}>
          <Typography.Text strong>{value}</Typography.Text>
          <Typography.Text type="secondary">{record.slug}</Typography.Text>
        </Space>
      ),
    },
    { title: "类型", dataIndex: "type", width: 120, render: (value: ContentType) => contentTypeLabel(value) },
    { title: "分类", dataIndex: "category_name", width: 150, render: (value: string | null) => value || "-" },
    { title: "状态", dataIndex: "status", width: 110, render: statusTag },
    { title: "摘要", dataIndex: "summary", ellipsis: true },
    { title: "排序", dataIndex: "sort_order", width: 80 },
    { title: "发布时间", dataIndex: "published_at", width: 170, render: formatDate },
    {
      title: "操作",
      width: 220,
      fixed: "right",
      render: (_, record) => (
        <Space size={4}>
          <Button size="small" icon={<EditOutlined />} onClick={() => openPageDrawer(record)}>
            编辑
          </Button>
          <Button
            size="small"
            type="primary"
            disabled={record.status === "PUBLISHED"}
            loading={publishPageMutation.isPending}
            icon={<SendOutlined />}
            onClick={() => publishPageMutation.mutate(record.id)}
          >
            发布
          </Button>
          <Button
            size="small"
            danger
            disabled={record.status === "HIDDEN"}
            loading={hidePageMutation.isPending}
            icon={<EyeInvisibleOutlined />}
            onClick={() => hidePageMutation.mutate(record.id)}
          >
            隐藏
          </Button>
        </Space>
      ),
    },
  ];

  const categoryColumns: TableColumnsType<ContentCategory> = [
    {
      title: "分类",
      dataIndex: "name",
      render: (value: string, record) => (
        <Space orientation="vertical" size={0}>
          <Typography.Text strong>{value}</Typography.Text>
          <Typography.Text type="secondary">{record.slug}</Typography.Text>
        </Space>
      ),
    },
    { title: "类型", dataIndex: "type", width: 120, render: (value: ContentType) => contentTypeLabel(value) },
    { title: "状态", dataIndex: "status", width: 110, render: categoryStatusTag },
    { title: "说明", dataIndex: "description", ellipsis: true },
    { title: "排序", dataIndex: "sort_order", width: 80 },
    {
      title: "操作",
      width: 170,
      fixed: "right",
      render: (_, record) => (
        <Space>
          <Button size="small" icon={<EditOutlined />} onClick={() => openCategoryDrawer(record)}>
            编辑
          </Button>
          <Button
            size="small"
            danger
            disabled={record.status === "DISABLED"}
            loading={disableCategoryMutation.isPending}
            onClick={() => disableCategoryMutation.mutate(record.id)}
          >
            停用
          </Button>
        </Space>
      ),
    },
  ];

  const publishedCount = pages.filter((page) => page.status === "PUBLISHED").length;
  const draftCount = pages.filter((page) => page.status === "DRAFT").length;
  const hiddenCount = pages.filter((page) => page.status === "HIDDEN").length;
  const isPageSaving = createPageMutation.isPending || updatePageMutation.isPending;
  const isCategorySaving = createCategoryMutation.isPending || updateCategoryMutation.isPending;

  return (
    <Space orientation="vertical" size={16} className="workspace-page content-cms-page">
      <div className="page-heading">
        <div>
          <Typography.Title level={2}>内容管理</Typography.Title>
          <Typography.Paragraph>帮助、公告、条款、隐私政策和关于我们。</Typography.Paragraph>
        </div>
        <Space wrap>
          <Button icon={<ReloadOutlined />} onClick={invalidateContent}>
            刷新
          </Button>
          <Button icon={<PlusOutlined />} onClick={() => openCategoryDrawer()}>
            新建分类
          </Button>
          <Button type="primary" icon={<FileTextOutlined />} onClick={() => openPageDrawer()}>
            新建内容
          </Button>
        </Space>
      </div>

      <Row gutter={[16, 16]}>
        <Col xs={24} md={8}>
          <Card>
            <Statistic title="已发布" value={publishedCount} suffix="篇" styles={{ content: { color: "#10b981" } }} />
          </Card>
        </Col>
        <Col xs={24} md={8}>
          <Card>
            <Statistic title="草稿" value={draftCount} suffix="篇" styles={{ content: { color: "#f59e0b" } }} />
          </Card>
        </Col>
        <Col xs={24} md={8}>
          <Card>
            <Statistic title="已隐藏" value={hiddenCount} suffix="篇" />
          </Card>
        </Col>
      </Row>

      <Card>
        <Space orientation="vertical" size={16} style={{ width: "100%" }}>
          {(pagesQuery.error || categoriesQuery.error) && (
            <Alert type="error" showIcon message={getErrorMessage(pagesQuery.error || categoriesQuery.error)} />
          )}
          <Tabs
            activeKey={activeTab}
            onChange={(key) => {
              setActiveTab(key as ActiveTab);
              setKeyword("");
            }}
            items={[
              { key: "pages", label: "内容条目" },
              { key: "categories", label: "内容分类" },
            ]}
          />
          <div className="filter-bar">
            <Select
              value={typeFilter}
              style={{ width: 150 }}
              onChange={(value) => setTypeFilter(value)}
              options={[{ value: "ALL", label: "全部类型" }, ...contentTypes]}
            />
            <Input allowClear placeholder="搜索标题、slug、分类或摘要" value={keyword} onChange={(event) => setKeyword(event.target.value)} />
          </div>
          {activeTab === "pages" && (
            <Table
              rowKey="id"
              loading={pagesQuery.isLoading}
              dataSource={filteredPages}
              columns={pageColumns}
              pagination={{ pageSize: 8, showSizeChanger: true }}
              scroll={{ x: 1240 }}
              locale={{ emptyText: <Empty description="暂无内容" /> }}
            />
          )}
          {activeTab === "categories" && (
            <Table
              rowKey="id"
              loading={categoriesQuery.isLoading}
              dataSource={filteredCategories}
              columns={categoryColumns}
              pagination={{ pageSize: 8, showSizeChanger: true }}
              scroll={{ x: 900 }}
              locale={{ emptyText: <Empty description="暂无分类" /> }}
            />
          )}
        </Space>
      </Card>

      <Drawer
        title={editingPage ? `编辑 ${editingPage.title}` : "新建内容"}
        open={pageDrawerOpen}
        size={680}
        forceRender
        onClose={() => {
          setPageDrawerOpen(false);
          setEditingPage(null);
        }}
        extra={
          <Button type="primary" loading={isPageSaving} onClick={submitPage}>
            保存
          </Button>
        }
      >
        <Form form={pageForm} layout="vertical" requiredMark={false}>
          <Row gutter={12}>
            <Col xs={24} md={12}>
              <Form.Item name="type" label="内容类型" rules={[{ required: true }]}>
                <Select options={contentTypes} />
              </Form.Item>
            </Col>
            <Col xs={24} md={12}>
              <Form.Item name="category_id" label="分类">
                <Select allowClear options={categoryOptions} placeholder="可选" />
              </Form.Item>
            </Col>
            <Col xs={24} md={12}>
              <Form.Item name="status" label="状态" rules={[{ required: true }]}>
                <Select
                  options={[
                    { value: "DRAFT", label: "草稿" },
                    { value: "PUBLISHED", label: "已发布" },
                    { value: "HIDDEN", label: "已隐藏" },
                  ]}
                />
              </Form.Item>
            </Col>
            <Col xs={24} md={12}>
              <Form.Item name="sort_order" label="排序" rules={[{ required: true }]}>
                <InputNumber min={0} style={{ width: "100%" }} />
              </Form.Item>
            </Col>
          </Row>
          <Form.Item name="slug" label="Slug" rules={[{ required: true }]}>
            <Input placeholder="how-to-forecast-parcel" />
          </Form.Item>
          <Form.Item name="title" label="标题" rules={[{ required: true }]}>
            <Input maxLength={180} />
          </Form.Item>
          <Form.Item name="summary" label="摘要">
            <Input.TextArea rows={2} maxLength={300} showCount />
          </Form.Item>
          <Form.Item name="body" label="正文" rules={[{ required: true }]}>
            <Input.TextArea rows={12} />
          </Form.Item>
        </Form>
      </Drawer>

      <Drawer
        title={editingCategory ? `编辑 ${editingCategory.name}` : "新建分类"}
        open={categoryDrawerOpen}
        size={520}
        forceRender
        onClose={() => {
          setCategoryDrawerOpen(false);
          setEditingCategory(null);
        }}
        extra={
          <Button type="primary" loading={isCategorySaving} onClick={submitCategory}>
            保存
          </Button>
        }
      >
        <Form form={categoryForm} layout="vertical" requiredMark={false}>
          <Form.Item name="type" label="内容类型" rules={[{ required: true }]}>
            <Select options={contentTypes} />
          </Form.Item>
          <Form.Item name="slug" label="Slug" rules={[{ required: true }]}>
            <Input placeholder="getting-started" />
          </Form.Item>
          <Form.Item name="name" label="分类名称" rules={[{ required: true }]}>
            <Input maxLength={120} />
          </Form.Item>
          <Form.Item name="description" label="说明">
            <Input.TextArea rows={4} />
          </Form.Item>
          <Form.Item name="sort_order" label="排序" rules={[{ required: true }]}>
            <InputNumber min={0} style={{ width: "100%" }} />
          </Form.Item>
          <Form.Item name="status" label="状态" rules={[{ required: true }]}>
            <Select
              options={[
                { value: "ACTIVE", label: "启用" },
                { value: "DISABLED", label: "停用" },
              ]}
            />
          </Form.Item>
        </Form>
      </Drawer>
    </Space>
  );
}
