export type ConfigStatus = "ACTIVE" | "DISABLED";

export type WarehouseAddress = {
  address_line: string;
  receiver_name: string;
  phone: string;
  postal_code: string;
};

export type Warehouse = {
  id: number;
  code: string;
  name: string;
  country: string;
  city: string;
  status: ConfigStatus;
  address?: WarehouseAddress;
};

export type WarehousePayload = Omit<Warehouse, "id">;

export type ShippingChannel = {
  id: number;
  code: string;
  name: string;
  status: ConfigStatus;
  billing_method: string;
};

export type ShippingChannelPayload = Omit<ShippingChannel, "id">;

export type PackagingMethod = {
  id: number;
  code: string;
  name: string;
  price: string;
  is_default: boolean;
  status: ConfigStatus;
};

export type PackagingMethodPayload = Omit<PackagingMethod, "id">;

export type ValueAddedService = {
  id: number;
  code: string;
  name: string;
  price: string;
  status: ConfigStatus;
};

export type ValueAddedServicePayload = Omit<ValueAddedService, "id">;

export type RatePlan = {
  id: number;
  channel: number;
  name: string;
  rule_json: Record<string, unknown>;
  status: ConfigStatus;
};

export type RatePlanPayload = Omit<RatePlan, "id">;
