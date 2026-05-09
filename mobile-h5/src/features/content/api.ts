import { requestData } from "../../api/client";
import type { ContentCategory, ContentPageDetail, ContentPageSummary, ContentType } from "./types";

type ListResponse<T> = {
  items: T[];
};

export type ContentPageQuery = {
  type?: ContentType;
  category_slug?: string;
  keyword?: string;
};

export function fetchContentCategories(type?: ContentType) {
  return requestData<ListResponse<ContentCategory>>({
    method: "GET",
    url: "/content/categories",
    params: type ? { type } : undefined,
  }).then((result) => result.items);
}

export function fetchContentPages(query: ContentPageQuery = {}) {
  return requestData<ListResponse<ContentPageSummary>>({
    method: "GET",
    url: "/content/pages",
    params: {
      type: query.type,
      category_slug: query.category_slug || undefined,
      keyword: query.keyword?.trim() || undefined,
    },
  }).then((result) => result.items);
}

export function fetchContentPage(slug: string) {
  return requestData<ContentPageDetail>({
    method: "GET",
    url: `/content/pages/${slug}`,
  });
}
