import { DotLoading, ErrorBlock } from "antd-mobile";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";

import { memberFilesApi } from "../features/files/api";
import { createTicket, fetchTickets, replyTicket } from "../features/tickets/api";
import type { Ticket, TicketStatus, TicketType } from "../features/tickets/types";
import styles from "./TicketsMobilePage.module.css";

type TicketFilter = "ALL" | TicketStatus;

const ticketTypes: { value: TicketType; label: string }[] = [
  { value: "GENERAL", label: "普通咨询" },
  { value: "PARCEL", label: "包裹问题" },
  { value: "WAYBILL", label: "运单问题" },
  { value: "PURCHASE", label: "代购问题" },
  { value: "FINANCE", label: "财务问题" },
  { value: "ACCOUNT", label: "账号问题" },
];

const filters: { value: TicketFilter; label: string }[] = [
  { value: "ALL", label: "全部" },
  { value: "OPEN", label: "待处理" },
  { value: "PROCESSING", label: "处理中" },
  { value: "CLOSED", label: "已关闭" },
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

function statusBadge(status: TicketStatus) {
  const meta = statusMeta[status];
  return <span className={`${styles.badge} ${styles[meta.tone]}`}>{meta.label}</span>;
}

function typeLabel(type: TicketType) {
  return ticketTypes.find((item) => item.value === type)?.label || type;
}

function lastMessage(ticket: Ticket) {
  return ticket.messages[ticket.messages.length - 1]?.content || "";
}

export function TicketsMobilePage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [type, setType] = useState<TicketType>("GENERAL");
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [attachment, setAttachment] = useState<File | null>(null);
  const [filter, setFilter] = useState<TicketFilter>("ALL");
  const [selectedTicketId, setSelectedTicketId] = useState<number | null>(null);
  const [replyContent, setReplyContent] = useState("");
  const [replyAttachment, setReplyAttachment] = useState<File | null>(null);
  const [formError, setFormError] = useState("");
  const [notice, setNotice] = useState("");

  const ticketsQuery = useQuery({
    queryKey: ["mobile", "member", "tickets"],
    queryFn: fetchTickets,
  });

  const tickets = useMemo(() => ticketsQuery.data ?? [], [ticketsQuery.data]);
  const selectedTicket = useMemo(
    () => tickets.find((ticket) => ticket.id === selectedTicketId) ?? tickets[0] ?? null,
    [selectedTicketId, tickets],
  );
  const filteredTickets = useMemo(
    () => tickets.filter((ticket) => filter === "ALL" || ticket.status === filter),
    [filter, tickets],
  );
  const isLoading = ticketsQuery.isLoading;
  const hasError = ticketsQuery.isError;

  const invalidateTickets = () => queryClient.invalidateQueries({ queryKey: ["mobile", "member", "tickets"] });
  const showNotice = (message: string) => {
    setNotice(message);
    window.setTimeout(() => setNotice(""), 2400);
  };

  const createMutation = useMutation({
    mutationFn: async () => {
      const normalizedTitle = title.trim();
      const normalizedContent = content.trim();
      if (!normalizedTitle) {
        throw new Error("请输入标题");
      }
      if (!normalizedContent) {
        throw new Error("请输入问题描述");
      }
      const uploaded = attachment
        ? await memberFilesApi.uploadFile(attachment, "MESSAGE_ATTACHMENT")
        : null;
      return createTicket({
        type,
        title: normalizedTitle,
        content: normalizedContent,
        file_id: uploaded?.file_id || "",
      });
    },
    onSuccess: (ticket) => {
      setSelectedTicketId(ticket.id);
      setTitle("");
      setContent("");
      setAttachment(null);
      setFormError("");
      invalidateTickets();
      showNotice("工单已提交");
    },
    onError: (error) => setFormError(error instanceof Error ? error.message : "提交失败"),
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
      const uploaded = replyAttachment
        ? await memberFilesApi.uploadFile(replyAttachment, "MESSAGE_ATTACHMENT")
        : null;
      return replyTicket(selectedTicket.id, {
        content: normalizedContent,
        file_id: uploaded?.file_id || "",
      });
    },
    onSuccess: (ticket) => {
      setSelectedTicketId(ticket.id);
      setReplyContent("");
      setReplyAttachment(null);
      setFormError("");
      invalidateTickets();
      showNotice("消息已补充");
    },
    onError: (error) => setFormError(error instanceof Error ? error.message : "发送失败"),
  });

  return (
    <main className={styles.page}>
      <header className={styles.top}>
        <button type="button" onClick={() => navigate("/me")}>
          我的
        </button>
        <div>
          <span>Support</span>
          <h1>消息工单</h1>
        </div>
        <button type="button" onClick={invalidateTickets}>
          刷新
        </button>
      </header>

      {isLoading && (
        <div className={styles.loading}>
          <DotLoading />
          <span>加载工单数据</span>
        </div>
      )}
      {hasError && <ErrorBlock status="default" title="工单数据加载失败" description="请刷新后重试" />}
      {notice && <div className={styles.notice}>{notice}</div>}
      {formError && <div className={styles.error}>{formError}</div>}

      <section className={styles.summary}>
        <div>
          <span>待处理</span>
          <strong>{tickets.filter((ticket) => ticket.status === "OPEN").length}</strong>
        </div>
        <div>
          <span>处理中</span>
          <strong>{tickets.filter((ticket) => ticket.status === "PROCESSING").length}</strong>
        </div>
        <div>
          <span>总工单</span>
          <strong>{tickets.length}</strong>
        </div>
      </section>

      <form
        className={styles.panel}
        onSubmit={(event) => {
          event.preventDefault();
          createMutation.mutate();
        }}
      >
        <div className={styles.sectionHead}>
          <span>Create</span>
          <h2>创建工单</h2>
          <p>上传图片或 PDF 附件，客服回复后会显示在下方记录。</p>
        </div>
        <div className={styles.form}>
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
            <input value={title} onChange={(event) => setTitle(event.target.value)} maxLength={160} />
          </label>
          <label>
            问题描述
            <textarea rows={3} value={content} onChange={(event) => setContent(event.target.value)} />
          </label>
          <label>
            附件
            <input
              key={attachment?.name || "mobile-ticket-empty"}
              type="file"
              accept="image/jpeg,image/png,image/webp,image/gif,application/pdf"
              onChange={(event) => setAttachment(event.target.files?.[0] ?? null)}
            />
          </label>
        </div>
        <button className={styles.primaryButton} type="submit" disabled={createMutation.isPending}>
          {createMutation.isPending ? "提交中..." : "提交工单"}
        </button>
      </form>

      <section className={styles.panel}>
        <div className={styles.sectionHead}>
          <span>Tickets</span>
          <h2>工单记录</h2>
        </div>
        <div className={styles.filters}>
          {filters.map((item) => (
            <button
              key={item.value}
              className={filter === item.value ? styles.activeFilter : ""}
              type="button"
              onClick={() => setFilter(item.value)}
            >
              {item.label}
            </button>
          ))}
        </div>
        {filteredTickets.length === 0 ? (
          <div className={styles.empty}>暂无工单记录</div>
        ) : (
          <div className={styles.list}>
            {filteredTickets.map((ticket) => (
              <button
                key={ticket.id}
                className={`${styles.card} ${selectedTicket?.id === ticket.id ? styles.selected : ""}`}
                type="button"
                onClick={() => setSelectedTicketId(ticket.id)}
              >
                <div className={styles.cardHead}>
                  <strong>{ticket.ticket_no}</strong>
                  {statusBadge(ticket.status)}
                </div>
                <span>{typeLabel(ticket.type)} / {formatDate(ticket.last_message_at || ticket.created_at)}</span>
                <p>{ticket.title}</p>
                <small>{lastMessage(ticket) || "暂无消息"}</small>
              </button>
            ))}
          </div>
        )}
      </section>

      {selectedTicket && (
        <section className={styles.panel}>
          <div className={styles.sectionHead}>
            <span>Thread</span>
            <h2>{selectedTicket.title}</h2>
            <p>{selectedTicket.ticket_no} / {typeLabel(selectedTicket.type)}</p>
          </div>
          <div className={styles.messages}>
            {selectedTicket.messages.map((item) => (
              <article
                key={item.id}
                className={`${styles.messageCard} ${item.sender_type === "ADMIN" ? styles.adminMessage : ""}`}
              >
                <div className={styles.messageHead}>
                  <strong>{item.sender_name}</strong>
                  <span>{formatDate(item.created_at)}</span>
                </div>
                <p>{item.content}</p>
                {item.file_id && (
                  <a className={styles.attachment} href={item.file_download_url} target="_blank" rel="noreferrer">
                    {item.file_name || item.file_id}
                  </a>
                )}
              </article>
            ))}
          </div>
          <form
            className={styles.form}
            onSubmit={(event) => {
              event.preventDefault();
              replyMutation.mutate();
            }}
          >
            <label>
              补充消息
              <textarea
                rows={3}
                value={replyContent}
                onChange={(event) => setReplyContent(event.target.value)}
                disabled={selectedTicket.status === "CLOSED"}
              />
            </label>
            <label>
              补充附件
              <input
                key={replyAttachment?.name || "mobile-ticket-reply-empty"}
                type="file"
                accept="image/jpeg,image/png,image/webp,image/gif,application/pdf"
                onChange={(event) => setReplyAttachment(event.target.files?.[0] ?? null)}
                disabled={selectedTicket.status === "CLOSED"}
              />
            </label>
            <button
              className={styles.primaryButton}
              type="submit"
              disabled={selectedTicket.status === "CLOSED" || replyMutation.isPending}
            >
              {replyMutation.isPending ? "发送中..." : selectedTicket.status === "CLOSED" ? "工单已关闭" : "发送补充"}
            </button>
          </form>
        </section>
      )}
    </main>
  );
}
