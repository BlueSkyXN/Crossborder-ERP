import {
  AuditOutlined,
  CheckCircleOutlined,
  ClockCircleOutlined,
  DashboardOutlined,
  ReloadOutlined,
  RightOutlined,
} from "@ant-design/icons";
import { useQuery } from "@tanstack/react-query";
import { Alert, Button, Card, Col, Empty, Row, Space, Statistic, Table, Tag, Typography } from "antd";
import type { ColumnsType } from "antd/es/table";
import { useMemo } from "react";
import { useNavigate, useOutletContext } from "react-router-dom";

import { ForbiddenPage } from "../../pages/ForbiddenPage";
import { fetchAdminDashboard } from "./api";
import { DashboardCharts } from "./DashboardCharts";
import type { DashboardAuditLog, DashboardCard, DashboardModule, DashboardQueueItem, DashboardTone } from "./types";

type WorkspaceContext = {
  allowedCodes: Set<string>;
};

const toneColor: Record<DashboardTone, string> = {
  blue: "blue",
  green: "green",
  gold: "gold",
  purple: "purple",
  cyan: "cyan",
  magenta: "magenta",
  lime: "lime",
  orange: "orange",
  warning: "gold",
  danger: "red",
  default: "default",
};

function formatDate(value: string) {
  return new Date(value).toLocaleString("zh-CN", { hour12: false });
}

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : "控制台数据加载失败";
}

function DashboardSummaryCard({ card }: { card: DashboardCard }) {
  const navigate = useNavigate();
  return (
    <Card
      hoverable
      onClick={() => navigate(card.path)}
      actions={[
        <Button key="open" type="link" icon={<RightOutlined />} onClick={() => navigate(card.path)}>
          打开
        </Button>,
      ]}
    >
      <Statistic
        title={card.label}
        value={card.value}
        styles={{ content: { color: card.tone === "danger" ? "#dc2626" : undefined } }}
      />
      <Typography.Text type="secondary">{card.hint}</Typography.Text>
    </Card>
  );
}

function WorkQueueList({ items }: { items: DashboardQueueItem[] }) {
  const navigate = useNavigate();
  if (items.length === 0) {
    return <Empty description="当前没有可见待办" />;
  }
  return (
    <Table
      rowKey="key"
      size="small"
      pagination={false}
      dataSource={items}
      columns={[
        {
          title: "事项",
          dataIndex: "label",
        },
        {
          title: "数量",
          dataIndex: "value",
          width: 90,
          render: (value: number, item) => <Tag color={toneColor[item.tone]}>{value}</Tag>,
        },
        {
          title: "操作",
          width: 90,
          render: (_, item) => (
            <Button size="small" onClick={() => navigate(item.path)}>
              处理
            </Button>
          ),
        },
      ]}
    />
  );
}

function ModuleList({ modules }: { modules: DashboardModule[] }) {
  const navigate = useNavigate();
  if (modules.length === 0) {
    return <Empty description="当前账号没有可见模块" />;
  }
  return (
    <Table
      rowKey="key"
      size="small"
      pagination={false}
      dataSource={modules}
      columns={[
        {
          title: "模块",
          dataIndex: "label",
          width: 120,
        },
        {
          title: "指标",
          render: (_, module) => (
            <Space wrap size={[8, 8]}>
              {module.metrics.map((metric) => (
                <Tag key={`${module.key}-${metric.label}`} color="blue">
                  {metric.label} {metric.value}
                </Tag>
              ))}
            </Space>
          ),
        },
        {
          title: "操作",
          width: 90,
          render: (_, module) => (
            <Button size="small" type="link" onClick={() => navigate(module.path)}>
              进入
            </Button>
          ),
        },
      ]}
    />
  );
}

export function AdminDashboardPage() {
  const { allowedCodes } = useOutletContext<WorkspaceContext>();
  const hasPermission = allowedCodes.has("dashboard.view");
  const dashboardQuery = useQuery({
    queryKey: ["admin-dashboard"],
    queryFn: fetchAdminDashboard,
    enabled: hasPermission,
  });

  const auditColumns = useMemo<ColumnsType<DashboardAuditLog>>(
    () => [
      {
        title: "时间",
        dataIndex: "created_at",
        render: (value: string) => formatDate(value),
        width: 180,
      },
      { title: "动作", dataIndex: "action" },
      { title: "操作人", dataIndex: "operator_label" },
      { title: "对象", dataIndex: "target_type" },
      {
        title: "状态",
        dataIndex: "status_code",
        width: 100,
        render: (value: number) => <Tag color={value >= 400 ? "red" : "green"}>{value}</Tag>,
      },
    ],
    [],
  );

  if (!hasPermission) {
    return <ForbiddenPage />;
  }

  const snapshot = dashboardQuery.data;

  return (
    <Space orientation="vertical" size={16} className="workspace-page">
      <div className="page-heading">
        <div>
          <Typography.Title level={2}>运营控制台</Typography.Title>
          <Typography.Paragraph>
            实时汇总当前账号可见模块的会员、包裹、运单、财务、代购、客服和审计状态。
          </Typography.Paragraph>
        </div>
        <Button icon={<ReloadOutlined />} onClick={() => dashboardQuery.refetch()} loading={dashboardQuery.isFetching}>
          刷新
        </Button>
      </div>

      {dashboardQuery.isError && (
        <Alert type="error" showIcon message="控制台数据加载失败" description={getErrorMessage(dashboardQuery.error)} />
      )}

      <Row gutter={[16, 16]}>
        {(snapshot?.summary_cards || []).map((card) => (
          <Col xs={24} sm={12} xl={6} key={card.key}>
            <DashboardSummaryCard card={card} />
          </Col>
        ))}
      </Row>

      <Row gutter={[16, 16]}>
        <Col span={24}>
          <Card title="月度趋势">
            <DashboardCharts />
          </Card>
        </Col>
      </Row>

      <Row gutter={[16, 16]}>
        <Col xs={24} lg={10}>
          <Card title="实时工作队列" extra={<ClockCircleOutlined />}>
            {dashboardQuery.isLoading ? <Empty description="加载工作队列" /> : <WorkQueueList items={snapshot?.work_queue || []} />}
          </Card>
        </Col>
        <Col xs={24} lg={14}>
          <Card
            title="模块健康概览"
            extra={
              <Space>
                <DashboardOutlined />
                <CheckCircleOutlined />
              </Space>
            }
          >
            {dashboardQuery.isLoading ? <Empty description="加载模块概览" /> : <ModuleList modules={snapshot?.modules || []} />}
          </Card>
        </Col>
      </Row>

      {allowedCodes.has("audit.logs.view") && (
        <Card
          title="最近审计动作"
          extra={
            <Space>
              <AuditOutlined />
              {snapshot?.generated_at ? <Typography.Text type="secondary">{formatDate(snapshot.generated_at)}</Typography.Text> : null}
            </Space>
          }
        >
          <Table
            rowKey="id"
            size="small"
            loading={dashboardQuery.isLoading}
            dataSource={snapshot?.recent_audit_logs || []}
            columns={auditColumns}
            pagination={false}
            locale={{ emptyText: <Empty description="暂无审计日志" /> }}
          />
        </Card>
      )}
    </Space>
  );
}
