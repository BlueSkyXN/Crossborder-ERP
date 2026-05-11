import { useCallback, useEffect, useState } from "react";
import { Button, Card, Descriptions, Form, Input, Popconfirm, Space, Table, Tag, Typography, message } from "antd";
import type { ColumnsType, TablePaginationConfig } from "antd/es/table";
import { adminMembers, type AdminMember } from "@crossborder-erp/api-client";
import { adminClient } from "../../api/client";

const { Title } = Typography;
const statusColors: Record<string, string> = {
  ACTIVE: "green",
  FROZEN: "red",
};

export function AdminMembersPage() {
  const [form] = Form.useForm<{ email?: string }>();
  const [items, setItems] = useState<AdminMember[]>([]);
  const [pagination, setPagination] = useState({ current: 1, pageSize: 20, total: 0 });
  const [loading, setLoading] = useState(false);
  const [messageApi, contextHolder] = message.useMessage();

  const loadData = useCallback(
    async (page = 1, pageSize = 20) => {
      setLoading(true);
      try {
        const data = await adminMembers.list(adminClient, {
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
      } catch (error) {
        messageApi.error(error instanceof Error ? error.message : "会员列表加载失败");
      } finally {
        setLoading(false);
      }
    },
    [form, messageApi],
  );

  useEffect(() => {
    void Promise.resolve().then(() => loadData(1, 20));
  }, [loadData, pagination.pageSize]);

  const doAction = useCallback(
    async (row: AdminMember, action: "freeze" | "unfreeze" | "reset-password") => {
      try {
        if (action === "freeze") {
          await adminMembers.freeze(adminClient, row.id);
        } else if (action === "unfreeze") {
          await adminMembers.unfreeze(adminClient, row.id);
        } else {
          await adminMembers.resetPassword(adminClient, row.id);
        }
        messageApi.success("操作成功");
        void loadData();
      } catch (error) {
        messageApi.error(error instanceof Error ? error.message : "操作失败");
      }
    },
    [loadData, messageApi],
  );

  const columns: ColumnsType<AdminMember> = [
    { title: "邮箱", dataIndex: "email" },
    { title: "昵称", render: (_, row) => row.profile?.display_name },
    { title: "会员号", render: (_, row) => row.profile?.member_no },
    {
      title: "状态",
      dataIndex: "status",
      render: (value: string) => <Tag color={statusColors[value] ?? "default"}>{value}</Tag>,
    },
    { title: "等级", render: (_, row) => row.profile?.level },
    { title: "最后登录", dataIndex: "last_login_at" },
    { title: "注册时间", dataIndex: "created_at" },
    {
      title: "操作",
      render: (_, row) => (
        <Space>
          <Popconfirm
            title={row.status === "FROZEN" ? "确认解冻？" : "确认冻结？"}
            onConfirm={() => void doAction(row, row.status === "FROZEN" ? "unfreeze" : "freeze")}
          >
            <Button type="link" danger={row.status !== "FROZEN"}>
              {row.status === "FROZEN" ? "解冻" : "冻结"}
            </Button>
          </Popconfirm>
          <Popconfirm title="确认重置密码？" onConfirm={() => void doAction(row, "reset-password")}>
            <Button type="link">重置密码</Button>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  return (
    <div>
      {contextHolder}
      <Title level={4}>会员管理</Title>
      <Card style={{ borderRadius: "var(--radius-card)", marginBottom: 16 }}>
        <Form form={form} layout="inline" onFinish={() => loadData(1, 20)}>
          <Form.Item name="email" label="邮箱">
            <Input allowClear placeholder="邮箱" />
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
          expandable={{
            expandedRowRender: (row) => (
              <Descriptions column={3} size="small" bordered>
                <Descriptions.Item label="手机号">{row.phone || "-"}</Descriptions.Item>
                <Descriptions.Item label="仓库代码">
                  {row.profile?.warehouse_code || "-"}
                </Descriptions.Item>
                <Descriptions.Item label="更新时间">{row.updated_at || "-"}</Descriptions.Item>
              </Descriptions>
            ),
          }}
        />
      </Card>
    </div>
  );
}
