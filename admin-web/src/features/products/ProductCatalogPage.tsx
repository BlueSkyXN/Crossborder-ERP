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
import { productCatalogApi } from "./api";
import { ProductAttributesPanel } from "./ProductAttributesPanel";
import { ProductTranslationsPanel } from "./ProductTranslationsPanel";
import type {
  CatalogStatus,
  Product,
  ProductCategory,
  ProductCategoryPayload,
  ProductPayload,
  ProductSku,
  ProductSkuPayload,
} from "./types";

type WorkspaceContext = {
  allowedCodes: Set<string>;
  permissionCodes: Set<string>;
};

type ActiveTab = "categories" | "products" | "skus";
type ProductDetailTab = "skus" | "translations" | "attributes";
type CatalogAction =
  | { type: "category"; mode: "create"; record?: ProductCategory }
  | { type: "category"; mode: "edit"; record: ProductCategory }
  | { type: "product"; mode: "create"; record?: Product }
  | { type: "product"; mode: "edit"; record: Product }
  | { type: "sku"; mode: "create"; record?: ProductSku }
  | { type: "sku"; mode: "edit"; record: ProductSku };
type EditCatalogAction = Extract<CatalogAction, { mode: "edit" }>;

type CategoryFormValues = {
  parent_id?: number | null;
  name?: string;
  sort_order?: number;
  status?: CatalogStatus;
};

type ProductFormValues = {
  category_id?: number | null;
  title?: string;
  description?: string;
  status?: CatalogStatus;
  main_image_file_id?: string;
};

type SkuFormValues = {
  product_id?: number;
  sku_code?: string;
  spec_json_text?: string;
  price?: number;
  stock?: number;
  status?: CatalogStatus;
};

const categoriesQueryKey = ["admin-product-categories"] as const;
const productsQueryKey = ["admin-products"] as const;
const skusQueryKey = ["admin-product-skus"] as const;

const statusMeta: Record<CatalogStatus, { color: string; label: string }> = {
  ACTIVE: { color: "green", label: "启用" },
  DISABLED: { color: "default", label: "停用" },
};

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : "请求失败";
}

function statusTag(status: CatalogStatus) {
  const meta = statusMeta[status];
  return <Tag color={meta.color}>{meta.label}</Tag>;
}

