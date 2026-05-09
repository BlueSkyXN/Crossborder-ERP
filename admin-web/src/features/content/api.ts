import { requestData } from "../../api/client";
import type { ContentCategory, ContentCategoryPayload, ContentPage, ContentPagePayload } from "./types";

type ListResponse<T> = {
  items: T[];
};

function listItems<T>(url: string) {
  return requestData<ListResponse<T>>({ method: "GET", url }).then((result) => result.items);
}

export const contentCmsApi = {
  listCategories: () => listItems<ContentCategory>("/admin/content/categories"),
  createCategory: (payload: ContentCategoryPayload) =>
    requestData<ContentCategory>({ method: "POST", url: "/admin/content/categories", data: payload }),
  updateCategory: (categoryId: number, payload: ContentCategoryPayload) =>
    requestData<ContentCategory>({ method: "PATCH", url: `/admin/content/categories/${categoryId}`, data: payload }),
  disableCategory: (categoryId: number) =>
    requestData<ContentCategory>({ method: "DELETE", url: `/admin/content/categories/${categoryId}` }),

  listPages: () => listItems<ContentPage>("/admin/content/pages"),
  createPage: (payload: ContentPagePayload) =>
    requestData<ContentPage>({ method: "POST", url: "/admin/content/pages", data: payload }),
  updatePage: (pageId: number, payload: ContentPagePayload) =>
    requestData<ContentPage>({ method: "PATCH", url: `/admin/content/pages/${pageId}`, data: payload }),
  hidePage: (pageId: number) => requestData<ContentPage>({ method: "POST", url: `/admin/content/pages/${pageId}/hide` }),
  publishPage: (pageId: number) =>
    requestData<ContentPage>({ method: "POST", url: `/admin/content/pages/${pageId}/publish` }),
};
