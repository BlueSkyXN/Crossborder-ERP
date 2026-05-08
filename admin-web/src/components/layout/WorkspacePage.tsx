import { Button, Card, Col, Row, Space, Statistic, Table, Tag, Typography } from "antd";
import { useOutletContext } from "react-router-dom";

import type { AdminRouteMeta } from "../../features/auth/menu";
import { ForbiddenPage } from "../../pages/ForbiddenPage";

type WorkspaceContext = {
  allowedCodes: Set<string>;
};

type WorkspacePageProps = {
  route: AdminRouteMeta;
};

const tableRows = [
  { key: "todo", item: "待处理", status: "OPEN", owner: "系统" },
  { key: "review", item: "待复核", status: "PENDING", owner: "运营" },
  { key: "done", item: "已完成", status: "DONE", owner: "仓库" },
];

export function WorkspacePage({ route }: WorkspacePageProps) {
  const { allowedCodes } = useOutletContext<WorkspaceContext>();
  const hasPermission = allowedCodes.has(route.permission);

  if (!hasPermission) {
    return <ForbiddenPage />;
  }

  return (
    <Space direction="vertical" size={16} className="workspace-page">
      <div className="page-heading">
        <div>
          <Typography.Title level={2}>{route.label}</Typography.Title>
          <Typography.Paragraph>{route.description}</Typography.Paragraph>
        </div>
        <Space>
          <Button>导出</Button>
          <Button type="primary">新建</Button>
        </Space>
      </div>

      <Row gutter={[16, 16]}>
        <Col xs={24} md={8}>
          <Card>
            <Statistic title="今日新增" value={18} suffix="项" />
          </Card>
        </Col>
        <Col xs={24} md={8}>
          <Card>
            <Statistic title="待处理" value={7} suffix="项" valueStyle={{ color: "#f59e0b" }} />
          </Card>
        </Col>
        <Col xs={24} md={8}>
          <Card>
            <Statistic title="异常" value={1} suffix="项" valueStyle={{ color: "#ef4444" }} />
          </Card>
        </Col>
      </Row>

      <Card title="工作列表" extra={<Tag color="blue">今日队列</Tag>}>
        <Table
          pagination={false}
          dataSource={tableRows}
          columns={[
            { title: "事项", dataIndex: "item" },
            {
              title: "状态",
              dataIndex: "status",
              render: (value: string) => <Tag>{value}</Tag>,
            },
            { title: "负责人", dataIndex: "owner" },
          ]}
        />
      </Card>
    </Space>
  );
}
