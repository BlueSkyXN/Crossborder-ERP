import { DeleteOutlined, EditOutlined, PlusOutlined } from "@ant-design/icons";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  App as AntdApp,
  Button,
  Card,
  Empty,
  Form,
  Input,
  InputNumber,
  Popconfirm,
  Modal,
  Select,
  Space,
  Switch,
  Table,
  Tag,
  Typography,
} from "antd";
import type { TableColumnsType } from "antd";
import { useMemo, useState } from "react";

import {
  createProductAttribute,
  deleteProductAttribute,
  deleteProductAttrValue,
  fetchProductAttributes,
  fetchProductAttrValues,
  setProductAttrValue,
  updateProductAttribute,
} from "./api";
import type {
  ProductAttribute,
  ProductAttributePayload,
  ProductAttributeType,
  ProductAttributeValue,
  ProductAttributeValuePayload,
  ProductCategory,
} from "./types";

type ProductAttributesPanelProps = {
  productId?: number;
  categories: ProductCategory[];
  canManage: boolean;
};

type AttributeFormValues = {
  name?: string;
  type?: ProductAttributeType | string;
  category_id?: number | null;
  is_filterable?: boolean;
  sort_order?: number;
  is_active?: boolean;
};

type AttributeValueFormValues = {
  attribute_id?: number;
  value?: string;
  sort_order?: number;
};

const attributeTypeOptions = [
  { label: "文本", value: "TEXT" },
  { label: "数字", value: "NUMBER" },
  { label: "布尔", value: "BOOLEAN" },
  { label: "枚举", value: "ENUM" },
];

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : "请求失败";
}

function renderBool(value: boolean) {
  return value ? <Tag color="green">是</Tag> : <Tag>否</Tag>;
}

