import { DeleteOutlined, EditOutlined, PlusOutlined } from "@ant-design/icons";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  App as AntdApp,
  Button,
  Empty,
  Form,
  Input,
  Modal,
  Popconfirm,
  Select,
  Space,
  Table,
  Typography,
} from "antd";
import type { TableColumnsType } from "antd";
import { useState } from "react";

import {
  createProductTranslation,
  deleteProductTranslation,
  fetchProductTranslations,
  updateProductTranslation,
} from "./api";
import type { ProductTranslation, ProductTranslationPayload } from "./types";

type TranslationFormValues = {
  language_code?: string;
  title?: string;
  description_rich?: string;
};

type ProductTranslationsPanelProps = {
  productId: number;
  canManage: boolean;
};

const languageOptions = [
  { label: "简体中文（zh-CN）", value: "zh-CN" },
  { label: "英语（en）", value: "en" },
  { label: "日语（ja）", value: "ja" },
  { label: "韩语（ko）", value: "ko" },
  { label: "德语（de）", value: "de" },
  { label: "法语（fr）", value: "fr" },
];

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : "请求失败";
}

export function ProductTranslationsPanel({ productId, canManage }: ProductTranslationsPanelProps) {
  const [form] = Form.useForm<TranslationFormValues>();
  const { message } = AntdApp.useApp();
  const queryClient = useQueryClient();
  const [editingTranslation, setEditingTranslation] = useState<ProductTranslation | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const queryKey = ["admin-products", productId, "translations"] as const;

  const translationsQuery = useQuery({
    queryKey,
    queryFn: () => fetchProductTranslations(productId),
    enabled: Boolean(productId),
  });

  const saveMutation = useMutation({
    mutationFn: (payload: ProductTranslationPayload) =>
      editingTranslation
        ? updateProductTranslation(productId, editingTranslation.id, payload)
        : createProductTranslation(productId, payload),
    onSuccess: () => {
      message.success(editingTranslation ? "翻译已更新" : "翻译已新增");
      setModalOpen(false);
      setEditingTranslation(null);
      form.resetFields();
      queryClient.invalidateQueries({ queryKey });
    },
    onError: (error) => message.error(getErrorMessage(error)),
  });

  const deleteMutation = useMutation({
    mutationFn: (translationId: number) => deleteProductTranslation(productId, translationId),
    onSuccess: () => {
      message.success("翻译已删除");
      queryClient.invalidateQueries({ queryKey });
    },
    onError: (error) => message.error(getErrorMessage(error)),
  });

  const openCreate = () => {
    setEditingTranslation(null);
    form.resetFields();
    form.setFieldsValue({ language_code: "en", description_rich: "" });
    setModalOpen(true);
  };

  const openEdit = (record: ProductTranslation) => {
    setEditingTranslation(record);
    form.setFieldsValue({
      language_code: record.language_code,
      title: record.title,
      description_rich: record.description_rich,
    });
    setModalOpen(true);
  };

  const submitForm = (values: TranslationFormValues) => {
    saveMutation.mutate({
      language_code: String(values.language_code || "").trim(),
      title: String(values.title || "").trim(),
      description_rich: values.description_rich?.trim() || "",
    });
  };

  const columns: TableColumnsType<ProductTranslation> = [
    {
      title: "语言",
      dataIndex: "language_code",
      width: 130,
      render: (value: string) => <Typography.Text strong>{value}</Typography.Text>,
    },
    { title: "标题", dataIndex: "title", width: 220 },
    {
      title: "富文本描述",
      dataIndex: "description_rich",
      ellipsis: true,
      render: (value: string) => value || "-",
    },
    {
      title: "操作",
      width: 150,
      fixed: "right",
      render: (_, record) =>
        canManage ? (
          <Space size={4}>
            <Button size="small" title="编辑" icon={<EditOutlined />} onClick={() => openEdit(record)} />
            <Popconfirm
              title="确认删除该翻译？"
              okText="删除"
              cancelText="取消"
              okButtonProps={{ danger: true, loading: deleteMutation.isPending }}
              onConfirm={() => deleteMutation.mutate(record.id)}
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
    <Space orientation="vertical" size={12} className="full-width-input">
      <Space className="full-width-input" style={{ justifyContent: "space-between" }}>
        <Typography.Text type="secondary">维护当前商品在不同语言站点展示的标题和富文本描述。</Typography.Text>
        {canManage && (
          <Button type="primary" size="small" icon={<PlusOutlined />} onClick={openCreate}>
            新增翻译
          </Button>
        )}
      </Space>
      <Table
        rowKey="id"
        size="small"
        loading={translationsQuery.isLoading}
        dataSource={translationsQuery.data ?? []}
        columns={columns}
        pagination={false}
        scroll={{ x: 760 }}
        locale={{ emptyText: <Empty description="暂无翻译" /> }}
      />

      <Modal
        title={editingTranslation ? "编辑翻译" : "新增翻译"}
        open={modalOpen}
        onCancel={() => setModalOpen(false)}
        destroyOnHidden
        footer={null}
      >
        <Form form={form} layout="vertical" onFinish={submitForm}>
          <Form.Item name="language_code" label="语言" rules={[{ required: true, message: "请选择语言" }]}>
            <Select options={languageOptions} disabled={Boolean(editingTranslation)} />
          </Form.Item>
          <Form.Item name="title" label="标题" rules={[{ required: true, message: "请输入标题" }]}>
            <Input />
          </Form.Item>
          <Form.Item name="description_rich" label="富文本描述">
            <Input.TextArea rows={6} />
          </Form.Item>
          <Button type="primary" htmlType="submit" block loading={saveMutation.isPending}>
            保存
          </Button>
        </Form>
      </Modal>
    </Space>
  );
}
