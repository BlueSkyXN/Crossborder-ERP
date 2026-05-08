export type Warehouse = {
  id: number;
  code: string;
  name: string;
  country: string;
  city: string;
  status: "ACTIVE" | "DISABLED";
  address?: {
    address_line: string;
    receiver_name: string;
    phone: string;
    postal_code: string;
  };
};

export type WarehouseAddress = {
  warehouse_code: string;
  warehouse_name: string;
  member_warehouse_code: string;
  receiver_name: string;
  phone: string;
  postal_code: string;
  address_line: string;
  full_address: string;
};
