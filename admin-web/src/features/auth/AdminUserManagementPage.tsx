import { EditOutlined, PlusOutlined, ReloadOutlined, UserSwitchOutlined } from "@ant-design/icons";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Alert,
  App as AntdApp,
  Button,
  Card,
  Checkbox,
  Col,
  Empty,
  Form,
  Input,
  Modal,
  Row,
  Select,
  Space,
  Statistic,
  Table,
  Tag,
  Typography,
} from "antd";
import type { ColumnsType } from "antd/es/table";
import { useCallback, useMemo, useState } from "react";
import { useOutletContext } from "react-router-dom";

import { ForbiddenPage } from "../../pages/ForbiddenPage";
import { createAdminAccount, fetchAdminAccounts, fetchAdminRoles, updateAdminAccount } from "./api";
import { useAuthStore } from "./store";
import type { AdminAccount, AdminAccountPayload, Role } from "./types";

type WorkspaceContext = {
  allowedCodes: Set<string>;
  permissionCodes: Set<string>;
};

type AdminAccountFormValues = {
  email: string;
  name: string;
  password?: string;
  status: AdminAccount["status"];
  role_codes: string[];
};

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : "管理员账号加载失败";
}

function statusTag(status: AdminAccount["status"]) {
  return status === "ACTIVE" ? <Tag color="green">启用</Tag> : <Tag color="red">停用</Tag>;
}

function roleTags(roleCodes: string[], roles: Role[]) {
  const roleByCode = new Map(roles.map((role) => [role.code, role]));
  return roleCodes.length ? (
    roleCodes.map((code) => (
      <Tag key={code} color={code === "super_admin" ? "gold" : "blue"}>
        {roleByCode.get(code)?.name || code}
      </Tag>
    ))
  ) : (
    <Empty description="暂无角色" image={Empty.PRESENTED_IMAGE_SIMPLE} />
  );
}

function formatDateTime(value: string | null) {
  return value ? new Date(value).toLocaleString() : "-";
}

