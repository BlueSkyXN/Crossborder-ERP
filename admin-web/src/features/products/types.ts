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

export type ProductTranslation = {
  id: number;
  product: number;
  language_code: string;
  title: string;
  description_rich: string;
  created_at?: string;
  updated_at?: string;
};

export type ProductTranslationPayload = {
  language_code: string;
  title: string;
  description_rich?: string;
};

export type ProductAttributeType = "TEXT" | "NUMBER" | "ENUM" | "BOOLEAN";

export type ProductAttribute = {
  id: number;
  name: string;
  attr_type: ProductAttributeType | string;
  category: number | null;
  category_name?: string | null;
  is_filterable: boolean;
  sort_order: number;
  is_active: boolean;
  created_at?: string;
  updated_at?: string;
};

export type ProductAttributePayload = {
  name: string;
  attr_type: ProductAttributeType | string;
  category_id?: number | null;
  is_filterable?: boolean;
  sort_order?: number;
  is_active?: boolean;
};

export type ProductAttributeListParams = {
  category_id?: number | null;
};

export type ProductAttributeValue = {
  id: number;
  product: number;
  attribute: number;
  attribute_name?: string;
  value: string;
  sort_order: number;
  created_at?: string;
};

export type ProductAttributeValuePayload = {
  attribute_id: number;
  value: string;
  sort_order?: number;
};
