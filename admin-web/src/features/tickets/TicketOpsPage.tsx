import {
  CheckCircleOutlined,
  CloseCircleOutlined,
  FileSearchOutlined,
  MessageOutlined,
  ReloadOutlined,
  SearchOutlined,
  SendOutlined,
} from "@ant-design/icons";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Alert,
  App as AntdApp,
  Button,
  Card,
  Col,
  Descriptions,
  Drawer,
  Empty,
  Form,
  Input,
  Row,
  Space,
  Statistic,
  Table,
  Tabs,
  Tag,
  Timeline,
  Typography,
} from "antd";
import type { TableColumnsType } from "antd";
import { useMemo, useState } from "react";
import { useOutletContext } from "react-router-dom";

import { ForbiddenPage } from "../../pages/ForbiddenPage";
import { adminFilesApi } from "../files/api";
import { ticketOpsApi } from "./api";
import type { Ticket, TicketStatus, TicketType } from "./types";

type WorkspaceContext = {
  allowedCodes: Set<string>;
};

type ActiveStatus = "ALL" | TicketStatus;
type ReplyFormValues = {
  content: string;
};
type CloseFormValues = {
  content?: string;
};

const ticketsQueryKey = ["admin-tickets"] as const;

const statusMeta: Record<TicketStatus, { color: string; label: string }> = {
  OPEN: { color: "gold", label: "待处理" },
  PROCESSING: { color: "blue", label: "处理中" },
  CLOSED: { color: "default", label: "已关闭" },
};

const typeMeta: Record<TicketType, string> = {
  GENERAL: "普通咨询",
  PARCEL: "包裹问题",
  WAYBILL: "运单问题",
  PURCHASE: "代购问题",
  FINANCE: "财务问题",
  ACCOUNT: "账号问题",
};

const statusTabs: { key: ActiveStatus; label: string }[] = [
  { key: "OPEN", label: "待处理" },
  { key: "PROCESSING", label: "处理中" },
  { key: "CLOSED", label: "已关闭" },
  { key: "ALL", label: "全部" },
];

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : "请求失败";
}

function formatDate(value?: string | null) {
  if (!value) {
    return "-";
  }
  return new Date(value).toLocaleString("zh-CN", { hour12: false });
}

function statusTag(status: TicketStatus) {
  const meta = statusMeta[status];
  return <Tag color={meta.color}>{meta.label}</Tag>;
}

function normalizeText(value: unknown) {
  return value === undefined || value === null ? "" : String(value).toLowerCase();
}

function filterRows<T>(rows: T[], keyword: string, pickText: (row: T) => unknown[]) {
  const normalized = keyword.trim().toLowerCase();
  if (!normalized) {
    return rows;
  }
  return rows.filter((row) => pickText(row).map(normalizeText).join(" ").includes(normalized));
}

