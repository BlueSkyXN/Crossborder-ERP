import {
  ArrowLeftOutlined,
  FileSearchOutlined,
  MessageOutlined,
  ReloadOutlined,
  SendOutlined,
} from "@ant-design/icons";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { FormEvent, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";

import { memberFilesApi } from "../features/files/api";
import { createTicket, fetchTickets, replyTicket } from "../features/tickets/api";
import type { Ticket, TicketStatus, TicketType } from "../features/tickets/types";
import styles from "./TicketsPage.module.css";

type TicketFilter = "ALL" | TicketStatus;

const ticketTypes: { value: TicketType; label: string }[] = [
  { value: "GENERAL", label: "普通咨询" },
  { value: "PARCEL", label: "包裹问题" },
  { value: "WAYBILL", label: "运单问题" },
  { value: "PURCHASE", label: "代购问题" },
  { value: "FINANCE", label: "财务问题" },
  { value: "ACCOUNT", label: "账号问题" },
];

const filterOptions: Array<{ label: string; value: TicketFilter }> = [
  { label: "全部", value: "ALL" },
  { label: "待处理", value: "OPEN" },
  { label: "处理中", value: "PROCESSING" },
  { label: "已关闭", value: "CLOSED" },
];

const statusMeta: Record<TicketStatus, { label: string; tone: string }> = {
  OPEN: { label: "待处理", tone: "open" },
  PROCESSING: { label: "处理中", tone: "processing" },
  CLOSED: { label: "已关闭", tone: "closed" },
};

function formatDate(value?: string | null) {
  if (!value) {
    return "-";
  }
  return new Date(value).toLocaleString("zh-CN", { hour12: false });
}

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : "";
}

function statusBadge(status: TicketStatus) {
  const meta = statusMeta[status];
  return <span className={`${styles.statusBadge} ${styles[meta.tone]}`}>{meta.label}</span>;
}

function typeLabel(type: TicketType) {
  return ticketTypes.find((item) => item.value === type)?.label || type;
}

function lastMessage(ticket: Ticket) {
  return ticket.messages[ticket.messages.length - 1]?.content || "";
}