export function ProductAttributesPanel({ productId, categories, canManage }: ProductAttributesPanelProps) {
  const [attributeForm] = Form.useForm<AttributeFormValues>();
  const [valueForm] = Form.useForm<AttributeValueFormValues>();
  const { message } = AntdApp.useApp();
  const queryClient = useQueryClient();
  const [editingAttribute, setEditingAttribute] = useState<ProductAttribute | null>(null);
  const [editingValue, setEditingValue] = useState<ProductAttributeValue | null>(null);
  const [attributeModalOpen, setAttributeModalOpen] = useState(false);
  const [valueModalOpen, setValueModalOpen] = useState(false);

  const attributesQueryKey = ["admin-product-attributes"] as const;
  const valuesQueryKey = ["admin-products", productId, "attribute-values"] as const;

  const attributesQuery = useQuery({
    queryKey: attributesQueryKey,
    queryFn: () => fetchProductAttributes(),
  });

  const valuesQuery = useQuery({
    queryKey: valuesQueryKey,
    queryFn: () => fetchProductAttrValues(Number(productId)),
    enabled: Boolean(productId),
  });

  const attributes = useMemo(() => attributesQuery.data ?? [], [attributesQuery.data]);
  const categoryOptions = categories.map((category) => ({ label: category.name, value: category.id }));
  const attributeOptions = attributes.map((attribute) => ({ label: attribute.name, value: attribute.id }));

  const saveAttributeMutation = useMutation({
    mutationFn: (payload: ProductAttributePayload) =>
      editingAttribute ? updateProductAttribute(editingAttribute.id, payload) : createProductAttribute(payload),
    onSuccess: () => {
      message.success(editingAttribute ? "属性定义已更新" : "属性定义已新增");
      setAttributeModalOpen(false);
      setEditingAttribute(null);
      attributeForm.resetFields();
      queryClient.invalidateQueries({ queryKey: attributesQueryKey });
    },
    onError: (error) => message.error(getErrorMessage(error)),
  });

  const deleteAttributeMutation = useMutation({
    mutationFn: deleteProductAttribute,
    onSuccess: () => {
      message.success("属性定义已删除");
      queryClient.invalidateQueries({ queryKey: attributesQueryKey });
    },
    onError: (error) => message.error(getErrorMessage(error)),
  });

  const saveValueMutation = useMutation({
    mutationFn: (payload: ProductAttributeValuePayload) => setProductAttrValue(Number(productId), payload),
    onSuccess: () => {
      message.success(editingValue ? "属性值已更新" : "属性值已保存");
      setValueModalOpen(false);
      setEditingValue(null);
      valueForm.resetFields();
      queryClient.invalidateQueries({ queryKey: valuesQueryKey });
    },
    onError: (error) => message.error(getErrorMessage(error)),
  });

  const deleteValueMutation = useMutation({
    mutationFn: (valueId: number) => deleteProductAttrValue(Number(productId), valueId),
    onSuccess: () => {
      message.success("属性值已删除");
      queryClient.invalidateQueries({ queryKey: valuesQueryKey });
    },
    onError: (error) => message.error(getErrorMessage(error)),
  });

  const openCreateAttribute = () => {
    setEditingAttribute(null);
    attributeForm.resetFields();
    attributeForm.setFieldsValue({
      type: "TEXT",
      category_id: null,
      is_filterable: false,
      sort_order: 0,
      is_active: true,
    });
    setAttributeModalOpen(true);
  };

  const openEditAttribute = (record: ProductAttribute) => {
    setEditingAttribute(record);
    attributeForm.setFieldsValue({
      name: record.name,
      type: record.attr_type,
      category_id: record.category ?? null,
      is_filterable: record.is_filterable,
      sort_order: record.sort_order,
      is_active: record.is_active,
    });
    setAttributeModalOpen(true);
  };

  const openCreateValue = () => {
    setEditingValue(null);
    valueForm.resetFields();
    valueForm.setFieldsValue({ value: "", sort_order: 0 });
    setValueModalOpen(true);
  };

  const openEditValue = (record: ProductAttributeValue) => {
    setEditingValue(record);
    valueForm.setFieldsValue({
      attribute_id: record.attribute,
      value: record.value,
      sort_order: record.sort_order,
    });
    setValueModalOpen(true);
  };

  const submitAttribute = (values: AttributeFormValues) => {
    saveAttributeMutation.mutate({
      name: String(values.name || "").trim(),
      attr_type: values.type || "TEXT",
      category_id: values.category_id ?? null,
      is_filterable: Boolean(values.is_filterable),
      sort_order: values.sort_order ?? 0,
      is_active: values.is_active ?? true,
    });
  };

  const submitValue = (values: AttributeValueFormValues) => {
    saveValueMutation.mutate({
      attribute_id: Number(values.attribute_id),
      value: values.value?.trim() || "",
      sort_order: values.sort_order ?? 0,
    });
  };

  const attributeColumns: TableColumnsType<ProductAttribute> = [
    { title: "属性名称", dataIndex: "name", width: 180, render: (value: string) => <Typography.Text strong>{value}</Typography.Text> },
    { title: "类型", dataIndex: "attr_type", width: 120 },
    {
      title: "分类范围",
      width: 180,
      render: (_, record) => record.category_name || categories.find((category) => category.id === record.category)?.name || "全部分类",
    },
    { title: "可筛选", dataIndex: "is_filterable", width: 100, render: renderBool },
    { title: "排序", dataIndex: "sort_order", width: 90 },
    { title: "启用", dataIndex: "is_active", width: 90, render: renderBool },
    {
      title: "操作",
      width: 150,
      fixed: "right",
      render: (_, record) =>
        canManage ? (
          <Space size={4}>
            <Button size="small" title="编辑" icon={<EditOutlined />} onClick={() => openEditAttribute(record)} />
            <Popconfirm
              title="确认删除该属性定义？"
              okText="删除"
              cancelText="取消"
              okButtonProps={{ danger: true, loading: deleteAttributeMutation.isPending }}
              onConfirm={() => deleteAttributeMutation.mutate(record.id)}
            >
              <Button size="small" danger title="删除" icon={<DeleteOutlined />} />
            </Popconfirm>
          </Space>
        ) : (
          "-"
        ),
    },
  ];

  const valueColumns: TableColumnsType<ProductAttributeValue> = [
    {
      title: "属性",
      width: 180,
      render: (_, record) => record.attribute_name || attributes.find((attribute) => attribute.id === record.attribute)?.name || record.attribute,
    },
    { title: "属性值", dataIndex: "value", render: (value: string) => value || "-" },
    { title: "排序", dataIndex: "sort_order", width: 90 },
    {
      title: "操作",
      width: 150,
      fixed: "right",
      render: (_, record) =>
        canManage ? (
          <Space size={4}>
            <Button size="small" title="编辑" icon={<EditOutlined />} onClick={() => openEditValue(record)} />
            <Popconfirm
              title="确认删除该属性值？"
              okText="删除"
              cancelText="取消"
              okButtonProps={{ danger: true, loading: deleteValueMutation.isPending }}
              onConfirm={() => deleteValueMutation.mutate(record.id)}
            >
              <Button size="small" danger title="删除" icon={<DeleteOutlined />} />
            </Popconfirm>
          </Space>
        ) : (
          "-"
        ),
    },
  ];

  return (
    <Space orientation="vertical" size={16} className="full-width-input">
      <Card
        size="small"
        title="属性定义"
        extra={
          canManage && (
            <Button type="primary" size="small" icon={<PlusOutlined />} onClick={openCreateAttribute}>
              新增属性
            </Button>
          )
        }
      >
        <Table
          rowKey="id"
          size="small"
          loading={attributesQuery.isLoading}
          dataSource={attributes}
          columns={attributeColumns}
          pagination={{ pageSize: 5 }}
          scroll={{ x: 920 }}
          locale={{ emptyText: <Empty description="暂无属性定义" /> }}
        />
      </Card>

      <Card
        size="small"
        title="当前商品属性值"
        extra={
          canManage && productId && (
            <Button type="primary" size="small" icon={<PlusOutlined />} onClick={openCreateValue}>
              新增属性值
            </Button>
          )
        }
      >
        {productId ? (
          <Table
            rowKey="id"
            size="small"
            loading={valuesQuery.isLoading}
            dataSource={valuesQuery.data ?? []}
            columns={valueColumns}
            pagination={false}
            scroll={{ x: 700 }}
            locale={{ emptyText: <Empty description="暂无属性值" /> }}
          />
        ) : (
          <Empty description="请选择商品后维护属性值" />
        )}
      </Card>

      <Modal
        title={editingAttribute ? "编辑属性定义" : "新增属性定义"}
        open={attributeModalOpen}
        onCancel={() => setAttributeModalOpen(false)}
        destroyOnHidden
        footer={null}
      >
        <Form form={attributeForm} layout="vertical" onFinish={submitAttribute}>
          <Form.Item name="name" label="属性名称" rules={[{ required: true, message: "请输入属性名称" }]}>
            <Input />
          </Form.Item>
          <Form.Item name="type" label="类型" rules={[{ required: true, message: "请选择类型" }]}>
            <Select options={attributeTypeOptions} />
          </Form.Item>
          <Form.Item name="category_id" label="分类范围">
            <Select allowClear options={categoryOptions} placeholder="不选择表示全部分类" />
          </Form.Item>
          <Space size={24}>
            <Form.Item name="is_filterable" label="可筛选" valuePropName="checked">
              <Switch />
            </Form.Item>
            <Form.Item name="is_active" label="启用" valuePropName="checked">
              <Switch />
            </Form.Item>
          </Space>
          <Form.Item name="sort_order" label="排序">
            <InputNumber min={0} precision={0} className="full-width-input" />
          </Form.Item>
          <Button type="primary" htmlType="submit" block loading={saveAttributeMutation.isPending}>
            保存
          </Button>
        </Form>
      </Modal>

      <Modal
        title={editingValue ? "编辑属性值" : "新增属性值"}
        open={valueModalOpen}
        onCancel={() => setValueModalOpen(false)}
        destroyOnHidden
        footer={null}
      >
        <Form form={valueForm} layout="vertical" onFinish={submitValue}>
          <Form.Item name="attribute_id" label="属性" rules={[{ required: true, message: "请选择属性" }]}>
            <Select showSearch optionFilterProp="label" options={attributeOptions} disabled={Boolean(editingValue)} />
          </Form.Item>
          <Form.Item name="value" label="文本值">
            <Input />
          </Form.Item>
          <Form.Item name="sort_order" label="排序">
            <InputNumber min={0} precision={0} className="full-width-input" />
          </Form.Item>
          <Button type="primary" htmlType="submit" block loading={saveValueMutation.isPending}>
            保存
          </Button>
        </Form>
      </Modal>
    </Space>
  );
}
