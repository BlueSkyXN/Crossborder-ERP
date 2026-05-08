export type TicketType = "GENERAL" | "PARCEL" | "WAYBILL" | "PURCHASE" | "FINANCE" | "ACCOUNT";

export type TicketStatus = "OPEN" | "PROCESSING" | "CLOSED";

export type TicketMessage = {
  id: number;
  sender_type: "MEMBER" | "ADMIN";
  sender_name: string;
  content: string;
  file_id: string;
  file_name: string;
  file_download_url: string;
  created_at: string;
};

export type Ticket = {
  id: number;
  ticket_no: string;
  user: number;
  user_email: string;
  type: TicketType;
  status: TicketStatus;
  title: string;
  handled_by_name: string | null;
  closed_at: string | null;
  last_message_at: string | null;
  created_at: string;
  updated_at: string;
  messages: TicketMessage[];
};

export type TicketCreatePayload = {
  type: TicketType;
  title: string;
  content: string;
  file_id?: string;
};

export type TicketMessagePayload = {
  content: string;
  file_id?: string;
};