export function TicketsPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [type, setType] = useState<TicketType>("GENERAL");
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [attachment, setAttachment] = useState<File | null>(null);
  const [replyContent, setReplyContent] = useState("");
  const [replyAttachment, setReplyAttachment] = useState<File | null>(null);
  const [filter, setFilter] = useState<TicketFilter>("ALL");
  const [keyword, setKeyword] = useState("");
  const [selectedTicketId, setSelectedTicketId] = useState<number | null>(null);
  const [notice, setNotice] = useState("");

  const ticketsQuery = useQuery({
    queryKey: ["member", "tickets"],
    queryFn: fetchTickets,
  });

  const tickets = useMemo(() => ticketsQuery.data ?? [], [ticketsQuery.data]);
  const selectedTicket = useMemo(
    () => tickets.find((ticket) => ticket.id === selectedTicketId) ?? tickets[0] ?? null,
    [selectedTicketId, tickets],
  );
  const filteredTickets = useMemo(() => {
    const normalized = keyword.trim().toLowerCase();
    return tickets.filter((ticket) => {
      const matchesStatus = filter === "ALL" || ticket.status === filter;
      const matchesKeyword =
        !normalized ||
        [ticket.ticket_no, ticket.title, typeLabel(ticket.type), lastMessage(ticket)]
          .join(" ")
          .toLowerCase()
          .includes(normalized);
      return matchesStatus && matchesKeyword;
    });
  }, [filter, keyword, tickets]);

  const invalidateTickets = () => queryClient.invalidateQueries({ queryKey: ["member", "tickets"] });
  const showNotice = (message: string) => {
    setNotice(message);
    window.setTimeout(() => setNotice(""), 2600);
  };

  const createMutation = useMutation({
    mutationFn: async () => {
      const normalizedTitle = title.trim();
      const normalizedContent = content.trim();
      if (!normalizedTitle) {
        throw new Error("请输入工单标题");
      }
      if (!normalizedContent) {
        throw new Error("请输入问题描述");
      }
      const fileId = attachment
        ? (await memberFilesApi.uploadFile(attachment, "MESSAGE_ATTACHMENT")).file_id
        : "";
      return createTicket({ type, title: normalizedTitle, content: normalizedContent, file_id: fileId });
    },
    onSuccess: (ticket) => {
      setSelectedTicketId(ticket.id);
      setTitle("");
      setContent("");
      setAttachment(null);
      invalidateTickets();
      showNotice(`${ticket.ticket_no} 已提交，客服会在后台处理。`);
    },
  });

  const replyMutation = useMutation({
    mutationFn: async () => {
      if (!selectedTicket) {
        throw new Error("请选择工单");
      }
      const normalizedContent = replyContent.trim();
      if (!normalizedContent) {
        throw new Error("请输入补充内容");
      }
      const fileId = replyAttachment
        ? (await memberFilesApi.uploadFile(replyAttachment, "MESSAGE_ATTACHMENT")).file_id
        : "";
      return replyTicket(selectedTicket.id, { content: normalizedContent, file_id: fileId });
    },
    onSuccess: (ticket) => {
      setSelectedTicketId(ticket.id);
      setReplyContent("");
      setReplyAttachment(null);
      invalidateTickets();
      showNotice(`${ticket.ticket_no} 已补充消息。`);
    },
  });

  const handleCreate = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    createMutation.mutate();
  };
  const handleReply = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    replyMutation.mutate();
  };

  const error = [ticketsQuery.error, createMutation.error, replyMutation.error].find((item) => item instanceof Error);
  const isLoading = ticketsQuery.isLoading;

  return (
    <main className={styles.page}>
      <header className={styles.header}>
        <button className={styles.backButton} type="button" onClick={() => navigate("/dashboard")}>
          <ArrowLeftOutlined />
          控制台
        </button>
        <div className={styles.brand}>
          <div className={styles.logo}>CB</div>
          <div>
            <strong>消息中心</strong>
            <span>工单留言、附件和客服回复</span>
          </div>
        </div>
        <button className={styles.iconButton} type="button" aria-label="刷新工单" onClick={invalidateTickets}>
          <ReloadOutlined />
        </button>
      </header>

      {notice && <div className={styles.notice}>{notice}</div>}
      {error && <div className={styles.alert}>{getErrorMessage(error) || "工单数据加载失败"}</div>}

      <section className={styles.summary}>
        <article className={styles.metric}>
          <span>待处理</span>
          <strong>{tickets.filter((ticket) => ticket.status === "OPEN").length}</strong>
        </article>
        <article className={styles.metric}>
          <span>处理中</span>
          <strong>{tickets.filter((ticket) => ticket.status === "PROCESSING").length}</strong>
        </article>
        <article className={styles.metric}>
          <span>总工单</span>
          <strong>{tickets.length}</strong>
        </article>
      </section>

      <section className={styles.workspace}>
        <form className={styles.formPanel} onSubmit={handleCreate}>
          <div className={styles.sectionTitle}>
            <div>
              <h1>创建工单</h1>
              <p>提交问题说明和必要附件。</p>
            </div>
            <MessageOutlined />
          </div>
          <label>
            问题类型
            <select value={type} onChange={(event) => setType(event.target.value as TicketType)}>
              {ticketTypes.map((item) => (
                <option key={item.value} value={item.value}>
                  {item.label}
                </option>
              ))}
            </select>
          </label>
          <label>
            标题
            <input value={title} maxLength={160} onChange={(event) => setTitle(event.target.value)} required />
          </label>
          <label>
            问题描述
            <textarea value={content} onChange={(event) => setContent(event.target.value)} required />
          </label>
          <label>
            附件
            <input
              key={attachment?.name || "ticket-empty-attachment"}
              type="file"
              accept="image/jpeg,image/png,image/webp,image/gif,application/pdf"
              onChange={(event) => setAttachment(event.target.files?.[0] ?? null)}
            />
          </label>
          <button className={styles.primaryButton} type="submit" disabled={createMutation.isPending}>
            <SendOutlined />
            {createMutation.isPending ? "提交中" : "提交工单"}
          </button>
        </form>

        <div className={styles.listPanel}>
          <div className={styles.listHead}>
            <div>
              <h2>我的工单</h2>
              <p>{filteredTickets.length} 条记录</p>
            </div>
            <MessageOutlined />
          </div>

          <div className={styles.filterBar}>
            <input value={keyword} onChange={(event) => setKeyword(event.target.value)} placeholder="搜索单号、标题或内容" />
            {filterOptions.map((option) => (
              <button
                key={option.value}
                className={filter === option.value ? styles.activeFilter : ""}
                type="button"
                onClick={() => setFilter(option.value)}
              >
                {option.label}
              </button>
            ))}
          </div>

          {isLoading && <div className={styles.loading}>加载工单数据...</div>}
          {!isLoading && filteredTickets.length === 0 && <div className={styles.empty}>暂无工单记录</div>}
          {!isLoading && filteredTickets.length > 0 && (
            <div className={styles.records}>
              {filteredTickets.map((ticket) => (
                <button
                  key={ticket.id}
                  className={`${styles.ticketCard} ${selectedTicket?.id === ticket.id ? styles.selectedCard : ""}`}
                  type="button"
                  onClick={() => setSelectedTicketId(ticket.id)}
                >
                  <div className={styles.ticketHead}>
                    <div>
                      <strong>{ticket.ticket_no}</strong>
                      <span className={styles.ticketMeta}>{formatDate(ticket.last_message_at || ticket.created_at)}</span>
                    </div>
                    {statusBadge(ticket.status)}
                  </div>
                  <p className={styles.ticketMeta}>{typeLabel(ticket.type)} / {ticket.title}</p>
                  <p className={styles.ticketMeta}>{lastMessage(ticket) || "暂无消息"}</p>
                </button>
              ))}
            </div>
          )}
        </div>

        <div className={styles.detailPanel}>
          <div className={styles.listHead}>
            <div>
              <h2>{selectedTicket?.ticket_no || "工单详情"}</h2>
              <p>{selectedTicket ? `${typeLabel(selectedTicket.type)} / ${selectedTicket.title}` : "选择左侧工单查看消息"}</p>
            </div>
            {selectedTicket && statusBadge(selectedTicket.status)}
          </div>

          {!selectedTicket && <div className={styles.empty}>暂无可查看工单</div>}
          {selectedTicket && (
            <>
              <div className={styles.messages}>
                {selectedTicket.messages.map((item) => (
                  <article
                    key={item.id}
                    className={`${styles.messageItem} ${item.sender_type === "ADMIN" ? styles.adminMessage : ""}`}
                  >
                    <div className={styles.messageHead}>
                      <strong>{item.sender_name}</strong>
                      <span>{formatDate(item.created_at)}</span>
                    </div>
                    <p>{item.content}</p>
                    {item.file_id && (
                      <a className={styles.attachmentLink} href={item.file_download_url} target="_blank" rel="noreferrer">
                        <FileSearchOutlined />
                        {item.file_name || item.file_id}
                      </a>
                    )}
                  </article>
                ))}
              </div>
              <form className={styles.replyBox} onSubmit={handleReply}>
                <label>
                  补充消息
                  <textarea
                    value={replyContent}
                    onChange={(event) => setReplyContent(event.target.value)}
                    disabled={selectedTicket.status === "CLOSED"}
                  />
                </label>
                <label>
                  补充附件
                  <input
                    key={replyAttachment?.name || "reply-empty-attachment"}
                    type="file"
                    accept="image/jpeg,image/png,image/webp,image/gif,application/pdf"
                    onChange={(event) => setReplyAttachment(event.target.files?.[0] ?? null)}
                    disabled={selectedTicket.status === "CLOSED"}
                  />
                </label>
                <button className={styles.primaryButton} type="submit" disabled={selectedTicket.status === "CLOSED" || replyMutation.isPending}>
                  <SendOutlined />
                  {replyMutation.isPending ? "发送中" : selectedTicket.status === "CLOSED" ? "工单已关闭" : "发送补充"}
                </button>
              </form>
            </>
          )}
        </div>
      </section>
    </main>
  );
}
