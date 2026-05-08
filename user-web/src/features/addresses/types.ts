export type AddressStatus = "ACTIVE" | "INACTIVE";

export type Address = {
  id: number;
  user: number;
  recipient_name: string;
  phone: string;
  country: string;
  region: string;
  city: string;
  postal_code: string;
  address_line: string;
  company: string;
  is_default: boolean;
  status: AddressStatus;
  full_address: string;
  created_at: string;
  updated_at: string;
};

export type AddressPayload = {
  recipient_name: string;
  phone: string;
  country: string;
  region?: string;
  city?: string;
  postal_code?: string;
  address_line: string;
  company?: string;
  is_default?: boolean;
};
