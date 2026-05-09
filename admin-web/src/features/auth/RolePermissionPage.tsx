import {
  CheckCircleOutlined,
  DeleteOutlined,
  EditOutlined,
  PlusOutlined,
  ReloadOutlined,
  SafetyOutlined,
} from "@ant-design/icons";
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
  Popconfirm,
  Row,
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
import { createAdminRole, deleteAdminRole, fetchAdminPermissions, fetchAdminRoles, updateAdminRole } from "./api";
import { adminRouteMeta } from "./menu";
import type { Permission, Role, RolePayload } from "./types";

type WorkspaceContext = {
  allowedCodes: Set<string>;
  permissionCodes: Set<string>;
};

type RoleFormValues = {
  code: string;
  name: string;
  description?: string;
  permission_codes: string[];
};

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : "角色权限加载失败";
}

function permissionTag(permission: Permission) {
  const color = permission.type === "MENU" ? "blue" : permission.type === "API" ? "purple" : "gold";
  return (
    <Tag key={permission.code} color={color}>
      {permission.code}
    </Tag>
  );
}

function hasAnyPermission(permissionCodes: Set<string>, codes: string[]) {
  return codes.some((code) => permissionCodes.has(code));
}

export function RolePermissionPage() {
  const { allowedCodes, permissionCodes } = useOutletContext<WorkspaceContext>();
  const queryClient = useQueryClient();
  const { message } = AntdApp.useApp();
  const [form] = Form.useForm<RoleFormValues>();
  const [editingRole, setEditingRole] = useState<Role | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const hasPermission = allowedCodes.has("iam.role.view");
  const canManage = permissionCodes.has("iam.role.manage");
  const canCreate = hasAnyPermission(permissionCodes, ["iam.role.create", "iam.role.manage"]);
  const canUpdate = hasAnyPermission(permissionCodes, ["iam.role.update", "iam.role.manage"]);
  const canDelete = hasAnyPermission(permissionCodes, ["iam.role.delete", "iam.role.manage"]);
  const rolesQuery = useQuery({
    queryKey: ["admin-roles"],
    queryFn: fetchAdminRoles,
    enabled: hasPermission,
  });
  const permissionsQuery = useQuery({
    queryKey: ["admin-permissions"],
    queryFn: fetchAdminPermissions,
    enabled: hasPermission,
  });
  const saveRoleMutation = useMutation({
    mutationFn: (values: RoleFormValues) => {
      const payload: RolePayload = {
        code: editingRole ? undefined : values.code,
        name: values.name,
        description: values.description || "",
        permission_codes: values.permission_codes,
      };
      return editingRole ? updateAdminRole(editingRole.id, payload) : createAdminRole(payload);
    },
    onSuccess: () => {
      message.success(editingRole ? "角色已更新" : "角色已创建");
      setModalOpen(false);
      setEditingRole(null);
      form.resetFields();
      queryClient.invalidateQueries({ queryKey: ["admin-roles"] });
      queryClient.invalidateQueries({ queryKey: ["admin", "me"] });
      queryClient.invalidateQueries({ queryKey: ["admin", "menus"] });
    },
    onError: (error) => {
      message.error(getErrorMessage(error));
    },
  });
  const deleteRoleMutation = useMutation({
    mutationFn: deleteAdminRole,
    onSuccess: () => {
      message.success("角色已删除");
      queryClient.invalidateQueries({ queryKey: ["admin-roles"] });
      queryClient.invalidateQueries({ queryKey: ["admin", "me"] });
      queryClient.invalidateQueries({ queryKey: ["admin", "menus"] });
    },
    onError: (error) => {
      message.error(getErrorMessage(error));
    },
  });

  const roles = useMemo(() => rolesQuery.data || [], [rolesQuery.data]);
  const permissions = useMemo(() => permissionsQuery.data || [], [permissionsQuery.data]);
  const menuPermissionCodes = useMemo(() => adminRouteMeta.map((route) => route.permission), []);
  const permissionOptions = useMemo(
    () =>
      permissions.map((permission) => ({
        label: (
          <Space orientation="vertical" size={0}>
            <span>{permission.name}</span>
            <Typography.Text type="secondary">{permission.code}</Typography.Text>
          </Space>
        ),
        value: permission.code,
      })),
    [permissions],
  );
  const openCreateModal = useCallback(() => {
    setEditingRole(null);
    form.setFieldsValue({
      code: "",
      name: "",
      description: "",
      permission_codes: ["dashboard.view"],
    });
    setModalOpen(true);
  }, [form]);
  const openEditModal = useCallback((role: Role) => {
    setEditingRole(role);
    form.setFieldsValue({
      code: role.code,
      name: role.name,
      description: role.description,
      permission_codes: role.permission_codes,
    });
    setModalOpen(true);
  }, [form]);
  const roleColumns = useMemo<ColumnsType<Role>>(
    () => [
      {
        title: "角色编码",
        dataIndex: "code",
        width: 160,
        render: (value: string) => <Typography.Text copyable>{value}</Typography.Text>,
      },
      { title: "角色名称", dataIndex: "name", width: 160 },
      { title: "说明", dataIndex: "description" },
      {
        title: "权限数",
        width: 100,
        render: (_, role) => role.permissions.length,
      },
      {
        title: "操作",
        width: 190,
        render: (_, role) => (
          <Space>
            <Button
              size="small"
              icon={<EditOutlined />}
              disabled={!canUpdate || role.code === "super_admin"}
              onClick={() => openEditModal(role)}
            >
              编辑
            </Button>
            <Popconfirm
              title="删除角色"
              description="仅未分配给管理员的角色可以删除。"
              okText="删除"
              cancelText="取消"
              okButtonProps={{ danger: true, loading: deleteRoleMutation.isPending }}
              onConfirm={() => deleteRoleMutation.mutate(role.id)}
            >
              <Button
                size="small"
                danger
                icon={<DeleteOutlined />}
                disabled={!canDelete || role.code === "super_admin"}
              >
                删除
              </Button>
            </Popconfirm>
          </Space>
        ),
      },
    ],
    [canDelete, canUpdate, deleteRoleMutation, openEditModal],
  );
  const matrixColumns = useMemo<ColumnsType<{ code: string; label: string; resource: string }>>(
    () => [
      {
        title: "权限",
        dataIndex: "code",
        fixed: "left",
        width: 190,
        render: (value: string, record) => (
          <Space orientation="vertical" size={0}>
            <Typography.Text>{record.label}</Typography.Text>
            <Typography.Text type="secondary">{value}</Typography.Text>
          </Space>
        ),
      },
      ...roles.map((role) => ({
        title: role.name,
        key: role.code,
        align: "center" as const,
        width: 120,
        render: (_: unknown, record: { code: string }) =>
          role.permissions.some((permission) => permission.code === record.code) ? (
            <CheckCircleOutlined style={{ color: "#16a34a" }} />
          ) : (
            <span>-</span>
          ),
      })),
    ],
    [roles],
  );

  if (!hasPermission) {
    return <ForbiddenPage />;
  }

  return (
    <Space orientation="vertical" size={16} className="workspace-page">
      <div className="page-heading">
        <div>
          <Typography.Title level={2}>角色权限</Typography.Title>
          <Typography.Paragraph>后台角色、菜单权限覆盖和当前账号可见模块。</Typography.Paragraph>
        </div>
        <Button icon={<ReloadOutlined />} onClick={() => rolesQuery.refetch()} loading={rolesQuery.isFetching}>
          刷新
        </Button>
        {canCreate && (
          <Button type="primary" icon={<PlusOutlined />} onClick={openCreateModal}>
            新增角色
          </Button>
        )}
      </div>

      {rolesQuery.isError && (
        <Alert type="error" showIcon message="角色权限加载失败" description={getErrorMessage(rolesQuery.error)} />
      )}
      {!canManage && (
        <Alert
          type="info"
          showIcon
          message="当前账号未持有角色总管理权限，新增、编辑、删除会分别按 iam.role.create / update / delete 控制。"
        />
      )}

      <Row gutter={[16, 16]}>
        <Col xs={24} md={8}>
          <Card>
            <Statistic title="后台角色" value={roles.length} prefix={<SafetyOutlined />} />
          </Card>
        </Col>
        <Col xs={24} md={8}>
          <Card>
            <Statistic title="菜单权限" value={menuPermissionCodes.length} />
          </Card>
        </Col>
        <Col xs={24} md={8}>
          <Card>
            <Statistic title="全部权限" value={permissions.length} suffix="项" />
          </Card>
        </Col>
      </Row>

      <Card title="角色列表">
        <Table
          rowKey="id"
          loading={rolesQuery.isLoading}
          dataSource={roles}
          columns={roleColumns}
          expandable={{
            expandedRowRender: (role) => (
              <Space wrap size={[8, 8]}>
                {role.permissions.length ? role.permissions.map(permissionTag) : <Empty description="暂无权限" />}
              </Space>
            ),
          }}
          pagination={false}
          locale={{ emptyText: <Empty description="暂无角色" /> }}
        />
      </Card>

      <Card title="权限覆盖矩阵">
        <Table
          rowKey="code"
          size="small"
          loading={rolesQuery.isLoading}
          dataSource={adminRouteMeta.map((route) => ({
            code: route.permission,
            label: route.label,
            resource: route.resource,
          }))}
          columns={matrixColumns}
          pagination={false}
          scroll={{ x: 760 }}
          locale={{ emptyText: <Empty description="暂无权限矩阵" /> }}
        />
      </Card>
      <Modal
        title={editingRole ? "编辑角色" : "新增角色"}
        open={modalOpen}
        onCancel={() => {
          setModalOpen(false);
          setEditingRole(null);
        }}
        okText="保存"
        confirmLoading={saveRoleMutation.isPending}
        onOk={() => form.submit()}
        destroyOnHidden
      >
        <Form form={form} layout="vertical" onFinish={(values) => saveRoleMutation.mutate(values)}>
          <Form.Item
            label="角色编码"
            name="code"
            rules={[
              { required: true, message: "请输入角色编码" },
              {
                pattern: /^[a-z][a-z0-9_]{2,79}$/,
                message: "仅支持小写字母、数字和下划线，且必须以字母开头",
              },
            ]}
          >
            <Input disabled={Boolean(editingRole)} placeholder="ops_custom" />
          </Form.Item>
          <Form.Item label="角色名称" name="name" rules={[{ required: true, message: "请输入角色名称" }]}>
            <Input maxLength={100} />
          </Form.Item>
          <Form.Item label="说明" name="description">
            <Input.TextArea rows={3} maxLength={500} showCount />
          </Form.Item>
          <Form.Item
            label="权限"
            name="permission_codes"
            rules={[{ required: true, message: "至少选择一个权限" }]}
          >
            <Checkbox.Group className="permission-check-list" options={permissionOptions} />
          </Form.Item>
        </Form>
      </Modal>
    </Space>
  );
}
