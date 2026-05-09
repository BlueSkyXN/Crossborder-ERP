export type ContentType = "ANNOUNCEMENT" | "HELP" | "TERMS" | "PRIVACY" | "ABOUT";

export type ContentStatus = "DRAFT" | "PUBLISHED" | "HIDDEN";

export type ContentCategoryStatus = "ACTIVE" | "DISABLED";

export type ContentCategory = {
  id: number;
  type: ContentType;
  slug: string;
  name: string;
  description: string;
  sort_order: number;
  status: ContentCategoryStatus;
  created_at: string;
  updated_at: string;
};

export type ContentPage = {
  id: number;
  category: number | null;
  category_name: string | null;
  type: ContentType;
  slug: string;
  title: string;
  summary: string;
  body: string;
  status: ContentStatus;
  sort_order: number;
  published_at: string | null;
  created_by_name: string | null;
  updated_by_name: string | null;
  created_at: string;
  updated_at: string;
};

export type ContentCategoryPayload = {
  type: ContentType;
  slug: string;
  name: string;
  description?: string;
  sort_order?: number;
  status?: ContentCategoryStatus;
};

export type ContentPagePayload = {
  category_id?: number | null;
  type: ContentType;
  slug: string;
  title: string;
  summary?: string;
  body: string;
  status?: ContentStatus;
  sort_order?: number;
  published_at?: string | null;
};
