import { useCallback, useEffect, useState } from "react";
import { Alert, Button, Card, Form, Input, Table, Tag, Typography, message } from "antd";
import type { ColumnsType, TablePaginationConfig } from "antd/es/table";
import type { AuditLogEntry } from "@crossborder-erp/api-client";
import { adminAuditLogs } from "@crossborder-erp/api-client";
import { adminClient } from "../../api/client";

const { Title } = Typography;

export function AdminAuditLogsPage() {
  const [form] = Form.useForm<{ action?: string }>();
  const [items, setItems] = useState<AuditLogEntry[]>([]);
  const [pagination, setPagination] = useState({ current: 1, pageSize: 20, total: 0 });
  const [loading, setLoading] = useState(false);
  const [comingSoon, setComingSoon] = useState(false);
  const [messageApi, contextHolder] = message.useMessage();

  const loadData = useCallback(
    async (page = 1, pageSize = 20) => {
      setLoading(true);
      setComingSoon(false);
      try {
        const data = await adminAuditLogs.list(adminClient, {
          page,
          page_size: pageSize,
          ...form.getFieldsValue(),
        });
        setItems(data.items ?? []);
        setPagination({
          current: data.pagination?.page ?? page,
          pageSize: data.pagination?.page_size ?? pageSize,
          total: data.pagination?.total ?? 0,
        });
      } catch {
        setComingSoon(true);
        messageApi.warning("审计日志接口暂不可用");
      } finally {
        setLoading(false);
      }
    },
    [form, messageApi],
  );

  useEffect(() => {
    void Promise.resolve().then(() => loadData(1, 20));
  }, [loadData, pagination.pageSize]);

  const columns: ColumnsType<AuditLogEntry> = [
    { title: "操作", dataIndex: "action" },
    { title: "操作者", dataIndex: "operator_label" },
    { title: "目标类型", dataIndex: "target_type" },
    {
      title: "状态码",
      dataIndex: "status_code",
      render: (value?: number) => <Tag color={value && value < 400 ? "green" : "red"}>{value ?? "-"}</Tag>,
    },
    { title: "创建时间", dataIndex: "created_at" },
  ];

  return (
    <div>
      {contextHolder}
      <Title level={4}>审计日志</Title>
      {comingSoon ? (
        <Card style={{ borderRadius: "var(--radius-card)" }}>
          <Alert
            type="info"
            showIcon
            title="功能开发中"
            description="审计日志完整列表接口暂不可用，请稍后再试。"
          />
        </Card>
      ) : (
        <>
          <Card style={{ borderRadius: "var(--radius-card)", marginBottom: 16 }}>
            <Form form={form} layout="inline" onFinish={() => loadData(1, 20)}>
              <Form.Item name="action" label="操作类型">
                <Input allowClear placeholder="action" />
              </Form.Item>
              <Form.Item>
                <Button type="primary" htmlType="submit">
                  查询
                </Button>
              </Form.Item>
            </Form>
          </Card>
          <Card style={{ borderRadius: "var(--radius-card)" }}>
            <Table
              rowKey="id"
              columns={columns}
              dataSource={items}
              loading={loading}
              pagination={pagination}
              onChange={(p: TablePaginationConfig) => loadData(p.current ?? 1, p.pageSize ?? 20)}
            />
          </Card>
        </>
      )}
    </div>
  );
}
