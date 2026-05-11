import { useCallback, useEffect, useMemo, useState } from "react";
import { Button, Card, Form, Input, Modal, Popconfirm, Select, Space, Table, Tag, Typography, message } from "antd";
import type { ColumnsType } from "antd/es/table";
import { DeleteOutlined, EditOutlined, PlusOutlined, ReloadOutlined } from "@ant-design/icons";
import { adminIam } from "@crossborder-erp/api-client";
import type { AdminAccount, AdminRole } from "@crossborder-erp/api-client";
import { adminClient } from "../../api/client";
import { useAdminAuthStore } from "../../stores/auth";

const { Text, Title } = Typography;

type AdminUserForm = {
  email?: string;
  name: string;
  password?: string;
  status: string;
  role_codes: string[];
};

const statusColors: Record<string, string> = {
  ACTIVE: "green",
  DISABLED: "red",
};

export function AdminAdminUsersPage() {
  const currentAdmin = useAdminAuthStore((state) => state.admin);
  const [accounts, setAccounts] = useState<AdminAccount[]>([]);
  const [roles, setRoles] = useState<AdminRole[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<AdminAccount | null>(null);
  const [form] = Form.useForm<AdminUserForm>();
  const [messageApi, contextHolder] = message.useMessage();

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [accountItems, roleItems] = await Promise.all([
        adminIam.listAdminAccounts(adminClient),
        adminIam.listRoles(adminClient),
      ]);
      setAccounts(accountItems);
      setRoles(roleItems);
    } catch (error) {
      messageApi.error(error instanceof Error ? error.message : "管理员账号加载失败");
    } finally {
      setLoading(false);
    }
  }, [messageApi]);

  useEffect(() => {
    void Promise.resolve().then(loadData);
  }, [loadData]);

  const assignableRoles = useMemo(() => roles.filter((role) => role.code !== "super_admin"), [roles]);
  const roleOptions = useMemo(
    () => assignableRoles.map((role) => ({ value: role.code, label: `${role.name} / ${role.code}` })),
    [assignableRoles],
  );

  const openCreate = () => {
    setEditing(null);
    form.setFieldsValue({
      status: "ACTIVE",
      role_codes: assignableRoles[0] ? [assignableRoles[0].code] : [],
    });
    setModalOpen(true);
  };

  const openEdit = (account: AdminAccount) => {
    setEditing(account);
    form.setFieldsValue({
      email: account.email,
      name: account.name,
      status: account.status,
      role_codes: account.roles.filter((code) => code !== "super_admin"),
      password: "",
    });
    setModalOpen(true);
  };

  const closeModal = () => {
    setModalOpen(false);
    setEditing(null);
    form.resetFields();
  };

  const submit = async (values: AdminUserForm) => {
    setSaving(true);
    try {
      const payload = {
        name: values.name,
        status: values.status,
        role_codes: values.role_codes,
        ...(values.password ? { password: values.password } : {}),
      };
      if (editing) {
        await adminIam.updateAdminAccount(adminClient, editing.id, payload);
        messageApi.success("管理员账号已更新");
      } else {
        await adminIam.createAdminAccount(adminClient, {
          ...payload,
          email: values.email,
          password: values.password,
        });
        messageApi.success("管理员账号已创建");
      }
      closeModal();
      await loadData();
    } catch (error) {
      messageApi.error(error instanceof Error ? error.message : "管理员账号保存失败");
    } finally {
      setSaving(false);
    }
  };

  const remove = async (account: AdminAccount) => {
    try {
      await adminIam.deleteAdminAccount(adminClient, account.id);
      messageApi.success("管理员账号已删除");
      await loadData();
    } catch (error) {
      messageApi.error(error instanceof Error ? error.message : "管理员账号删除失败");
    }
  };

  const columns: ColumnsType<AdminAccount> = [
    {
      title: "账号",
      render: (_, account) => (
        <Space orientation="vertical" size={2}>
          <Text strong>{account.name}</Text>
          <Text type="secondary">{account.email}</Text>
        </Space>
      ),
    },
    {
      title: "状态",
      dataIndex: "status",
      render: (status: string) => <Tag color={statusColors[status] ?? "default"}>{status}</Tag>,
    },
    {
      title: "角色",
      render: (_, account) => (
        <Space wrap>
          {account.roles.map((code) => (
            <Tag key={code} color={code === "super_admin" ? "gold" : "blue"}>
              {code}
            </Tag>
          ))}
        </Space>
      ),
    },
    { title: "最后登录", dataIndex: "last_login_at" },
    { title: "创建时间", dataIndex: "created_at" },
    {
      title: "操作",
      width: 180,
      render: (_, account) => {
        const protectedAccount = account.is_super_admin || String(account.id) === String(currentAdmin?.id);
        return (
          <Space>
            <Button icon={<EditOutlined />} onClick={() => openEdit(account)} disabled={account.is_super_admin}>
              编辑
            </Button>
            <Popconfirm title="确认删除这个管理员账号？" onConfirm={() => remove(account)}>
              <Button danger icon={<DeleteOutlined />} disabled={protectedAccount}>
                删除
              </Button>
            </Popconfirm>
          </Space>
        );
      },
    },
  ];

  return (
    <div>
      {contextHolder}
      <Space style={{ width: "100%", justifyContent: "space-between", marginBottom: 16 }} wrap>
        <Title level={4} style={{ margin: 0 }}>
          管理员账号
        </Title>
        <Space>
          <Button icon={<ReloadOutlined />} onClick={() => loadData()} loading={loading}>
            刷新
          </Button>
          <Button type="primary" icon={<PlusOutlined />} onClick={openCreate}>
            新增管理员
          </Button>
        </Space>
      </Space>
      <Card style={{ borderRadius: "var(--radius-card)" }}>
        <Table<AdminAccount> rowKey="id" loading={loading} dataSource={accounts} columns={columns} pagination={false} />
      </Card>
      <Modal
        title={editing ? "编辑管理员账号" : "新增管理员账号"}
        open={modalOpen}
        onCancel={closeModal}
        onOk={() => form.submit()}
        confirmLoading={saving}
        destroyOnHidden
        forceRender
      >
        <Form form={form} layout="vertical" onFinish={submit}>
          <Form.Item
            name="email"
            label="邮箱"
            rules={editing ? [] : [{ required: true, type: "email", message: "请输入有效邮箱" }]}
          >
            <Input disabled={Boolean(editing)} />
          </Form.Item>
          <Form.Item name="name" label="姓名" rules={[{ required: true, message: "请输入姓名" }]}>
            <Input />
          </Form.Item>
          <Form.Item
            name="password"
            label={editing ? "新密码（可选）" : "初始密码"}
            rules={editing ? [{ min: 8, message: "密码至少 8 位" }] : [{ required: true, min: 8, message: "请输入至少 8 位密码" }]}
          >
            <Input.Password />
          </Form.Item>
          <Form.Item name="status" label="状态" rules={[{ required: true, message: "请选择状态" }]}>
            <Select
              options={[
                { value: "ACTIVE", label: "ACTIVE" },
                { value: "DISABLED", label: "DISABLED" },
              ]}
            />
          </Form.Item>
          <Form.Item
            name="role_codes"
            label="角色"
            rules={[{ required: true, message: "请选择至少一个角色" }]}
          >
            <Select mode="multiple" allowClear options={roleOptions} showSearch optionFilterProp="label" />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}
