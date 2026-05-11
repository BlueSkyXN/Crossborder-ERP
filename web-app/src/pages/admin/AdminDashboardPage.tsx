import { useEffect, useState } from "react";
import { Card, Col, Row, Spin, Statistic, Table, Tag, Typography } from "antd";
import { adminAuth, type AuditLogEntry, type DashboardData } from "@crossborder-erp/api-client";
import { adminClient } from "../../api/client";

const { Title } = Typography;

const toneColors: Record<string, string> = {
  danger: "#ff4d4f",
  warning: "#faad14",
  success: "#52c41a",
  info: "#1677ff",
};

export function AdminDashboardPage() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    adminAuth
      .getDashboard(adminClient)
      .then(setData)
      .catch(() => setData(null))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return <Spin size="large" style={{ display: "block", margin: "120px auto" }} />;
  }

  return (
    <div>
      <Title level={4} style={{ marginBottom: 24 }}>
        控制台
      </Title>

      <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
        {(data?.summary_cards ?? []).map((card) => (
          <Col key={card.key} xs={12} sm={8} md={6}>
            <Card style={{ borderRadius: "var(--radius-card)" }}>
              <Statistic
                title={card.label}
                value={card.value}
                styles={{ content: { color: toneColors[card.tone ?? "info"] ?? "#1677ff" } }}
              />
              {card.hint && (
                <div style={{ fontSize: 12, color: "#999", marginTop: 4 }}>
                  {card.hint}
                </div>
              )}
            </Card>
          </Col>
        ))}
      </Row>

      {(data?.work_queue ?? []).length > 0 && (
        <>
          <Title level={5} style={{ marginBottom: 12 }}>
            待办队列
          </Title>
          <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
            {(data?.work_queue ?? []).map((item) => (
              <Col key={item.key} xs={12} sm={8} md={6}>
                <Card size="small" style={{ borderRadius: "var(--radius-card)" }}>
                  <Statistic
                    title={item.label}
                    value={item.value}
                    styles={{ content: { color: toneColors[item.tone ?? "warning"] ?? "#faad14" } }}
                  />
                </Card>
              </Col>
            ))}
          </Row>
        </>
      )}

      {(data?.recent_audit_logs ?? []).length > 0 && (
        <>
          <Title level={5} style={{ marginBottom: 12 }}>
            最近操作日志
          </Title>
          <Card style={{ borderRadius: "var(--radius-card)" }}>
            <Table<AuditLogEntry>
              size="small"
              dataSource={(data?.recent_audit_logs ?? []).slice(0, 10)}
              rowKey="id"
              pagination={false}
              columns={[
                {
                  title: "操作",
                  dataIndex: "action",
                  render: (action: string, log) => (
                      <span>
                        {action} <Tag>{log.target_type}</Tag>
                      </span>
                  ),
                },
                { title: "操作人", dataIndex: "operator_label" },
                { title: "时间", dataIndex: "created_at" },
                {
                  title: "状态",
                  dataIndex: "status_code",
                  render: (statusCode: number) => (
                    <Tag color={statusCode < 400 ? "green" : "red"}>{statusCode}</Tag>
                  ),
                },
              ]}
            />
          </Card>
        </>
      )}
    </div>
  );
}