function formatDate(value?: string | null) {
  if (!value) {
    return "-";
  }
  return new Date(value).toLocaleString("zh-CN", { hour12: false });
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

function toMoneyString(value?: number) {
  return value === undefined || value === null ? "0.00" : value.toFixed(2);
}

function specText(value: Record<string, unknown>) {
  return JSON.stringify(value || {}, null, 2);
}

function parseSpecText(value?: string) {
  if (!value?.trim()) {
    return {};
  }
  const parsed = JSON.parse(value);
  if (!parsed || Array.isArray(parsed) || typeof parsed !== "object") {
    throw new Error("规格必须是 JSON 对象");
  }
  return parsed as Record<string, unknown>;
}

export function ProductCatalogPage() {
  const { allowedCodes, permissionCodes } = useOutletContext<WorkspaceContext>();
  const canManage = permissionCodes.has("products.manage");
  const queryClient = useQueryClient();
  const { message } = AntdApp.useApp();
  const [categoryForm] = Form.useForm<CategoryFormValues>();
  const [productForm] = Form.useForm<ProductFormValues>();
  const [skuForm] = Form.useForm<SkuFormValues>();
  const [activeTab, setActiveTab] = useState<ActiveTab>("products");
  const [productDetailTab, setProductDetailTab] = useState<ProductDetailTab>("skus");
  const [selectedProductId, setSelectedProductId] = useState<number | null>(null);
  const [keyword, setKeyword] = useState("");
  const [action, setAction] = useState<CatalogAction | null>(null);

  const categoriesQuery = useQuery({
    queryKey: categoriesQueryKey,
    queryFn: productCatalogApi.listCategories,
  });
  const productsQuery = useQuery({
    queryKey: productsQueryKey,
    queryFn: productCatalogApi.listProducts,
  });
  const skusQuery = useQuery({
    queryKey: skusQueryKey,
    queryFn: productCatalogApi.listSkus,
  });

  const categories = useMemo(() => categoriesQuery.data ?? [], [categoriesQuery.data]);
  const products = useMemo(() => productsQuery.data ?? [], [productsQuery.data]);
  const skus = useMemo(() => skusQuery.data ?? [], [skusQuery.data]);
  const activeProductCount = products.filter((product) => product.status === "ACTIVE").length;
  const activeSkuCount = skus.filter((sku) => sku.status === "ACTIVE").length;
  const totalStock = skus.reduce((sum, sku) => sum + sku.stock, 0);
  const selectedProduct = products.find((product) => product.id === selectedProductId) || null;
  const selectedProductSkus = selectedProductId ? skus.filter((sku) => sku.product === selectedProductId) : [];

  const categoryOptions = categories.map((category) => ({ label: category.name, value: category.id }));
  const productOptions = products.map((product) => ({ label: product.title, value: product.id }));

  const filteredCategories = useMemo(
    () => filterRows(categories, keyword, (row) => [row.name, row.parent_name, row.status]),
    [categories, keyword],
  );
  const filteredProducts = useMemo(
    () => filterRows(products, keyword, (row) => [row.title, row.category_name, row.description, row.status]),
    [products, keyword],
  );
  const filteredSkus = useMemo(
    () => filterRows(skus, keyword, (row) => [row.sku_code, row.product_title, specText(row.spec_json), row.status]),
    [keyword, skus],
  );

  const refreshCatalog = () => {
    queryClient.invalidateQueries({ queryKey: categoriesQueryKey });
    queryClient.invalidateQueries({ queryKey: productsQueryKey });
    queryClient.invalidateQueries({ queryKey: skusQueryKey });
  };

  const closeAction = () => {
    setAction(null);
  };

  const openCreateSku = (productId?: number) => {
    skuForm.resetFields();
    skuForm.setFieldsValue({ product_id: productId, status: "ACTIVE", stock: 0, spec_json_text: "{}" });
    setAction({ type: "sku", mode: "create" });
  };

  const openCreate = (type: ActiveTab) => {
    if (type === "categories") {
      categoryForm.resetFields();
      categoryForm.setFieldsValue({ status: "ACTIVE", sort_order: 0 });
      setAction({ type: "category", mode: "create" });
    }
    if (type === "products") {
      productForm.resetFields();
      productForm.setFieldsValue({ status: "ACTIVE" });
      setAction({ type: "product", mode: "create" });
    }
    if (type === "skus") {
      openCreateSku();
    }
  };

  const openEdit = (nextAction: EditCatalogAction) => {
    setAction(nextAction);
    if (nextAction.type === "category") {
      categoryForm.setFieldsValue({
        parent_id: nextAction.record.parent,
        name: nextAction.record.name,
        sort_order: nextAction.record.sort_order,
        status: nextAction.record.status,
      });
    }
    if (nextAction.type === "product") {
      productForm.setFieldsValue({
        category_id: nextAction.record.category,
        title: nextAction.record.title,
        description: nextAction.record.description,
        status: nextAction.record.status,
        main_image_file_id: nextAction.record.main_image_file_id,
      });
    }
    if (nextAction.type === "sku") {
      skuForm.setFieldsValue({
        product_id: nextAction.record.product,
        sku_code: nextAction.record.sku_code,
        spec_json_text: specText(nextAction.record.spec_json),
        price: Number(nextAction.record.price),
        stock: nextAction.record.stock,
        status: nextAction.record.status,
      });
    }
  };

  const categoryMutation = useMutation({
    mutationFn: ({ id, payload }: { id?: number; payload: ProductCategoryPayload }) =>
      id ? productCatalogApi.updateCategory(id, payload) : productCatalogApi.createCategory(payload),
    onSuccess: () => {
      refreshCatalog();
      closeAction();
      message.success("分类已保存");
    },
    onError: (error) => message.error(getErrorMessage(error)),
  });

  const productMutation = useMutation({
    mutationFn: ({ id, payload }: { id?: number; payload: ProductPayload }) =>
      id ? productCatalogApi.updateProduct(id, payload) : productCatalogApi.createProduct(payload),
    onSuccess: () => {
      refreshCatalog();
      closeAction();
      message.success("商品已保存");
    },
    onError: (error) => message.error(getErrorMessage(error)),
  });

  const skuMutation = useMutation({
    mutationFn: ({ id, payload }: { id?: number; payload: ProductSkuPayload }) =>
      id ? productCatalogApi.updateSku(id, payload) : productCatalogApi.createSku(payload),
    onSuccess: () => {
      refreshCatalog();
      closeAction();
      message.success("SKU 已保存");
    },
    onError: (error) => message.error(getErrorMessage(error)),
  });

  const disableCategoryMutation = useMutation({
    mutationFn: productCatalogApi.disableCategory,
    onSuccess: () => {
      refreshCatalog();
      message.success("分类已停用");
    },
    onError: (error) => message.error(getErrorMessage(error)),
  });

  const disableProductMutation = useMutation({
    mutationFn: productCatalogApi.disableProduct,
    onSuccess: () => {
      refreshCatalog();
      message.success("商品已停用");
    },
    onError: (error) => message.error(getErrorMessage(error)),
  });

  const disableSkuMutation = useMutation({
    mutationFn: productCatalogApi.disableSku,
    onSuccess: () => {
      refreshCatalog();
      message.success("SKU 已停用");
    },
    onError: (error) => message.error(getErrorMessage(error)),
  });

  const submitCategory = (values: CategoryFormValues) => {
    const payload: ProductCategoryPayload = {
      parent_id: values.parent_id ?? null,
      name: String(values.name || "").trim(),
      sort_order: values.sort_order ?? 0,
      status: values.status || "ACTIVE",
    };
    categoryMutation.mutate({ id: action?.type === "category" ? action.record?.id : undefined, payload });
  };

  const submitProduct = (values: ProductFormValues) => {
    const payload: ProductPayload = {
      category_id: values.category_id ?? null,
      title: String(values.title || "").trim(),
      description: values.description?.trim() || "",
      status: values.status || "ACTIVE",
      main_image_file_id: values.main_image_file_id?.trim() || "",
    };
    productMutation.mutate({ id: action?.type === "product" ? action.record?.id : undefined, payload });
  };

  const submitSku = (values: SkuFormValues) => {
    try {
      const payload: ProductSkuPayload = {
        product_id: Number(values.product_id),
        sku_code: String(values.sku_code || "").trim(),
        spec_json: parseSpecText(values.spec_json_text),
        price: toMoneyString(values.price),
        stock: values.stock ?? 0,
        status: values.status || "ACTIVE",
      };
      skuMutation.mutate({ id: action?.type === "sku" ? action.record?.id : undefined, payload });
    } catch (error) {
      message.error(getErrorMessage(error));
    }
  };

  const categoryColumns: TableColumnsType<ProductCategory> = [
    { title: "分类", dataIndex: "name", width: 180, render: (value: string) => <Typography.Text strong>{value}</Typography.Text> },
    { title: "上级分类", dataIndex: "parent_name", width: 160, render: (value: string | null) => value || "-" },
    { title: "排序", dataIndex: "sort_order", width: 90 },
    { title: "状态", dataIndex: "status", width: 100, render: statusTag },
    { title: "更新时间", dataIndex: "updated_at", width: 180, render: formatDate },
    {
      title: "操作",
      width: 130,
      fixed: "right",
      render: (_, record) => (
        <Space size={4}>
          <Button size="small" title="编辑" icon={<EditOutlined />} disabled={!canManage} onClick={() => openEdit({ type: "category", mode: "edit", record })} />
          <Button
            size="small"
            danger
            title="停用"
            icon={<DeleteOutlined />}
            disabled={!canManage || record.status === "DISABLED"}
            onClick={() => disableCategoryMutation.mutate(record.id)}
          />
        </Space>
      ),
    },
  ];

  const productColumns: TableColumnsType<Product> = [
    { title: "商品", dataIndex: "title", width: 220, render: (value: string) => <Typography.Text strong>{value}</Typography.Text> },
    { title: "分类", dataIndex: "category_name", width: 150, render: (value: string | null) => value || "-" },
    { title: "SKU", dataIndex: "skus", width: 90, render: (value: ProductSku[]) => value.length },
    { title: "状态", dataIndex: "status", width: 100, render: statusTag },
    { title: "更新时间", dataIndex: "updated_at", width: 180, render: formatDate },
    {
      title: "操作",
      width: 130,
      fixed: "right",
      render: (_, record) => (
        <Space size={4}>
          <Button size="small" title="编辑" icon={<EditOutlined />} disabled={!canManage} onClick={() => openEdit({ type: "product", mode: "edit", record })} />
          <Button
            size="small"
            danger
            title="停用"
            icon={<DeleteOutlined />}
            disabled={!canManage || record.status === "DISABLED"}
            onClick={() => disableProductMutation.mutate(record.id)}
          />
        </Space>
      ),
    },
  ];

  const skuColumns: TableColumnsType<ProductSku> = [
    { title: "SKU 编码", dataIndex: "sku_code", width: 180, render: (value: string) => <Typography.Text copyable strong>{value}</Typography.Text> },
    { title: "商品", dataIndex: "product_title", width: 220 },
    {
      title: "规格",
      dataIndex: "spec_json",
      width: 180,
      render: (value: Record<string, unknown>) => Object.entries(value || {}).map(([key, item]) => `${key}:${String(item)}`).join(" / ") || "-",
    },
    { title: "价格", dataIndex: "price", width: 110, render: (value: string) => `CNY ${value}` },
    { title: "库存", dataIndex: "stock", width: 90 },
    { title: "状态", dataIndex: "status", width: 100, render: statusTag },
    {
      title: "操作",
      width: 130,
      fixed: "right",
      render: (_, record) => (
        <Space size={4}>
          <Button size="small" title="编辑" icon={<EditOutlined />} disabled={!canManage} onClick={() => openEdit({ type: "sku", mode: "edit", record })} />
          <Button
            size="small"
            danger
            title="停用"
            icon={<DeleteOutlined />}
            disabled={!canManage || record.status === "DISABLED"}
            onClick={() => disableSkuMutation.mutate(record.id)}
          />
        </Space>
      ),
    },
  ];

  if (!allowedCodes.has("products.view")) {
    return <ForbiddenPage />;
  }

  return (
    <Space orientation="vertical" size={16} className="workspace-page product-catalog-page">
      <div className="page-heading">
        <div>
          <Typography.Title level={2}>商品管理</Typography.Title>
          <Typography.Paragraph>维护代购商品、SKU 和分类基础资料。</Typography.Paragraph>
        </div>
        <Space wrap>
          <Button icon={<ReloadOutlined />} onClick={refreshCatalog}>刷新</Button>
          {canManage && (
            <Button type="primary" icon={<PlusOutlined />} onClick={() => openCreate(activeTab)}>
              新增
            </Button>
          )}
        </Space>
      </div>
      {!canManage && <Alert type="info" showIcon message="当前账号只读商品，缺少 products.manage。" />}

      <Row gutter={[16, 16]}>
        <Col xs={24} md={6}>
          <Card><Statistic title="启用商品" value={activeProductCount} suffix="个" /></Card>
        </Col>
        <Col xs={24} md={6}>
          <Card><Statistic title="启用 SKU" value={activeSkuCount} suffix="个" /></Card>
        </Col>
        <Col xs={24} md={6}>
          <Card><Statistic title="分类" value={categories.length} suffix="个" /></Card>
        </Col>
        <Col xs={24} md={6}>
          <Card><Statistic title="总库存" value={totalStock} suffix="件" /></Card>
        </Col>
      </Row>

      <Card>
        <Space orientation="vertical" size={16} className="catalog-workspace">
          <Tabs
            activeKey={activeTab}
            onChange={(key) => setActiveTab(key as ActiveTab)}
            items={[
              { key: "products", label: `商品 ${products.length}` },
              { key: "skus", label: `SKU ${skus.length}` },
              { key: "categories", label: `分类 ${categories.length}` },
            ]}
          />
          {(categoriesQuery.error || productsQuery.error || skusQuery.error) && (
            <Alert type="error" showIcon title={getErrorMessage(categoriesQuery.error || productsQuery.error || skusQuery.error)} />
          )}
          <div className="filter-bar">
            <Input
              allowClear
              prefix={<SearchOutlined />}
              placeholder="搜索商品、SKU、分类或状态"
              value={keyword}
              onChange={(event) => setKeyword(event.target.value)}
            />
          </div>
          {activeTab === "products" && (
            <Table
              rowKey="id"
              loading={productsQuery.isLoading}
              dataSource={filteredProducts}
              columns={productColumns}
              rowSelection={{
                type: "radio",
                selectedRowKeys: selectedProductId ? [selectedProductId] : [],
                onChange: (keys) => setSelectedProductId(Number(keys[0])),
              }}
              onRow={(record) => ({
                onClick: () => setSelectedProductId(record.id),
              })}
              pagination={{ pageSize: 10, showSizeChanger: true }}
              scroll={{ x: 990 }}
              locale={{ emptyText: <Empty description="暂无商品" /> }}
            />
          )}
          {activeTab === "skus" && (
            <Table
              rowKey="id"
              loading={skusQuery.isLoading}
              dataSource={filteredSkus}
              columns={skuColumns}
              pagination={{ pageSize: 10, showSizeChanger: true }}
              scroll={{ x: 1110 }}
              locale={{ emptyText: <Empty description="暂无 SKU" /> }}
            />
          )}
          {activeTab === "categories" && (
            <Table
              rowKey="id"
              loading={categoriesQuery.isLoading}
              dataSource={filteredCategories}
              columns={categoryColumns}
              pagination={{ pageSize: 10, showSizeChanger: true }}
              scroll={{ x: 840 }}
              locale={{ emptyText: <Empty description="暂无分类" /> }}
            />
          )}
        </Space>
      </Card>

      {selectedProduct && (
        <Card
          title={`商品扩展资料：${selectedProduct.title}`}
          extra={<Typography.Text type="secondary">选择商品后维护 SKU、翻译和属性</Typography.Text>}
        >
          <Tabs
            activeKey={productDetailTab}
            onChange={(key) => setProductDetailTab(key as ProductDetailTab)}
            items={[
              {
                key: "skus",
                label: `SKU 管理 ${selectedProductSkus.length}`,
                children: (
                  <Space orientation="vertical" size={12} className="full-width-input">
                    <Space className="full-width-input" style={{ justifyContent: "space-between" }}>
                      <Typography.Text type="secondary">维护当前商品的 SKU 价格、库存和规格。</Typography.Text>
                      {canManage && (
                        <Button
                          type="primary"
                          size="small"
                          icon={<PlusOutlined />}
                          onClick={() => openCreateSku(selectedProduct.id)}
                        >
                          新增 SKU
                        </Button>
                      )}
                    </Space>
                    <Table
                      rowKey="id"
                      size="small"
                      loading={skusQuery.isLoading}
                      dataSource={selectedProductSkus}
                      columns={skuColumns}
                      pagination={false}
                      scroll={{ x: 1110 }}
                      locale={{ emptyText: <Empty description="当前商品暂无 SKU" /> }}
                    />
                  </Space>
                ),
              },
              {
                key: "translations",
                label: "多语言翻译",
                children: <ProductTranslationsPanel productId={selectedProduct.id} canManage={canManage} />,
              },
              {
                key: "attributes",
                label: "商品属性",
                children: (
                  <ProductAttributesPanel
                    productId={selectedProduct.id}
                    categories={categories}
                    canManage={canManage}
                  />
                ),
              },
            ]}
          />
        </Card>
      )}

      <Modal
        title={action?.type === "category" ? "分类" : action?.type === "product" ? "商品" : "SKU"}
        open={Boolean(action)}
        onCancel={closeAction}
        destroyOnHidden
        footer={null}
      >
        {action?.type === "category" && (
          <Form form={categoryForm} layout="vertical" onFinish={submitCategory}>
            <Form.Item name="name" label="分类名称" rules={[{ required: true, message: "请输入分类名称" }]}>
              <Input />
            </Form.Item>
            <Form.Item name="parent_id" label="上级分类">
              <Select allowClear options={categoryOptions.filter((item) => item.value !== action.record?.id)} />
            </Form.Item>
            <Row gutter={12}>
              <Col span={12}>
                <Form.Item name="sort_order" label="排序"><InputNumber min={0} precision={0} className="full-width-input" /></Form.Item>
              </Col>
              <Col span={12}>
                <Form.Item name="status" label="状态"><Select options={[{ label: "启用", value: "ACTIVE" }, { label: "停用", value: "DISABLED" }]} /></Form.Item>
              </Col>
            </Row>
            <Button type="primary" htmlType="submit" block loading={categoryMutation.isPending}>保存</Button>
          </Form>
        )}

        {action?.type === "product" && (
          <Form form={productForm} layout="vertical" onFinish={submitProduct}>
            <Form.Item name="title" label="商品名称" rules={[{ required: true, message: "请输入商品名称" }]}>
              <Input />
            </Form.Item>
            <Form.Item name="category_id" label="分类">
              <Select allowClear options={categoryOptions} />
            </Form.Item>
            <Form.Item name="description" label="商品描述">
              <Input.TextArea rows={3} />
            </Form.Item>
            <Form.Item name="main_image_file_id" label="主图 file_id">
              <Input />
            </Form.Item>
            <Form.Item name="status" label="状态">
              <Select options={[{ label: "启用", value: "ACTIVE" }, { label: "停用", value: "DISABLED" }]} />
            </Form.Item>
            <Button type="primary" htmlType="submit" block loading={productMutation.isPending}>保存</Button>
          </Form>
        )}

        {action?.type === "sku" && (
          <Form form={skuForm} layout="vertical" onFinish={submitSku}>
            <Form.Item name="product_id" label="商品" rules={[{ required: true, message: "请选择商品" }]}>
              <Select showSearch optionFilterProp="label" options={productOptions} />
            </Form.Item>
            <Form.Item name="sku_code" label="SKU 编码" rules={[{ required: true, message: "请输入 SKU 编码" }]}>
              <Input />
            </Form.Item>
            <Row gutter={12}>
              <Col span={12}>
                <Form.Item name="price" label="价格" rules={[{ required: true, message: "请输入价格" }]}>
                  <InputNumber min={0} precision={2} className="full-width-input" />
                </Form.Item>
              </Col>
              <Col span={12}>
                <Form.Item name="stock" label="库存">
                  <InputNumber min={0} precision={0} className="full-width-input" />
                </Form.Item>
              </Col>
            </Row>
            <Form.Item name="spec_json_text" label="规格 JSON">
              <Input.TextArea rows={4} />
            </Form.Item>
            <Form.Item name="status" label="状态">
              <Select options={[{ label: "启用", value: "ACTIVE" }, { label: "停用", value: "DISABLED" }]} />
            </Form.Item>
            <Button type="primary" htmlType="submit" block loading={skuMutation.isPending}>保存</Button>
          </Form>
        )}
      </Modal>
    </Space>
  );
}
