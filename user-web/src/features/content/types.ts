export type ContentType = "ANNOUNCEMENT" | "HELP" | "TERMS" | "PRIVACY" | "ABOUT";

export type ContentCategory = {
  id: number;
  type: ContentType;
  slug: string;
  name: string;
  description: string;
  sort_order: number;
  status: string;
  created_at: string;
  updated_at: string;
};

export type ContentPageSummary = {
  id: number;
  category_slug: string | null;
  category_name: string | null;
  type: ContentType;
  slug: string;
  title: string;
  summary: string;
  sort_order: number;
  published_at: string | null;
};

export type ContentPageDetail = ContentPageSummary & {
  body: string;
  updated_at: string;
};