export function AdminUserManagementPage() {
  const { allowedCodes, permissionCodes } = useOutletContext<WorkspaceContext>();
  const currentAdmin = useAuthStore((state) => state.adminUser);
  const queryClient = useQueryClient();
  const { message } = AntdApp.useApp();
  const [form] = Form.useForm<AdminAccountFormValues>();
  const [editingAccount, setEditingAccount] = useState<AdminAccount | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const hasPermission = allowedCodes.has("iam.admin.view");
  const canManage = permissionCodes.has("iam.admin.manage");
  const accountsQuery = useQuery({
    queryKey: ["admin-accounts"],
    queryFn: fetchAdminAccounts,
    enabled: hasPermission,
  });
  const rolesQuery = useQuery({
    queryKey: ["admin-roles"],
    queryFn: fetchAdminRoles,
    enabled: hasPermission,
  });
  const accounts = useMemo(() => accountsQuery.data || [], [accountsQuery.data]);
  const roles = useMemo(() => rolesQuery.data || [], [rolesQuery.data]);
  const editableRoles = useMemo(() => roles.filter((role) => role.code !== "super_admin"), [roles]);
  const roleOptions = useMemo(
    () =>
      editableRoles.map((role) => ({
        label: (
          <Space orientation="vertical" size={0}>
            <span>{role.name}</span>
            <Typography.Text type="secondary">{role.code}</Typography.Text>
          </Space>
        ),
        value: role.code,
      })),
    [editableRoles],
  );
  const saveAccountMutation = useMutation({
    mutationFn: (values: AdminAccountFormValues) => {
      const payload: AdminAccountPayload = {
        email: editingAccount ? undefined : values.email,
        name: values.name,
        password: values.password || undefined,
        status: values.status,
        role_codes: values.role_codes,
      };
      return editingAccount ? updateAdminAccount(editingAccount.id, payload) : createAdminAccount(payload);
    },
    onSuccess: () => {
      message.success(editingAccount ? "管理员已更新" : "管理员已创建");
      setModalOpen(false);
      setEditingAccount(null);
      form.resetFields();
      queryClient.invalidateQueries({ queryKey: ["admin-accounts"] });
      queryClient.invalidateQueries({ queryKey: ["admin", "me"] });
      queryClient.invalidateQueries({ queryKey: ["admin", "menus"] });
    },
    onError: (error) => {
      message.error(getErrorMessage(error));
    },
  });
  const openCreateModal = useCallback(() => {
    setEditingAccount(null);
    form.setFieldsValue({
      email: "",
      name: "",
      password: "",
      status: "ACTIVE",
      role_codes: editableRoles[0] ? [editableRoles[0].code] : [],
    });
    setModalOpen(true);
  }, [editableRoles, form]);
  const openEditModal = useCallback((account: AdminAccount) => {
    setEditingAccount(account);
    form.setFieldsValue({
      email: account.email,
      name: account.name,
      password: "",
      status: account.status,
      role_codes: account.roles.filter((code) => code !== "super_admin"),
    });
    setModalOpen(true);
  }, [form]);
  const refreshAll = useCallback(() => {
    accountsQuery.refetch();
    rolesQuery.refetch();
  }, [accountsQuery, rolesQuery]);
  const columns = useMemo<ColumnsType<AdminAccount>>(
    () => [
      {
        title: "邮箱",
        dataIndex: "email",
        width: 220,
        render: (value: string) => <Typography.Text copyable>{value}</Typography.Text>,
      },
      { title: "姓名", dataIndex: "name", width: 140 },
      {
        title: "状态",
        dataIndex: "status",
        width: 90,
        render: statusTag,
      },
      {
        title: "角色",
        width: 240,
        render: (_, account) => roleTags(account.roles, roles),
      },
      {
        title: "权限数",
        width: 90,
        render: (_, account) => account.permission_codes.length,
      },
      {
        title: "最近登录",
        dataIndex: "last_login_at",
        width: 190,
        render: formatDateTime,
      },
      {
        title: "操作",
        width: 120,
        render: (_, account) => {
          const locked = account.is_super_admin || account.id === currentAdmin?.id;
          return (
            <Button
              size="small"
              icon={<EditOutlined />}
              disabled={!canManage || locked}
              onClick={() => openEditModal(account)}
            >
              编辑
            </Button>
          );
        },
      },
    ],
    [canManage, currentAdmin?.id, openEditModal, roles],
  );

  if (!hasPermission) {
    return <ForbiddenPage />;
  }

  return (
    <Space orientation="vertical" size={16} className="workspace-page">
      <div className="page-heading">
        <div>
          <Typography.Title level={2}>管理员账号</Typography.Title>
          <Typography.Paragraph>后台登录账号、角色分配和启停状态。</Typography.Paragraph>
        </div>
        <Button icon={<ReloadOutlined />} onClick={refreshAll} loading={accountsQuery.isFetching || rolesQuery.isFetching}>
          刷新
        </Button>
        {canManage && (
          <Button type="primary" icon={<PlusOutlined />} onClick={openCreateModal}>
            新增管理员
          </Button>
        )}
      </div>

      {accountsQuery.isError && (
        <Alert type="error" showIcon message="管理员账号加载失败" description={getErrorMessage(accountsQuery.error)} />
      )}
      {rolesQuery.isError && (
        <Alert type="error" showIcon message="角色列表加载失败" description={getErrorMessage(rolesQuery.error)} />
      )}
      {!canManage && <Alert type="info" showIcon message="当前账号只读管理员账号，缺少 iam.admin.manage。" />}

      <Row gutter={[16, 16]}>
        <Col xs={24} md={8}>
          <Card>
            <Statistic title="管理员账号" value={accounts.length} prefix={<UserSwitchOutlined />} />
          </Card>
        </Col>
        <Col xs={24} md={8}>
          <Card>
            <Statistic title="启用账号" value={accounts.filter((account) => account.status === "ACTIVE").length} />
          </Card>
        </Col>
        <Col xs={24} md={8}>
          <Card>
            <Statistic title="可分配角色" value={editableRoles.length} suffix="个" />
          </Card>
        </Col>
      </Row>

      <Card title="账号列表">
        <Table
          rowKey="id"
          loading={accountsQuery.isLoading || rolesQuery.isLoading}
          dataSource={accounts}
          columns={columns}
          pagination={false}
          scroll={{ x: 1060 }}
          locale={{ emptyText: <Empty description="暂无管理员账号" /> }}
        />
      </Card>

      <Modal
        title={editingAccount ? "编辑管理员" : "新增管理员"}
        open={modalOpen}
        onCancel={() => {
          setModalOpen(false);
          setEditingAccount(null);
        }}
        okText="保存"
        confirmLoading={saveAccountMutation.isPending}
        onOk={() => form.submit()}
        destroyOnHidden
      >
        <Form form={form} layout="vertical" onFinish={(values) => saveAccountMutation.mutate(values)}>
          <Form.Item label="邮箱" name="email" rules={[{ required: true, type: "email", message: "请输入有效邮箱" }]}>
            <Input disabled={Boolean(editingAccount)} placeholder="ops-admin@example.com" />
          </Form.Item>
          <Form.Item label="姓名" name="name" rules={[{ required: true, message: "请输入姓名" }]}>
            <Input maxLength={100} />
          </Form.Item>
          <Form.Item
            label={editingAccount ? "重置密码" : "初始密码"}
            name="password"
            rules={[
              { required: !editingAccount, message: "请输入初始密码" },
              { min: 8, message: "密码至少 8 位" },
            ]}
          >
            <Input.Password autoComplete="new-password" placeholder={editingAccount ? "留空则不修改" : "至少 8 位"} />
          </Form.Item>
          <Form.Item label="状态" name="status" rules={[{ required: true, message: "请选择状态" }]}>
            <Select
              options={[
                { label: "启用", value: "ACTIVE" },
                { label: "停用", value: "DISABLED" },
              ]}
            />
          </Form.Item>
          <Form.Item label="角色" name="role_codes" rules={[{ required: true, message: "至少选择一个角色" }]}>
            <Checkbox.Group className="permission-check-list" options={roleOptions} />
          </Form.Item>
        </Form>
      </Modal>
    </Space>
  );
}
