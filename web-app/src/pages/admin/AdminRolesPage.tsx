import { useCallback, useEffect, useMemo, useState } from "react";
import { Button, Card, Form, Input, Modal, Popconfirm, Select, Space, Table, Tag, Typography, message } from "antd";
import type { ColumnsType } from "antd/es/table";
import { DeleteOutlined, EditOutlined, PlusOutlined, ReloadOutlined } from "@ant-design/icons";
import { adminIam } from "@crossborder-erp/api-client";
import type { AdminPermission, AdminRole } from "@crossborder-erp/api-client";
import { adminClient } from "../../api/client";

const { Text, Title } = Typography;

type RoleForm = {
  code?: string;
  name: string;
  description?: string;
  permission_codes: string[];
};

function groupPermissions(permissions: AdminPermission[]) {
  const groups = new Map<string, AdminPermission[]>();
  for (const permission of permissions) {
    const key = permission.resource || "other";
    groups.set(key, [...(groups.get(key) ?? []), permission]);
  }
  return Array.from(groups.entries()).map(([label, options]) => ({
    label,
    options: options.map((permission) => ({
      value: permission.code,
      label: `${permission.name} / ${permission.code}`,
    })),
  }));
}

export function AdminRolesPage() {
  const [roles, setRoles] = useState<AdminRole[]>([]);
  const [permissions, setPermissions] = useState<AdminPermission[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<AdminRole | null>(null);
  const [form] = Form.useForm<RoleForm>();
  const [messageApi, contextHolder] = message.useMessage();

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [roleItems, permissionItems] = await Promise.all([
        adminIam.listRoles(adminClient),
        adminIam.listPermissions(adminClient),
      ]);
      setRoles(roleItems);
      setPermissions(permissionItems);
    } catch (error) {
      messageApi.error(error instanceof Error ? error.message : "角色权限加载失败");
    } finally {
      setLoading(false);
    }
  }, [messageApi]);

  useEffect(() => {
    void Promise.resolve().then(loadData);
  }, [loadData]);

  const permissionOptions = useMemo(() => groupPermissions(permissions), [permissions]);

  const openCreate = () => {
    setEditing(null);
    form.setFieldsValue({ permission_codes: [] });
    setModalOpen(true);
  };

  const openEdit = (role: AdminRole) => {
    setEditing(role);
    form.setFieldsValue({
      code: role.code,
      name: role.name,
      description: role.description,
      permission_codes: role.permission_codes,
    });
    setModalOpen(true);
  };

  const closeModal = () => {
    setModalOpen(false);
    setEditing(null);
    form.resetFields();
  };

  const submit = async (values: RoleForm) => {
    setSaving(true);
    try {
      if (editing) {
        await adminIam.updateRole(adminClient, editing.id, {
          name: values.name,
          description: values.description ?? "",
          permission_codes: values.permission_codes,
        });
        messageApi.success("角色已更新");
      } else {
        await adminIam.createRole(adminClient, {
          code: values.code,
          name: values.name,
          description: values.description ?? "",
          permission_codes: values.permission_codes,
        });
        messageApi.success("角色已创建");
      }
      closeModal();
      await loadData();
    } catch (error) {
      messageApi.error(error instanceof Error ? error.message : "角色保存失败");
    } finally {
      setSaving(false);
    }
  };

  const remove = async (role: AdminRole) => {
    try {
      await adminIam.deleteRole(adminClient, role.id);
      messageApi.success("角色已删除");
      await loadData();
    } catch (error) {
      messageApi.error(error instanceof Error ? error.message : "角色删除失败");
    }
  };

  const columns: ColumnsType<AdminRole> = [
    {
      title: "角色",
      render: (_, role) => (
        <Space orientation="vertical" size={2}>
          <Text strong>{role.name}</Text>
          <Text type="secondary">{role.code}</Text>
        </Space>
      ),
    },
    { title: "说明", dataIndex: "description" },
    {
      title: "权限数",
      render: (_, role) => <Tag color="blue">{role.permission_codes.length}</Tag>,
    },
    {
      title: "操作",
      width: 180,
      render: (_, role) => (
        <Space>
          <Button icon={<EditOutlined />} onClick={() => openEdit(role)} disabled={role.code === "super_admin"}>
            编辑
          </Button>
          <Popconfirm title="确认删除这个角色？" onConfirm={() => remove(role)}>
            <Button danger icon={<DeleteOutlined />} disabled={role.code === "super_admin"}>
              删除
            </Button>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  return (
    <div>
      {contextHolder}
      <Space style={{ width: "100%", justifyContent: "space-between", marginBottom: 16 }} wrap>
        <Title level={4} style={{ margin: 0 }}>
          角色权限
        </Title>
        <Space>
          <Button icon={<ReloadOutlined />} onClick={() => loadData()} loading={loading}>
            刷新
          </Button>
          <Button type="primary" icon={<PlusOutlined />} onClick={openCreate}>
            新增角色
          </Button>
        </Space>
      </Space>
      <Card style={{ borderRadius: "var(--radius-card)" }}>
        <Table<AdminRole>
          rowKey="id"
          loading={loading}
          dataSource={roles}
          columns={columns}
          pagination={false}
          expandable={{
            expandedRowRender: (role) => (
              <Space wrap>
                {role.permission_codes.map((code) => (
                  <Tag key={code}>{code}</Tag>
                ))}
              </Space>
            ),
          }}
        />
      </Card>
      <Modal
        title={editing ? "编辑角色" : "新增角色"}
        open={modalOpen}
        onCancel={closeModal}
        onOk={() => form.submit()}
        confirmLoading={saving}
        destroyOnHidden
        forceRender
      >
        <Form form={form} layout="vertical" onFinish={submit}>
          <Form.Item
            name="code"
            label="角色编码"
            rules={editing ? [] : [{ required: true, message: "请输入角色编码" }]}
          >
            <Input disabled={Boolean(editing)} placeholder="ops_custom" />
          </Form.Item>
          <Form.Item name="name" label="角色名称" rules={[{ required: true, message: "请输入角色名称" }]}>
            <Input />
          </Form.Item>
          <Form.Item name="description" label="说明">
            <Input.TextArea rows={3} />
          </Form.Item>
          <Form.Item
            name="permission_codes"
            label="权限"
            rules={[{ required: true, message: "请选择至少一个权限" }]}
          >
            <Select mode="multiple" allowClear options={permissionOptions} showSearch optionFilterProp="label" />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}
