import { requestData } from "../../api/client";
import type { Ticket, TicketClosePayload, TicketReplyPayload } from "./types";

type ListResponse<T> = {
  items: T[];
};

function listItems<T>(url: string) {
  return requestData<ListResponse<T>>({ method: "GET", url }).then((result) => result.items);
}

export const ticketOpsApi = {
  listTickets: () => listItems<Ticket>("/admin/tickets"),
  getTicket: (ticketId: number) => requestData<Ticket>({ method: "GET", url: `/admin/tickets/${ticketId}` }),
  markProcessing: (ticketId: number) =>
    requestData<Ticket>({ method: "POST", url: `/admin/tickets/${ticketId}/mark-processing` }),
  replyTicket: (ticketId: number, payload: TicketReplyPayload) =>
    requestData<Ticket>({ method: "POST", url: `/admin/tickets/${ticketId}/reply`, data: payload }),
  closeTicket: (ticketId: number, payload: TicketClosePayload) =>
    requestData<Ticket>({ method: "POST", url: `/admin/tickets/${ticketId}/close`, data: payload }),
};
