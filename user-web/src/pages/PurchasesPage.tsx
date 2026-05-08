import {
  ArrowLeftOutlined,
  CheckCircleOutlined,
  DeleteOutlined,
  FileSearchOutlined,
  InboxOutlined,
  LogoutOutlined,
  PlusOutlined,
  ReloadOutlined,
  SendOutlined,
  ShoppingCartOutlined,
  WalletOutlined,
} from "@ant-design/icons";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { FormEvent, useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";

import { fetchMe } from "../features/auth/api";
import { useAuthStore } from "../features/auth/store";
import {
  addCartItem,
  createManualPurchaseOrder,
  createPurchaseOrder,
  deleteCartItem,
  fetchCartItems,
  fetchProducts,
  fetchPurchaseOrders,
  fetchPurchaseWallet,
  fetchPurchaseWalletTransactions,
  payPurchaseOrder,
  updateCartItem,
} from "../features/purchases/api";
import type {
  CartItem,
  ManualPurchaseOrderCreatePayload,
  Product,
  PurchaseOrder,
  PurchaseOrderStatus,
} from "../features/purchases/types";
import styles from "./PurchasesPage.module.css";

type ActiveTab = "shop" | "cart" | "manual" | "orders";
type OrderStatusFilter = "ALL" | PurchaseOrderStatus;

type ManualLine = {
  id: number;
  name: string;
  product_url: string;
  unit_price: string;
  quantity: string;
  remark: string;
};

const orderStatusMeta: Record<PurchaseOrderStatus, { label: string; tone: string }> = {
  PENDING_PAYMENT: { label: "待付款", tone: "danger" },
  PENDING_REVIEW: { label: "待审核", tone: "warning" },
  PENDING_PROCUREMENT: { label: "待采购", tone: "info" },
  PROCURED: { label: "已采购", tone: "primary" },
  ARRIVED: { label: "已到货", tone: "primary" },
  COMPLETED: { label: "已完成", tone: "success" },
  CANCELLED: { label: "已取消", tone: "muted" },
  EXCEPTION: { label: "异常单", tone: "danger" },
};

const orderStatusFilters: Array<{ label: string; value: OrderStatusFilter }> = [
  { label: "全部", value: "ALL" },
  { label: "待付款", value: "PENDING_PAYMENT" },
  { label: "待审核", value: "PENDING_REVIEW" },
  { label: "待采购", value: "PENDING_PROCUREMENT" },
  { label: "已采购", value: "PROCURED" },
  { label: "已完成", value: "COMPLETED" },
];

const tabMeta: Array<{ value: ActiveTab; label: string }> = [
  { value: "shop", label: "商品" },
  { value: "cart", label: "购物车" },
  { value: "manual", label: "手工代购" },
  { value: "orders", label: "订单" },
];

const pageSize = 6;

function tabFromLocation(pathname: string, search: string): ActiveTab {
  const params = new URLSearchParams(search);
  if (params.get("tab") === "manual") {
    return "manual";
  }
  if (pathname.startsWith("/cart")) {
    return "cart";
  }
  if (pathname.startsWith("/purchases")) {
    return "orders";
  }
  return "shop";
}

function tabPath(tab: ActiveTab) {
  if (tab === "cart") {
    return "/cart";
  }
  if (tab === "manual") {
    return "/purchases?tab=manual";
  }
  if (tab === "orders") {
    return "/purchases";
  }
  return "/products";
}

function formatDate(value?: string | null) {
  if (!value) {
    return "-";
  }
  return new Date(value).toLocaleString("zh-CN", { hour12: false });
}

function formatMoney(value?: string | null, currency = "CNY") {
  if (!value) {
    return `${currency} 0.00`;
  }
  return `${currency} ${value}`;
}

function formatSpec(spec: Record<string, unknown>) {
  const entries = Object.entries(spec);
  if (entries.length === 0) {
    return "默认规格";
  }
  return entries.map(([key, value]) => `${key}: ${String(value)}`).join(" / ");
}

function sumCartItems(items: CartItem[]) {
  return items.reduce((total, item) => total + Number(item.sku_price || 0) * item.quantity, 0);
}

function sumManualItems(items: ManualLine[]) {
  return items.reduce((total, item) => total + Number(item.unit_price || 0) * Number(item.quantity || 0), 0);
}

function compareMoney(left: string, right: string) {
  return Number(left || 0) - Number(right || 0);
}

function statusBadge(status: PurchaseOrderStatus) {
  const meta = orderStatusMeta[status];
  return <span className={`${styles.statusBadge} ${styles[meta.tone]}`}>{meta.label}</span>;
}

function firstActiveSku(product: Product | null) {
  return product?.skus.find((sku) => sku.status === "ACTIVE" && sku.stock > 0) ?? product?.skus[0] ?? null;
}

function buildManualPayload(items: ManualLine[], serviceFee: string): ManualPurchaseOrderCreatePayload {
  return {
    service_fee: serviceFee || "0.00",
    items: items
      .filter((item) => item.name.trim())
      .map((item) => ({
        name: item.name.trim(),
        product_url: item.product_url.trim(),
        unit_price: item.unit_price || "0.00",
        quantity: Number(item.quantity || 1),
        remark: item.remark.trim(),
      })),
  };
}

function manualLine(id: number): ManualLine {
  return {
    id,
    name: "",
    product_url: "",
    unit_price: "0.00",
    quantity: "1",
    remark: "",
  };
}

export function PurchasesPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const queryClient = useQueryClient();
  const logout = useAuthStore((state) => state.logout);
  const persistedUser = useAuthStore((state) => state.user);
  const setUser = useAuthStore((state) => state.setUser);
  const [productKeyword, setProductKeyword] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("ALL");
  const [selectedProductId, setSelectedProductId] = useState<number | null>(null);
  const [selectedSkuId, setSelectedSkuId] = useState<number | null>(null);
  const [productQuantity, setProductQuantity] = useState("1");
  const [selectedCartItemIds, setSelectedCartItemIds] = useState<number[] | null>(null);
  const [cartServiceFee, setCartServiceFee] = useState("0.00");
  const [manualItems, setManualItems] = useState<ManualLine[]>(() => [manualLine(Date.now())]);
  const [manualServiceFee, setManualServiceFee] = useState("0.00");
  const [orderStatusFilter, setOrderStatusFilter] = useState<OrderStatusFilter>("ALL");
  const [orderKeyword, setOrderKeyword] = useState("");
  const [orderPage, setOrderPage] = useState(1);
  const [selectedOrderId, setSelectedOrderId] = useState<number | null>(null);
  const [payOrderId, setPayOrderId] = useState<number | null>(null);
  const [notice, setNotice] = useState("");

  const meQuery = useQuery({
    queryKey: ["member", "me"],
    queryFn: fetchMe,
  });
  const productsQuery = useQuery({
    queryKey: ["member", "products"],
    queryFn: fetchProducts,
  });
  const cartQuery = useQuery({
    queryKey: ["member", "cart-items"],
    queryFn: fetchCartItems,
  });
  const ordersQuery = useQuery({
    queryKey: ["member", "purchase-orders"],
    queryFn: fetchPurchaseOrders,
  });
  const walletQuery = useQuery({
    queryKey: ["member", "purchase-wallet"],
    queryFn: fetchPurchaseWallet,
  });
  const walletTransactionsQuery = useQuery({
    queryKey: ["member", "purchase-wallet-transactions"],
    queryFn: fetchPurchaseWalletTransactions,
  });

  const products = useMemo(() => productsQuery.data ?? [], [productsQuery.data]);
  const cartItems = useMemo(() => cartQuery.data ?? [], [cartQuery.data]);
  const orders = useMemo(() => ordersQuery.data ?? [], [ordersQuery.data]);
  const user = meQuery.data ?? persistedUser;
  const activeTab = tabFromLocation(location.pathname, location.search);

  const categories = useMemo(
    () => [...new Set(products.map((product) => product.category_name).filter((name): name is string => Boolean(name)))],
    [products],
  );
  const selectedProduct = useMemo(
    () => products.find((product) => product.id === selectedProductId) ?? products[0] ?? null,
    [products, selectedProductId],
  );
  const selectedSku = useMemo(
    () => selectedProduct?.skus.find((sku) => sku.id === selectedSkuId) ?? firstActiveSku(selectedProduct),
    [selectedProduct, selectedSkuId],
  );
  const effectiveSelectedCartItemIds = useMemo(
    () => selectedCartItemIds ?? cartItems.map((item) => item.id),
    [cartItems, selectedCartItemIds],
  );
  const selectedCartItems = useMemo(
    () => cartItems.filter((item) => effectiveSelectedCartItemIds.includes(item.id)),
    [cartItems, effectiveSelectedCartItemIds],
  );
  const selectedOrder = useMemo(
    () => orders.find((order) => order.id === selectedOrderId) ?? orders[0] ?? null,
    [orders, selectedOrderId],
  );
  const paymentOrder = useMemo(() => orders.find((order) => order.id === payOrderId) ?? null, [orders, payOrderId]);
  const walletTransactions = walletTransactionsQuery.data ?? [];

  useEffect(() => {
    if (meQuery.data && meQuery.data.id !== persistedUser?.id) {
      setUser(meQuery.data);
    }
  }, [meQuery.data, persistedUser?.id, setUser]);

  const clearNoticeLater = (message: string) => {
    setNotice(message);
    window.setTimeout(() => setNotice(""), 2800);
  };

  const openTab = (tab: ActiveTab) => {
    navigate(tabPath(tab));
  };

  const invalidatePurchaseData = () => {
    queryClient.invalidateQueries({ queryKey: ["member", "cart-items"] });
    queryClient.invalidateQueries({ queryKey: ["member", "purchase-orders"] });
    queryClient.invalidateQueries({ queryKey: ["member", "purchase-wallet"] });
    queryClient.invalidateQueries({ queryKey: ["member", "purchase-wallet-transactions"] });
    queryClient.invalidateQueries({ queryKey: ["member", "parcels"] });
  };

  const addCartMutation = useMutation({
    mutationFn: addCartItem,
    onSuccess: (item) => {
      queryClient.invalidateQueries({ queryKey: ["member", "cart-items"] });
      setSelectedCartItemIds((current) => (current === null ? current : [...new Set([...current, item.id])]));
      clearNoticeLater(`${item.product_title} 已加入购物车。`);
    },
  });

  const updateCartMutation = useMutation({
    mutationFn: ({ cartItemId, quantity }: { cartItemId: number; quantity: number }) =>
      updateCartItem(cartItemId, { quantity }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["member", "cart-items"] });
    },
  });

  const deleteCartMutation = useMutation({
    mutationFn: deleteCartItem,
    onSuccess: (_result, cartItemId) => {
      setSelectedCartItemIds((current) => (current === null ? current : current.filter((id) => id !== cartItemId)));
      queryClient.invalidateQueries({ queryKey: ["member", "cart-items"] });
      clearNoticeLater("购物车商品已删除。");
    },
  });

  const createCartOrderMutation = useMutation({
    mutationFn: createPurchaseOrder,
    onSuccess: (order) => {
      invalidatePurchaseData();
      setSelectedOrderId(order.id);
      setPayOrderId(order.status === "PENDING_PAYMENT" ? order.id : null);
      setCartServiceFee("0.00");
      openTab("orders");
      clearNoticeLater(`${order.order_no} 已生成，请完成余额支付。`);
    },
  });

  const createManualOrderMutation = useMutation({
    mutationFn: createManualPurchaseOrder,
    onSuccess: (order) => {
      invalidatePurchaseData();
      setSelectedOrderId(order.id);
      setPayOrderId(order.status === "PENDING_PAYMENT" ? order.id : null);
      setManualItems([manualLine(Date.now())]);
      setManualServiceFee("0.00");
      openTab("orders");
      clearNoticeLater(`${order.order_no} 已提交，请完成余额支付。`);
    },
  });

  const payOrderMutation = useMutation({
    mutationFn: ({ orderId, idempotencyKey }: { orderId: number; idempotencyKey: string }) =>
      payPurchaseOrder(orderId, { idempotency_key: idempotencyKey }),
    onSuccess: (result) => {
      queryClient.setQueryData<PurchaseOrder[]>(["member", "purchase-orders"], (current = []) =>
        current.map((order) => (order.id === result.purchase_order.id ? result.purchase_order : order)),
      );
      queryClient.setQueryData(["member", "purchase-wallet"], result.wallet);
      invalidatePurchaseData();
      setSelectedOrderId(result.purchase_order.id);
      setPayOrderId(null);
      clearNoticeLater(
        result.already_paid ? "该代购单已完成支付。" : `${result.purchase_order.order_no} 已余额支付，等待后台审核。`,
      );
    },
  });

  const filteredProducts = useMemo(() => {
    const normalized = productKeyword.trim().toLowerCase();
    return products.filter((product) => {
      const matchesCategory = categoryFilter === "ALL" || product.category_name === categoryFilter;
      const matchesKeyword =
        !normalized ||
        [product.title, product.description, product.category_name, product.skus.map((sku) => sku.sku_code).join(" ")]
          .join(" ")
          .toLowerCase()
          .includes(normalized);
      return matchesCategory && matchesKeyword;
    });
  }, [categoryFilter, productKeyword, products]);

  const filteredOrders = useMemo(() => {
    const normalized = orderKeyword.trim().toLowerCase();
    return orders.filter((order) => {
      const matchesStatus = orderStatusFilter === "ALL" || order.status === orderStatusFilter;
      const matchesKeyword =
        !normalized ||
        [order.order_no, order.source_type, order.items.map((item) => `${item.name} ${item.sku_code ?? ""}`).join(" ")]
          .join(" ")
          .toLowerCase()
          .includes(normalized);
      return matchesStatus && matchesKeyword;
    });
  }, [orderKeyword, orderStatusFilter, orders]);

  const totalOrderPages = Math.max(1, Math.ceil(filteredOrders.length / pageSize));
  const currentOrderPage = Math.min(orderPage, totalOrderPages);
  const pagedOrders = filteredOrders.slice((currentOrderPage - 1) * pageSize, currentOrderPage * pageSize);
  const cartSubtotal = sumCartItems(selectedCartItems);
  const cartTotal = cartSubtotal + Number(cartServiceFee || 0);
  const manualSubtotal = sumManualItems(manualItems);
  const manualTotal = manualSubtotal + Number(manualServiceFee || 0);
  const pendingPaymentCount = orders.filter((order) => order.status === "PENDING_PAYMENT").length;
  const activeOrderCount = orders.filter((order) =>
    ["PENDING_REVIEW", "PENDING_PROCUREMENT", "PROCURED", "ARRIVED"].includes(order.status),
  ).length;
  const canPay =
    paymentOrder && walletQuery.data ? compareMoney(walletQuery.data.balance, paymentOrder.total_amount) >= 0 : false;
  const allErrors = [
    meQuery.error,
    productsQuery.error,
    cartQuery.error,
    ordersQuery.error,
    walletQuery.error,
    addCartMutation.error,
    updateCartMutation.error,
    deleteCartMutation.error,
    createCartOrderMutation.error,
    createManualOrderMutation.error,
    payOrderMutation.error,
  ];
  const hasError =
    meQuery.isError ||
    productsQuery.isError ||
    cartQuery.isError ||
    ordersQuery.isError ||
    walletQuery.isError ||
    addCartMutation.isError ||
    updateCartMutation.isError ||
    deleteCartMutation.isError ||
    createCartOrderMutation.isError ||
    createManualOrderMutation.isError ||
    payOrderMutation.isError;
  const errorMessage = allErrors.find((error) => error instanceof Error)?.message || "数据加载失败，请刷新后重试。";

  const handleLogout = () => {
    logout();
    queryClient.clear();
    navigate("/login", { replace: true });
  };

  const handleAddCart = () => {
    if (!selectedSku) {
      clearNoticeLater("请选择可购买 SKU。");
      return;
    }
    addCartMutation.mutate({ sku_id: selectedSku.id, quantity: Number(productQuantity || 1) });
  };

  const toggleCartItem = (cartItem: CartItem) => {
    setSelectedCartItemIds((current) => {
      const baseSelection = current ?? cartItems.map((item) => item.id);
      return baseSelection.includes(cartItem.id)
        ? baseSelection.filter((id) => id !== cartItem.id)
        : [...baseSelection, cartItem.id];
    });
  };

  const handleCreateCartOrder = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (selectedCartItems.length === 0) {
      clearNoticeLater("请选择至少一个购物车商品。");
      return;
    }
    createCartOrderMutation.mutate({
      cart_item_ids: selectedCartItems.map((item) => item.id),
      service_fee: cartServiceFee || "0.00",
    });
  };

  const updateManualLine = (id: number, patch: Partial<ManualLine>) => {
    setManualItems((current) => current.map((item) => (item.id === id ? { ...item, ...patch } : item)));
  };

  const removeManualLine = (id: number) => {
    setManualItems((current) => (current.length <= 1 ? current : current.filter((item) => item.id !== id)));
  };

  const handleCreateManualOrder = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const payload = buildManualPayload(manualItems, manualServiceFee);
    if (payload.items.length === 0) {
      clearNoticeLater("至少填写一个代购商品。");
      return;
    }
    createManualOrderMutation.mutate(payload);
  };

  const refreshAll = () => {
    queryClient.invalidateQueries();
  };

  return (
    <main className={styles.page}>
      <header className={styles.header}>
        <button className={styles.backButton} type="button" onClick={() => navigate("/dashboard")}>
          <ArrowLeftOutlined />
          控制台
        </button>
        <div className={styles.brand}>
          <div className={styles.logo}>CB</div>
          <div>
            <strong>代购中心</strong>
            <span>{user?.profile?.member_no || user?.email || "会员"}</span>
          </div>
        </div>
        <div className={styles.headerActions}>
          <button className={styles.iconButton} type="button" aria-label="刷新代购" onClick={refreshAll}>
            <ReloadOutlined />
          </button>
          <button className={styles.accountButton} type="button" onClick={handleLogout}>
            <LogoutOutlined />
            <span>退出</span>
          </button>
        </div>
      </header>

      <section className={styles.summaryGrid}>
        <article>
          <span>可购商品</span>
          <strong>{products.length}</strong>
        </article>
        <article>
          <span>购物车</span>
          <strong>{cartItems.length}</strong>
        </article>
        <article>
          <span>待付款代购</span>
          <strong>{pendingPaymentCount}</strong>
        </article>
        <article>
          <span>处理中</span>
          <strong>{activeOrderCount}</strong>
        </article>
        <article>
          <span>账户余额</span>
          <strong>{formatMoney(walletQuery.data?.balance || "0.00", walletQuery.data?.currency || "CNY")}</strong>
        </article>
      </section>

      {hasError && <div className={styles.alert}>{errorMessage}</div>}
      {notice && <div className={styles.notice}>{notice}</div>}

      <nav className={styles.tabBar} aria-label="代购功能">
        {tabMeta.map((tab) => (
          <button
            key={tab.value}
            className={activeTab === tab.value ? styles.activeTab : ""}
            type="button"
            onClick={() => openTab(tab.value)}
          >
            {tab.label}
          </button>
        ))}
      </nav>

      {activeTab === "shop" && (
        <section className={styles.shopWorkspace}>
          <div className={styles.catalogPanel}>
            <div className={styles.listHeader}>
              <div>
                <h1>商品列表</h1>
                <p>选择 SKU 后加入购物车，也可以直接进入购物车确认订单。</p>
              </div>
              <input
                className={styles.searchInput}
                value={productKeyword}
                placeholder="搜索商品或 SKU"
                onChange={(event) => setProductKeyword(event.target.value)}
              />
            </div>

            <div className={styles.statusTabs}>
              <button
                className={categoryFilter === "ALL" ? styles.activeStatusTab : ""}
                type="button"
                onClick={() => setCategoryFilter("ALL")}
              >
                全部
              </button>
              {categories.map((category) => (
                <button
                  key={category}
                  className={categoryFilter === category ? styles.activeStatusTab : ""}
                  type="button"
                  onClick={() => setCategoryFilter(category)}
                >
                  {category}
                </button>
              ))}
            </div>

            {productsQuery.isLoading && <div className={styles.empty}>加载商品...</div>}
            {!productsQuery.isLoading && filteredProducts.length === 0 && <div className={styles.empty}>暂无匹配商品</div>}
            {!productsQuery.isLoading && filteredProducts.length > 0 && (
              <div className={styles.productGrid}>
                {filteredProducts.map((product) => {
                  const sku = firstActiveSku(product);
                  return (
                    <article
                      key={product.id}
                      className={`${styles.productCard} ${selectedProduct?.id === product.id ? styles.selectedProduct : ""}`}
                    >
                      <button type="button" onClick={() => setSelectedProductId(product.id)}>
                        <div className={styles.productThumb}>
                          <span>{product.category_name || "商品"}</span>
                          <strong>{product.main_image_file_id || product.title.slice(0, 8)}</strong>
                        </div>
                        <div className={styles.productInfo}>
                          <span>{product.category_name || "未分类"}</span>
                          <h2>{product.title}</h2>
                          <p>{product.description || "暂无商品说明"}</p>
                          <div>
                            <strong>{formatMoney(sku?.price || "0.00")}</strong>
                            <small>{sku ? `库存 ${sku.stock}` : "暂无 SKU"}</small>
                          </div>
                        </div>
                      </button>
                    </article>
                  );
                })}
              </div>
            )}
          </div>

          <aside className={styles.productDetail}>
            <div className={styles.sectionTitle}>
              <div>
                <h2>商品详情</h2>
                <p>{selectedProduct ? selectedProduct.title : "选择商品查看详情"}</p>
              </div>
              <FileSearchOutlined />
            </div>

            {!selectedProduct && <div className={styles.empty}>暂无商品详情</div>}
            {selectedProduct && (
              <>
                <div className={styles.detailHero}>
                  <span>{selectedProduct.category_name || "商品"}</span>
                  <strong>{selectedProduct.main_image_file_id || selectedProduct.title}</strong>
                </div>
                <p className={styles.description}>{selectedProduct.description || "该商品暂无更多说明。"}</p>

                <div className={styles.skuList}>
                  {selectedProduct.skus.map((sku) => (
                    <button
                      key={sku.id}
                      className={selectedSku?.id === sku.id ? styles.activeSku : ""}
                      type="button"
                      disabled={sku.stock <= 0}
                      onClick={() => setSelectedSkuId(sku.id)}
                    >
                      <span>{formatSpec(sku.spec_json)}</span>
                      <strong>{formatMoney(sku.price)}</strong>
                      <small>{sku.stock > 0 ? `库存 ${sku.stock}` : "缺货"}</small>
                    </button>
                  ))}
                </div>

                <div className={styles.purchaseControls}>
                  <label>
                    <span>数量</span>
                    <input
                      type="number"
                      min={1}
                      max={selectedSku?.stock || 1}
                      value={productQuantity}
                      onChange={(event) => setProductQuantity(event.target.value)}
                    />
                  </label>
                  <button
                    className={styles.primaryButton}
                    type="button"
                    disabled={!selectedSku || addCartMutation.isPending}
                    onClick={handleAddCart}
                  >
                    <ShoppingCartOutlined />
                    {addCartMutation.isPending ? "加入中" : "加入购物车"}
                  </button>
                  <button className={styles.secondaryButton} type="button" onClick={() => openTab("cart")}>
                    查看购物车
                  </button>
                </div>
              </>
            )}
          </aside>
        </section>
      )}

      {activeTab === "cart" && (
        <section className={styles.twoColumnWorkspace}>
          <div className={styles.listPanel}>
            <div className={styles.listHeader}>
              <div>
                <h1>购物车</h1>
                <p>勾选商品后提交代购订单，付款后进入后台采购审核。</p>
              </div>
              <button className={styles.secondaryButton} type="button" onClick={() => openTab("shop")}>
                继续选购
              </button>
            </div>

            {cartQuery.isLoading && <div className={styles.empty}>加载购物车...</div>}
            {!cartQuery.isLoading && cartItems.length === 0 && <div className={styles.empty}>购物车暂无商品</div>}
            {!cartQuery.isLoading && cartItems.length > 0 && (
              <div className={styles.cartList}>
                {cartItems.map((item) => (
                  <article
                    key={item.id}
                    className={`${styles.cartRow} ${effectiveSelectedCartItemIds.includes(item.id) ? styles.selectedCartRow : ""}`}
                  >
                    <label>
                      <input
                        type="checkbox"
                        checked={effectiveSelectedCartItemIds.includes(item.id)}
                        onChange={() => toggleCartItem(item)}
                      />
                      <span>
                        <strong>{item.product_title}</strong>
                        <small>{item.sku_code} / {formatSpec(item.sku_spec_json)}</small>
                      </span>
                    </label>
                    <div className={styles.quantityControl}>
                      <button
                        type="button"
                        disabled={item.quantity <= 1 || updateCartMutation.isPending}
                        onClick={() => updateCartMutation.mutate({ cartItemId: item.id, quantity: item.quantity - 1 })}
                      >
                        -
                      </button>
                      <strong>{item.quantity}</strong>
                      <button
                        type="button"
                        disabled={updateCartMutation.isPending}
                        onClick={() => updateCartMutation.mutate({ cartItemId: item.id, quantity: item.quantity + 1 })}
                      >
                        +
                      </button>
                    </div>
                    <strong>{formatMoney(item.line_amount)}</strong>
                    <button
                      className={styles.iconDangerButton}
                      type="button"
                      aria-label="删除购物车商品"
                      disabled={deleteCartMutation.isPending}
                      onClick={() => deleteCartMutation.mutate(item.id)}
                    >
                      <DeleteOutlined />
                    </button>
                  </article>
                ))}
              </div>
            )}
          </div>

          <form className={styles.checkoutPanel} onSubmit={handleCreateCartOrder}>
            <div className={styles.sectionTitle}>
              <div>
                <h2>确认订单</h2>
                <p>商品费和服务费确认后生成代购单。</p>
              </div>
              <CheckCircleOutlined />
            </div>
            <dl className={styles.totalList}>
              <div>
                <dt>已选商品</dt>
                <dd>{selectedCartItems.length} 件</dd>
              </div>
              <div>
                <dt>商品金额</dt>
                <dd>{formatMoney(cartSubtotal.toFixed(2))}</dd>
              </div>
              <div>
                <dt>服务费</dt>
                <dd>
                  <input
                    type="number"
                    min={0}
                    step="0.01"
                    value={cartServiceFee}
                    onChange={(event) => setCartServiceFee(event.target.value)}
                  />
                </dd>
              </div>
              <div>
                <dt>应付合计</dt>
                <dd>{formatMoney(cartTotal.toFixed(2))}</dd>
              </div>
            </dl>
            <button className={styles.primaryButton} type="submit" disabled={createCartOrderMutation.isPending}>
              <SendOutlined />
              {createCartOrderMutation.isPending ? "提交中" : "提交代购订单"}
            </button>
          </form>
        </section>
      )}

      {activeTab === "manual" && (
        <form className={styles.manualPanel} onSubmit={handleCreateManualOrder}>
          <div className={styles.listHeader}>
            <div>
              <h1>手工代购</h1>
              <p>无法自动解析的商品可手工填写，提交后进入待付款代购单。</p>
            </div>
            <button
              className={styles.secondaryButton}
              type="button"
              onClick={() => setManualItems((current) => [...current, manualLine(Date.now())])}
            >
              <PlusOutlined />
              新增商品行
            </button>
          </div>

          <div className={styles.manualLines}>
            {manualItems.map((item, index) => (
              <article key={item.id} className={styles.manualLine}>
                <div className={styles.lineTitle}>
                  <strong>商品 {index + 1}</strong>
                  <button type="button" disabled={manualItems.length <= 1} onClick={() => removeManualLine(item.id)}>
                    <DeleteOutlined />
                  </button>
                </div>
                <label>
                  <span>商品名称</span>
                  <input
                    value={item.name}
                    required
                    placeholder="手工代购商品"
                    onChange={(event) => updateManualLine(item.id, { name: event.target.value })}
                  />
                </label>
                <label>
                  <span>商品链接</span>
                  <input
                    value={item.product_url}
                    placeholder="https://..."
                    onChange={(event) => updateManualLine(item.id, { product_url: event.target.value })}
                  />
                </label>
                <div className={styles.inlineFields}>
                  <label>
                    <span>单价</span>
                    <input
                      type="number"
                      min={0}
                      step="0.01"
                      value={item.unit_price}
                      required
                      onChange={(event) => updateManualLine(item.id, { unit_price: event.target.value })}
                    />
                  </label>
                  <label>
                    <span>数量</span>
                    <input
                      type="number"
                      min={1}
                      value={item.quantity}
                      required
                      onChange={(event) => updateManualLine(item.id, { quantity: event.target.value })}
                    />
                  </label>
                </div>
                <label>
                  <span>备注</span>
                  <textarea
                    rows={2}
                    value={item.remark}
                    onChange={(event) => updateManualLine(item.id, { remark: event.target.value })}
                  />
                </label>
              </article>
            ))}
          </div>

          <aside className={styles.manualSummary}>
            <dl className={styles.totalList}>
              <div>
                <dt>商品金额</dt>
                <dd>{formatMoney(manualSubtotal.toFixed(2))}</dd>
              </div>
              <div>
                <dt>服务费</dt>
                <dd>
                  <input
                    type="number"
                    min={0}
                    step="0.01"
                    value={manualServiceFee}
                    onChange={(event) => setManualServiceFee(event.target.value)}
                  />
                </dd>
              </div>
              <div>
                <dt>应付合计</dt>
                <dd>{formatMoney(manualTotal.toFixed(2))}</dd>
              </div>
            </dl>
            <button className={styles.primaryButton} type="submit" disabled={createManualOrderMutation.isPending}>
              <SendOutlined />
              {createManualOrderMutation.isPending ? "提交中" : "提交手工代购"}
            </button>
          </aside>
        </form>
      )}

      {activeTab === "orders" && (
        <section className={styles.orderWorkspace}>
          <div className={styles.listPanel}>
            <div className={styles.listHeader}>
              <div>
                <h1>代购订单</h1>
                <p>查看待付款、审核、采购、到货和转包裹状态。</p>
              </div>
              <input
                className={styles.searchInput}
                value={orderKeyword}
                placeholder="搜索订单号或商品"
                onChange={(event) => {
                  setOrderKeyword(event.target.value);
                  setOrderPage(1);
                }}
              />
            </div>

            <div className={styles.statusTabs}>
              {orderStatusFilters.map((filter) => (
                <button
                  key={filter.value}
                  className={filter.value === orderStatusFilter ? styles.activeStatusTab : ""}
                  type="button"
                  onClick={() => {
                    setOrderStatusFilter(filter.value);
                    setOrderPage(1);
                  }}
                >
                  {filter.label}
                </button>
              ))}
            </div>

            {ordersQuery.isLoading && <div className={styles.empty}>加载代购订单...</div>}
            {!ordersQuery.isLoading && filteredOrders.length === 0 && <div className={styles.empty}>暂无匹配订单</div>}
            {!ordersQuery.isLoading && filteredOrders.length > 0 && (
              <div className={styles.orderList}>
                {pagedOrders.map((order) => (
                  <article
                    key={order.id}
                    className={`${styles.orderRow} ${selectedOrder?.id === order.id ? styles.selectedOrder : ""}`}
                  >
                    <button type="button" onClick={() => setSelectedOrderId(order.id)}>
                      <span>
                        <strong>{order.order_no}</strong>
                        <small>{order.source_type === "PRODUCT" ? "自营商品" : "手工代购"}</small>
                      </span>
                      <span>{order.items.length} 件</span>
                      <strong>{formatMoney(order.total_amount)}</strong>
                      {statusBadge(order.status)}
                    </button>
                  </article>
                ))}
              </div>
            )}

            <div className={styles.pagination}>
              <button
                type="button"
                disabled={currentOrderPage <= 1}
                onClick={() => setOrderPage(Math.max(1, currentOrderPage - 1))}
              >
                上一页
              </button>
              <span>
                {currentOrderPage} / {totalOrderPages}
              </span>
              <button
                type="button"
                disabled={currentOrderPage >= totalOrderPages}
                onClick={() => setOrderPage(Math.min(totalOrderPages, currentOrderPage + 1))}
              >
                下一页
              </button>
            </div>
          </div>

          <aside className={styles.orderDetail}>
            <div className={styles.sectionTitle}>
              <div>
                <h2>订单详情</h2>
                <p>{selectedOrder ? selectedOrder.order_no : "选择订单查看详情"}</p>
              </div>
              <WalletOutlined />
            </div>

            {!selectedOrder && <div className={styles.empty}>暂无订单详情</div>}
            {selectedOrder && (
              <>
                <dl className={styles.detailList}>
                  <div>
                    <dt>状态</dt>
                    <dd>{statusBadge(selectedOrder.status)}</dd>
                  </div>
                  <div>
                    <dt>类型</dt>
                    <dd>{selectedOrder.source_type === "PRODUCT" ? "自营商品" : "手工代购"}</dd>
                  </div>
                  <div>
                    <dt>商品费</dt>
                    <dd>{formatMoney((Number(selectedOrder.total_amount) - Number(selectedOrder.service_fee)).toFixed(2))}</dd>
                  </div>
                  <div>
                    <dt>服务费</dt>
                    <dd>{formatMoney(selectedOrder.service_fee)}</dd>
                  </div>
                  <div>
                    <dt>支付时间</dt>
                    <dd>{formatDate(selectedOrder.paid_at)}</dd>
                  </div>
                  <div>
                    <dt>创建时间</dt>
                    <dd>{formatDate(selectedOrder.created_at)}</dd>
                  </div>
                </dl>

                <div className={styles.detailBlock}>
                  <h3>商品明细</h3>
                  <ul>
                    {selectedOrder.items.map((item) => (
                      <li key={item.id}>
                        <span>
                          <strong>{item.name}</strong>
                          <small>{item.sku_code || item.product_url || "手工填写"}</small>
                        </span>
                        <strong>
                          x{item.quantity} / {formatMoney(item.actual_price || item.unit_price)}
                        </strong>
                      </li>
                    ))}
                  </ul>
                </div>

                {selectedOrder.procurement_task && (
                  <div className={styles.detailBlock}>
                    <h3>采购进度</h3>
                    <dl className={styles.detailList}>
                      <div>
                        <dt>外部订单号</dt>
                        <dd>{selectedOrder.procurement_task.external_order_no || "-"}</dd>
                      </div>
                      <div>
                        <dt>国内单号</dt>
                        <dd>{selectedOrder.procurement_task.tracking_no || "-"}</dd>
                      </div>
                      <div>
                        <dt>实采金额</dt>
                        <dd>{formatMoney(selectedOrder.procurement_task.purchase_amount)}</dd>
                      </div>
                    </dl>
                  </div>
                )}

                {selectedOrder.converted_parcel && (
                  <div className={styles.convertedParcel}>
                    <InboxOutlined />
                    <div>
                      <strong>{selectedOrder.converted_parcel.parcel_no}</strong>
                      <span>
                        已转为 {selectedOrder.converted_parcel.warehouse_name} 在库包裹，可进入集运打包。
                      </span>
                    </div>
                    <button type="button" onClick={() => navigate("/parcels")}>
                      查看包裹
                    </button>
                  </div>
                )}

                {selectedOrder.status === "PENDING_PAYMENT" && (
                  <button className={styles.payButton} type="button" onClick={() => setPayOrderId(selectedOrder.id)}>
                    <WalletOutlined />
                    余额支付
                  </button>
                )}
              </>
            )}
          </aside>
        </section>
      )}

      {paymentOrder && (
        <div className={styles.modalOverlay} role="presentation">
          <div className={styles.paymentModal} role="dialog" aria-modal="true" aria-labelledby="purchase-pay-title">
            <div className={styles.sectionTitle}>
              <div>
                <h2 id="purchase-pay-title">代购余额支付</h2>
                <p>{paymentOrder.order_no}</p>
              </div>
              <WalletOutlined />
            </div>
            <dl className={styles.paymentSummary}>
              <div>
                <dt>应付金额</dt>
                <dd>{formatMoney(paymentOrder.total_amount)}</dd>
              </div>
              <div>
                <dt>当前余额</dt>
                <dd>{formatMoney(walletQuery.data?.balance || "0.00", walletQuery.data?.currency || "CNY")}</dd>
              </div>
            </dl>
            {!canPay && <div className={styles.inlineWarning}>余额不足，请等待后台充值后再支付。</div>}
            <div className={styles.walletHistory}>
              <h3>最近流水</h3>
              {walletTransactions.length === 0 ? (
                <p>暂无钱包流水</p>
              ) : (
                walletTransactions.slice(0, 3).map((transaction) => (
                  <div key={transaction.id}>
                    <span>{transaction.type}</span>
                    <strong>
                      {transaction.direction === "INCREASE" ? "+" : "-"}
                      {transaction.amount}
                    </strong>
                  </div>
                ))
              )}
            </div>
            <div className={styles.modalActions}>
              <button type="button" onClick={() => setPayOrderId(null)}>
                取消
              </button>
              <button
                className={styles.primaryButton}
                type="button"
                disabled={!canPay || payOrderMutation.isPending}
                onClick={() =>
                  payOrderMutation.mutate({
                    orderId: paymentOrder.id,
                    idempotencyKey: `web-purchase-${paymentOrder.id}-${Date.now()}`,
                  })
                }
              >
                {payOrderMutation.isPending ? "支付中" : "确认支付"}
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
