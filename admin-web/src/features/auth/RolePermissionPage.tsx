import { CheckCircleOutlined, ReloadOutlined, SafetyOutlined } from "@ant-design/icons";
import { useQuery } from "@tanstack/react-query";
import { Alert, Button, Card, Col, Empty, Row, Space, Statistic, Table, Tag, Typography } from "antd";
import type { ColumnsType } from "antd/es/table";
import { useMemo } from "react";
import { useOutletContext } from "react-router-dom";

import { ForbiddenPage } from "../../pages/ForbiddenPage";
import { fetchAdminRoles } from "./api";
import { adminRouteMeta } from "./menu";
import type { Permission, Role } from "./types";

type WorkspaceContext = {
  allowedCodes: Set<string>;
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

export function RolePermissionPage() {
  const { allowedCodes } = useOutletContext<WorkspaceContext>();
  const hasPermission = allowedCodes.has("iam.role.view");
  const rolesQuery = useQuery({
    queryKey: ["admin-roles"],
    queryFn: fetchAdminRoles,
    enabled: hasPermission,
  });

  const roles = useMemo(() => rolesQuery.data || [], [rolesQuery.data]);
  const menuPermissionCodes = useMemo(() => adminRouteMeta.map((route) => route.permission), []);
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
    ],
    [],
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
      </div>

      {rolesQuery.isError && (
        <Alert type="error" showIcon message="角色权限加载失败" description={getErrorMessage(rolesQuery.error)} />
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
            <Statistic title="当前账号可见" value={allowedCodes.size} suffix="项" />
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
    </Space>
  );
}
