export type CatalogStatus = "ACTIVE" | "DISABLED";

export type ProductCategory = {
  id: number;
  parent: number | null;
  parent_name: string | null;
  name: string;
  sort_order: number;
  status: CatalogStatus;
  created_at: string;
  updated_at: string;
};

export type ProductSku = {
  id: number;
  product: number;
  product_title: string;
  sku_code: string;
  spec_json: Record<string, unknown>;
  price: string;
  stock: number;
  status: CatalogStatus;
  created_at: string;
  updated_at: string;
};

export type Product = {
  id: number;
  category: number | null;
  category_name: string | null;
  title: string;
  description: string;
  status: CatalogStatus;
  main_image_file_id: string;
  skus: ProductSku[];
  created_at: string;
  updated_at: string;
};

export type ProductCategoryPayload = {
  parent_id?: number | null;
  name: string;
  sort_order?: number;
  status?: CatalogStatus;
};

export type ProductPayload = {
  category_id?: number | null;
  title: string;
  description?: string;
  status?: CatalogStatus;
  main_image_file_id?: string;
};

export type ProductSkuPayload = {
  product_id: number;
  sku_code: string;
  spec_json?: Record<string, unknown>;
  price: string;
  stock?: number;
  status?: CatalogStatus;
};
