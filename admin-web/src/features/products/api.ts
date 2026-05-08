import { requestData } from "../../api/client";
import type {
  Product,
  ProductCategory,
  ProductCategoryPayload,
  ProductPayload,
  ProductSku,
  ProductSkuPayload,
} from "./types";

type ListResponse<T> = {
  items: T[];
};

function listItems<T>(url: string) {
  return requestData<ListResponse<T>>({ method: "GET", url }).then((result) => result.items);
}

export const productCatalogApi = {
  listCategories: () => listItems<ProductCategory>("/admin/product-categories"),
  createCategory: (payload: ProductCategoryPayload) =>
    requestData<ProductCategory>({ method: "POST", url: "/admin/product-categories", data: payload }),
  updateCategory: (id: number, payload: ProductCategoryPayload) =>
    requestData<ProductCategory>({ method: "PATCH", url: `/admin/product-categories/${id}`, data: payload }),
  disableCategory: (id: number) =>
    requestData<ProductCategory>({ method: "DELETE", url: `/admin/product-categories/${id}` }),

  listProducts: () => listItems<Product>("/admin/products"),
  createProduct: (payload: ProductPayload) =>
    requestData<Product>({ method: "POST", url: "/admin/products", data: payload }),
  updateProduct: (id: number, payload: ProductPayload) =>
    requestData<Product>({ method: "PATCH", url: `/admin/products/${id}`, data: payload }),
  disableProduct: (id: number) =>
    requestData<Product>({ method: "DELETE", url: `/admin/products/${id}` }),

  listSkus: () => listItems<ProductSku>("/admin/product-skus"),
  createSku: (payload: ProductSkuPayload) =>
    requestData<ProductSku>({ method: "POST", url: "/admin/product-skus", data: payload }),
  updateSku: (id: number, payload: ProductSkuPayload) =>
    requestData<ProductSku>({ method: "PATCH", url: `/admin/product-skus/${id}`, data: payload }),
  disableSku: (id: number) => requestData<ProductSku>({ method: "DELETE", url: `/admin/product-skus/${id}` }),
};
