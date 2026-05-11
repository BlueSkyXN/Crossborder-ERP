import { useCallback, useEffect, useState } from "react";
import { Button, Card, Drawer, Empty, Form, Input, Modal, Space, Spin, Table, Tag, Typography, message } from "antd";
import { memberTickets } from "@crossborder-erp/api-client";
import type { PaginatedResponse, Ticket, TicketMessage } from "@crossborder-erp/api-client";
import { memberClient } from "../api/client";

const { Title, Text, Paragraph } = Typography;

type TicketDetail = Ticket & {
  updated_at?: string;
  messages?: Array<TicketMessage & { sender_label?: string }>;
};

type CreateTicketForm = {
  subject: string;
  message: string;
};

type ReplyForm = {
  message: string;
};

export function TicketsPage() {
  const [tickets, setTickets] = useState<PaginatedResponse<Ticket>>({
    items: [],
    pagination: { page: 1, page_size: 10, total: 0, total_pages: 0 },
  });
  const [loading, setLoading] = useState(true);
  const [createOpen, setCreateOpen] = useState(false);
  const [detailOpen, setDetailOpen] = useState(false);
  const [detail, setDetail] = useState<TicketDetail | null>(null);
  const [page, setPage] = useState(1);
  const [createForm] = Form.useForm<CreateTicketForm>();
  const [replyForm] = Form.useForm<ReplyForm>();

  const loadTickets = useCallback(() => {
    setLoading(true);
    memberTickets.list(memberClient, { page })
      .then(setTickets)
      .catch(() => message.error("工单列表加载失败"))
      .finally(() => setLoading(false));
  }, [page]);

  useEffect(() => {
    void Promise.resolve().then(loadTickets);
  }, [loadTickets]);

  const openDetail = async (ticket: Ticket) => {
    setDetailOpen(true);
    setDetail(null);
    try {
      setDetail(await memberTickets.getById(memberClient, ticket.id));
    } catch {
      message.error("工单详情加载失败");
    }
  };

  const createTicket = async (values: CreateTicketForm) => {
    try {
      await memberTickets.create(memberClient, { ...values });
      message.success("工单已创建");
      setCreateOpen(false);
      createForm.resetFields();
      loadTickets();
    } catch {
      message.error("工单创建失败");
    }
  };

  const replyTicket = async (values: ReplyForm) => {
    if (!detail) return;
    try {
      await memberTickets.sendMessage(memberClient, detail.id, { ...values });
      message.success("回复已发送");
      replyForm.resetFields();
      openDetail(detail);
    } catch {
      message.error("回复失败");
    }
  };

  return (
    <Card style={{ borderRadius: "var(--radius-card)" }}>
      <Space style={{ width: "100%", justifyContent: "space-between", marginBottom: 16 }}>
        <Title level={4} style={{ margin: 0 }}>
          工单消息
        </Title>
        <Button type="primary" onClick={() => setCreateOpen(true)}>
          新建工单
        </Button>
      </Space>
      {tickets.items.length === 0 && !loading ? (
        <Empty description="暂无工单" />
      ) : (
        <Table<Ticket>
          rowKey="id"
          loading={loading}
          dataSource={tickets.items}
          onRow={(ticket) => ({
            onClick: () => openDetail(ticket),
            style: { cursor: "pointer" },
          })}
          pagination={{
            current: tickets.pagination.page,
            pageSize: tickets.pagination.page_size,
            total: tickets.pagination.total,
            onChange: (nextPage) => {
              setLoading(true);
              setPage(nextPage);
            },
          }}
          columns={[
            { title: "主题", dataIndex: "subject" },
            { title: "创建时间", dataIndex: "created_at" },
            { title: "状态", dataIndex: "status", render: (status: string) => <Tag>{status}</Tag> },
          ]}
        />
      )}
      <Modal
        title="新建工单"
        open={createOpen}
        onCancel={() => setCreateOpen(false)}
        footer={null}
      >
        <Form form={createForm} layout="vertical" onFinish={createTicket}>
          <Form.Item name="subject" label="主题" rules={[{ required: true }]}>
            <Input />
          </Form.Item>
          <Form.Item name="message" label="问题描述" rules={[{ required: true }]}>
            <Input.TextArea rows={5} />
          </Form.Item>
          <Button type="primary" htmlType="submit">
            提交
          </Button>
        </Form>
      </Modal>
      <Drawer title="工单详情" open={detailOpen} onClose={() => setDetailOpen(false)} width={560}>
        {!detail ? (
          <Spin />
        ) : (
          <Space orientation="vertical" style={{ width: "100%" }} size="middle">
            <div>
              <Title level={5}>{detail.subject}</Title>
              <Tag>{detail.status}</Tag>
              <Text type="secondary"> {detail.created_at}</Text>
            </div>
            {(detail.messages ?? []).length === 0 ? (
              <Empty description="暂无消息" />
            ) : (
              <Space orientation="vertical" style={{ width: "100%" }}>
                {(detail.messages ?? []).map((item) => (
                  <Card size="small" style={{ width: "100%", borderRadius: "var(--radius-card)" }}>
                    <Text strong>{item.sender_label ?? item.sender_type ?? "用户"}</Text>
                    <Paragraph style={{ marginTop: 8, whiteSpace: "pre-wrap" }}>
                      {item.message}
                    </Paragraph>
                    <Text type="secondary">{item.created_at}</Text>
                  </Card>
                ))}
              </Space>
            )}
            <Form form={replyForm} layout="vertical" onFinish={replyTicket}>
              <Form.Item name="message" label="回复内容" rules={[{ required: true }]}>
                <Input.TextArea rows={4} />
              </Form.Item>
              <Button type="primary" htmlType="submit">
                发送回复
              </Button>
            </Form>
          </Space>
        )}
      </Drawer>
    </Card>
  );
}
