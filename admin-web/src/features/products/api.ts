import { requestData } from "../../api/client";
import type {
  Product,
  ProductAttribute,
  ProductAttributeListParams,
  ProductAttributePayload,
  ProductAttributeValue,
  ProductAttributeValuePayload,
  ProductCategory,
  ProductCategoryPayload,
  ProductPayload,
  ProductSku,
  ProductSkuPayload,
  ProductTranslation,
  ProductTranslationPayload,
} from "./types";

type ListResponse<T> = {
  items: T[];
};

function listItems<T>(url: string) {
  return requestData<ListResponse<T>>({ method: "GET", url }).then((result) => result.items);
}

function listItemsWithParams<T>(url: string, params?: Record<string, unknown>) {
  return requestData<ListResponse<T>>({ method: "GET", url, params }).then((result) => result.items);
}

export const fetchProductTranslations = (productId: number) =>
  listItems<ProductTranslation>(`/admin/products/${productId}/translations`);

export const createProductTranslation = (productId: number, data: ProductTranslationPayload) =>
  requestData<ProductTranslation>({ method: "POST", url: `/admin/products/${productId}/translations`, data });

export const updateProductTranslation = (
  productId: number,
  translationId: number,
  data: ProductTranslationPayload,
) =>
  requestData<ProductTranslation>({
    method: "PUT",
    url: `/admin/products/${productId}/translations/${translationId}`,
    data,
  });

export const deleteProductTranslation = (productId: number, translationId: number) =>
  requestData<ProductTranslation>({
    method: "DELETE",
    url: `/admin/products/${productId}/translations/${translationId}`,
  });

export const fetchProductAttributes = (params?: ProductAttributeListParams) =>
  listItemsWithParams<ProductAttribute>("/admin/product-attributes", params);

export const createProductAttribute = (data: ProductAttributePayload) =>
  requestData<ProductAttribute>({ method: "POST", url: "/admin/product-attributes", data });

export const updateProductAttribute = (id: number, data: ProductAttributePayload) =>
  requestData<ProductAttribute>({ method: "PUT", url: `/admin/product-attributes/${id}`, data });

export const deleteProductAttribute = (id: number) =>
  requestData<ProductAttribute>({ method: "DELETE", url: `/admin/product-attributes/${id}` });

export const fetchProductAttrValues = (productId: number) =>
  listItems<ProductAttributeValue>(`/admin/products/${productId}/attribute-values`);

export const setProductAttrValue = (productId: number, data: ProductAttributeValuePayload) =>
  requestData<ProductAttributeValue>({ method: "POST", url: `/admin/products/${productId}/attribute-values`, data });

export const deleteProductAttrValue = (productId: number, valueId: number) =>
  requestData<ProductAttributeValue>({
    method: "DELETE",
    url: `/admin/products/${productId}/attribute-values/${valueId}`,
  });

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

  fetchProductTranslations,
  createProductTranslation,
  updateProductTranslation,
  deleteProductTranslation,
  fetchProductAttributes,
  createProductAttribute,
  updateProductAttribute,
  deleteProductAttribute,
  fetchProductAttrValues,
  setProductAttrValue,
  deleteProductAttrValue,
};
