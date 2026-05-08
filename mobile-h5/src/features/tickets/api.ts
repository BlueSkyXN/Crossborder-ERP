import { requestData } from "../../api/client";
import type { Ticket, TicketCreatePayload, TicketReplyPayload } from "./types";

type ListResponse<T> = {
  items: T[];
};

function listItems<T>(url: string) {
  return requestData<ListResponse<T>>({ method: "GET", url }).then((result) => result.items);
}

export function fetchTickets() {
  return listItems<Ticket>("/tickets");
}

export function createTicket(payload: TicketCreatePayload) {
  return requestData<Ticket>({ method: "POST", url: "/tickets", data: payload });
}

export function replyTicket(ticketId: number, payload: TicketReplyPayload) {
  return requestData<Ticket>({ method: "POST", url: `/tickets/${ticketId}/messages`, data: payload });
}
