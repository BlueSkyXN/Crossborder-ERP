import { requestData } from "../../api/client";
import type {
  AddCartItemPayload,
  CartItem,
  ManualPurchaseOrderCreatePayload,
  Product,
  PurchaseOrder,
  PurchaseOrderCreatePayload,
  PurchasePayPayload,
  PurchasePayResult,
  UpdateCartItemPayload,
} from "./types";
import type { Wallet, WalletTransaction } from "../waybills/types";

type ListResponse<T> = {
  items: T[];
};

function listItems<T>(url: string) {
  return requestData<ListResponse<T>>({ method: "GET", url }).then((result) => result.items);
}

export function fetchProducts() {
  return listItems<Product>("/products");
}

export function fetchProduct(productId: number) {
  return requestData<Product>({ method: "GET", url: `/products/${productId}` });
}

export function fetchCartItems() {
  return listItems<CartItem>("/cart-items");
}

export function addCartItem(payload: AddCartItemPayload) {
  return requestData<CartItem>({ method: "POST", url: "/cart-items", data: payload });
}

export function updateCartItem(cartItemId: number, payload: UpdateCartItemPayload) {
  return requestData<CartItem>({
    method: "PATCH",
    url: `/cart-items/${cartItemId}`,
    data: payload,
  });
}

export function deleteCartItem(cartItemId: number) {
  return requestData<{ deleted: boolean }>({ method: "DELETE", url: `/cart-items/${cartItemId}` });
}

export function createPurchaseOrder(payload: PurchaseOrderCreatePayload) {
  return requestData<PurchaseOrder>({ method: "POST", url: "/purchase-orders", data: payload });
}

export function createManualPurchaseOrder(payload: ManualPurchaseOrderCreatePayload) {
  return requestData<PurchaseOrder>({ method: "POST", url: "/purchase-orders/manual", data: payload });
}

export function fetchPurchaseOrders() {
  return listItems<PurchaseOrder>("/purchase-orders");
}

export function fetchPurchaseOrder(purchaseOrderId: number) {
  return requestData<PurchaseOrder>({ method: "GET", url: `/purchase-orders/${purchaseOrderId}` });
}

export function payPurchaseOrder(purchaseOrderId: number, payload: PurchasePayPayload) {
  return requestData<PurchasePayResult>({
    method: "POST",
    url: `/purchase-orders/${purchaseOrderId}/pay`,
    data: payload,
  });
}

export function fetchPurchaseWallet() {
  return requestData<Wallet>({ method: "GET", url: "/wallet" });
}

export function fetchPurchaseWalletTransactions() {
  return listItems<WalletTransaction>("/wallet/transactions");
}
