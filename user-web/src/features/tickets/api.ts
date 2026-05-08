import { requestData } from "../../api/client";
import { memberFilesApi } from "../files/api";
import type { Ticket, TicketCreatePayload, TicketMessagePayload } from "./types";

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

export function addTicketMessage(ticketId: number, payload: TicketMessagePayload) {
  return requestData<Ticket>({ method: "POST", url: `/tickets/${ticketId}/messages`, data: payload });
}

export const replyTicket = addTicketMessage;

export function uploadTicketAttachment(file: File) {
  return memberFilesApi.uploadFile(file, "MESSAGE_ATTACHMENT");
}