export function TicketOpsPage() {
  const { allowedCodes } = useOutletContext<WorkspaceContext>();
  const hasPermission = allowedCodes.has("tickets.view");
  const queryClient = useQueryClient();
  const { message } = AntdApp.useApp();
  const [replyForm] = Form.useForm<ReplyFormValues>();
  const [closeForm] = Form.useForm<CloseFormValues>();
  const [activeStatus, setActiveStatus] = useState<ActiveStatus>("OPEN");
  const [keyword, setKeyword] = useState("");
  const [selectedTicketId, setSelectedTicketId] = useState<number | null>(null);
  const [replyFile, setReplyFile] = useState<File | null>(null);

  const ticketsQuery = useQuery({
    queryKey: ticketsQueryKey,
    queryFn: ticketOpsApi.listTickets,
    enabled: hasPermission,
  });
  const tickets = useMemo(() => ticketsQuery.data ?? [], [ticketsQuery.data]);
  const selectedTicket = tickets.find((ticket) => ticket.id === selectedTicketId) ?? null;
  const filteredTickets = useMemo(() => {
    const byStatus = activeStatus === "ALL" ? tickets : tickets.filter((ticket) => ticket.status === activeStatus);
    return filterRows(byStatus, keyword, (ticket) => [
      ticket.ticket_no,
      ticket.user_email,
      ticket.title,
      ticket.handled_by_name,
      typeMeta[ticket.type],
    ]);
  }, [activeStatus, keyword, tickets]);

  const invalidateTickets = () => queryClient.invalidateQueries({ queryKey: ticketsQueryKey });

  const markProcessingMutation = useMutation({
    mutationFn: (ticketId: number) => ticketOpsApi.markProcessing(ticketId),
    onSuccess: () => {
      message.success("工单已标记处理中");
      invalidateTickets();
    },
    onError: (error) => message.error(getErrorMessage(error)),
  });

  const replyMutation = useMutation({
    mutationFn: async ({ ticketId, values }: { ticketId: number; values: ReplyFormValues }) => {
      let fileId = "";
      if (replyFile) {
        const uploaded = await adminFilesApi.uploadFile(replyFile, "MESSAGE_ATTACHMENT");
        fileId = uploaded.file_id;
      }
      return ticketOpsApi.replyTicket(ticketId, { content: values.content.trim(), file_id: fileId });
    },
    onSuccess: () => {
      message.success("回复已发送");
      replyForm.resetFields();
      setReplyFile(null);
      invalidateTickets();
    },
    onError: (error) => message.error(getErrorMessage(error)),
  });

  const closeMutation = useMutation({
    mutationFn: ({ ticketId, values }: { ticketId: number; values: CloseFormValues }) =>
      ticketOpsApi.closeTicket(ticketId, { content: values.content?.trim() || "" }),
    onSuccess: () => {
      message.success("工单已关闭");
      closeForm.resetFields();
      invalidateTickets();
    },
    onError: (error) => message.error(getErrorMessage(error)),
  });

  if (!hasPermission) {
    return <ForbiddenPage />;
  }

  const columns: TableColumnsType<Ticket> = [
    {
      title: "工单",
      dataIndex: "ticket_no",
      width: 168,
      render: (value, record) => (
        <Space orientation="vertical" size={0}>
          <Typography.Text strong copyable>
            {value}
          </Typography.Text>
          <Typography.Text type="secondary">{formatDate(record.created_at)}</Typography.Text>
        </Space>
      ),
    },
    {
      title: "会员",
      dataIndex: "user_email",
      width: 220,
      render: (value) => <Typography.Text copyable>{value}</Typography.Text>,
    },
    {
      title: "类型",
      dataIndex: "type",
      width: 112,
      render: (value: TicketType) => typeMeta[value],
    },
    {
      title: "标题",
      dataIndex: "title",
      ellipsis: true,
    },
    {
      title: "状态",
      dataIndex: "status",
      width: 104,
      render: statusTag,
    },
    {
      title: "处理人",
      dataIndex: "handled_by_name",
      width: 120,
      render: (value) => value || "-",
    },
    {
      title: "最后消息",
      dataIndex: "last_message_at",
      width: 168,
      render: formatDate,
    },
    {
      title: "操作",
      width: 188,
      fixed: "right",
      render: (_, record) => (
        <Space>
          <Button size="small" icon={<MessageOutlined />} onClick={() => setSelectedTicketId(record.id)}>
            处理
          </Button>
          <Button
            size="small"
            disabled={record.status === "CLOSED"}
            loading={markProcessingMutation.isPending}
            onClick={() => markProcessingMutation.mutate(record.id)}
          >
            处理中
          </Button>
        </Space>
      ),
    },
  ];

  const openCount = tickets.filter((ticket) => ticket.status === "OPEN").length;
  const processingCount = tickets.filter((ticket) => ticket.status === "PROCESSING").length;
  const closedCount = tickets.filter((ticket) => ticket.status === "CLOSED").length;

  return (
    <Space direction="vertical" size={16} style={{ width: "100%" }}>
      <Row gutter={[16, 16]}>
        <Col xs={24} md={8}>
          <Card>
            <Statistic title="待处理工单" value={openCount} prefix={<MessageOutlined />} />
          </Card>
        </Col>
        <Col xs={24} md={8}>
          <Card>
            <Statistic title="处理中" value={processingCount} prefix={<SendOutlined />} />
          </Card>
        </Col>
        <Col xs={24} md={8}>
          <Card>
            <Statistic title="已关闭" value={closedCount} prefix={<CheckCircleOutlined />} />
          </Card>
        </Col>
      </Row>

      <Card
        title="客服工单"
        extra={
          <Space wrap>
            <Input
              allowClear
              prefix={<SearchOutlined />}
              placeholder="搜索单号、会员、标题"
              value={keyword}
              onChange={(event) => setKeyword(event.target.value)}
              style={{ width: 260 }}
            />
            <Button icon={<ReloadOutlined />} onClick={invalidateTickets}>
              刷新
            </Button>
          </Space>
        }
      >
        {ticketsQuery.isError && (
          <Alert type="error" message="工单数据加载失败" description={getErrorMessage(ticketsQuery.error)} showIcon />
        )}
        <Tabs
          activeKey={activeStatus}
          onChange={(key) => setActiveStatus(key as ActiveStatus)}
          items={statusTabs.map((item) => ({ key: item.key, label: item.label }))}
        />
        <Table
          rowKey="id"
          columns={columns}
          dataSource={filteredTickets}
          loading={ticketsQuery.isLoading}
          locale={{ emptyText: <Empty description="暂无工单" /> }}
          scroll={{ x: 1080 }}
          pagination={{ pageSize: 10 }}
        />
      </Card>

      <Drawer
        width={720}
        title={selectedTicket ? `${selectedTicket.ticket_no} / ${selectedTicket.title}` : "工单处理"}
        open={Boolean(selectedTicket)}
        onClose={() => setSelectedTicketId(null)}
        destroyOnHidden
      >
        {selectedTicket && (
          <Space direction="vertical" size={16} style={{ width: "100%" }}>
            <Descriptions size="small" column={2} bordered>
              <Descriptions.Item label="会员">{selectedTicket.user_email}</Descriptions.Item>
              <Descriptions.Item label="类型">{typeMeta[selectedTicket.type]}</Descriptions.Item>
              <Descriptions.Item label="状态">{statusTag(selectedTicket.status)}</Descriptions.Item>
              <Descriptions.Item label="处理人">{selectedTicket.handled_by_name || "-"}</Descriptions.Item>
              <Descriptions.Item label="创建时间">{formatDate(selectedTicket.created_at)}</Descriptions.Item>
              <Descriptions.Item label="关闭时间">{formatDate(selectedTicket.closed_at)}</Descriptions.Item>
            </Descriptions>

            <Card size="small" title="会话记录">
              <Timeline
                items={selectedTicket.messages.map((item) => ({
                  color: item.sender_type === "ADMIN" ? "blue" : "green",
                  children: (
                    <Space direction="vertical" size={4}>
                      <Space wrap>
                        <Tag color={item.sender_type === "ADMIN" ? "blue" : "green"}>
                          {item.sender_type === "ADMIN" ? "客服" : "会员"}
                        </Tag>
                        <Typography.Text strong>{item.sender_name}</Typography.Text>
                        <Typography.Text type="secondary">{formatDate(item.created_at)}</Typography.Text>
                      </Space>
                      <Typography.Paragraph style={{ marginBottom: 0, whiteSpace: "pre-wrap" }}>
                        {item.content}
                      </Typography.Paragraph>
                      {item.file_download_url && (
                        <Button
                          size="small"
                          href={item.file_download_url}
                          target="_blank"
                          rel="noreferrer"
                          icon={<FileSearchOutlined />}
                        >
                          {item.file_name || item.file_id}
                        </Button>
                      )}
                    </Space>
                  ),
                }))}
              />
            </Card>

            {selectedTicket.status !== "CLOSED" && (
              <Card size="small" title="客服回复">
                <Form
                  form={replyForm}
                  layout="vertical"
                  onFinish={(values) => replyMutation.mutate({ ticketId: selectedTicket.id, values })}
                >
                  <Form.Item name="content" label="回复内容" rules={[{ required: true, message: "请输入回复内容" }]}>
                    <Input.TextArea rows={4} placeholder="输入给会员的处理说明" />
                  </Form.Item>
                  <Form.Item label="附件">
                    <input
                      key={replyFile?.name || "empty-ticket-reply-file"}
                      type="file"
                      accept="image/jpeg,image/png,image/webp,image/gif,application/pdf"
                      onChange={(event) => setReplyFile(event.target.files?.[0] ?? null)}
                    />
                  </Form.Item>
                  <Space>
                    <Button type="primary" htmlType="submit" icon={<SendOutlined />} loading={replyMutation.isPending}>
                      发送回复
                    </Button>
                    <Button
                      icon={<CloseCircleOutlined />}
                      danger
                      loading={closeMutation.isPending}
                      onClick={() => closeForm.submit()}
                    >
                      关闭工单
                    </Button>
                  </Space>
                </Form>
                <Form
                  form={closeForm}
                  layout="vertical"
                  style={{ marginTop: 16 }}
                  onFinish={(values) => closeMutation.mutate({ ticketId: selectedTicket.id, values })}
                >
                  <Form.Item name="content" label="关闭说明">
                    <Input.TextArea rows={2} placeholder="可选，关闭时同步发送给会员" />
                  </Form.Item>
                </Form>
              </Card>
            )}
          </Space>
        )}
      </Drawer>
    </Space>
  );
}
