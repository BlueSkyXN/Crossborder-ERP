import { DotLoading, Empty, ErrorBlock } from "antd-mobile";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";

import { BannerCarousel } from "../features/home/BannerCarousel";
import { ProductWaterfall } from "../features/home/ProductWaterfall";
import { addCartItem, fetchCartItems, fetchProducts } from "../features/purchases/api";
import type { Product, ProductSku } from "../features/purchases/types";
import styles from "./PurchaseMobile.module.css";

type ProductHomePageProps = {
  mode?: "home" | "category";
};

function formatMoney(value?: string | null, currency = "CNY") {
  return `${currency} ${value || "0.00"}`;
}

function formatSpec(spec: Record<string, unknown>) {
  const entries = Object.entries(spec);
  if (entries.length === 0) {
    return "默认规格";
  }
  return entries.map(([key, value]) => `${key}: ${String(value)}`).join(" / ");
}

function firstActiveSku(product: Product | null) {
  return product?.skus.find((sku) => sku.status === "ACTIVE" && sku.stock > 0) ?? product?.skus[0] ?? null;
}

function isPurchasableProduct(product: Product) {
  return product.skus.some((sku) => sku.status === "ACTIVE" && sku.stock > 0);
}

export function ProductHomePage({ mode = "home" }: ProductHomePageProps) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [keyword, setKeyword] = useState("");
  const [category, setCategory] = useState("ALL");
  const [selectedProductId, setSelectedProductId] = useState<number | null>(null);
  const [selectedSkuId, setSelectedSkuId] = useState<number | null>(null);
  const [quantity, setQuantity] = useState("1");
  const [notice, setNotice] = useState("");

  const productsQuery = useQuery({
    queryKey: ["mobile", "member", "products"],
    queryFn: fetchProducts,
  });
  const cartQuery = useQuery({
    queryKey: ["mobile", "member", "cart-items"],
    queryFn: fetchCartItems,
  });

  const products = useMemo(() => productsQuery.data ?? [], [productsQuery.data]);
  const categories = useMemo(
    () => [...new Set(products.map((product) => product.category_name).filter((name): name is string => Boolean(name)))],
    [products],
  );
  const categoryItems = useMemo(() => ["ALL", ...categories], [categories]);
  const filteredProducts = useMemo(() => {
    const normalized = keyword.trim().toLowerCase();
    return products.filter((product) => {
      const matchesCategory = category === "ALL" || product.category_name === category;
      const matchesKeyword =
        !normalized ||
        [product.title, product.description, product.category_name, product.skus.map((sku) => sku.sku_code).join(" ")]
          .join(" ")
          .toLowerCase()
          .includes(normalized);
      return matchesCategory && matchesKeyword;
    });
  }, [category, keyword, products]);
  const selectedProduct = useMemo(
    () =>
      products.find((product) => product.id === selectedProductId) ??
      filteredProducts.find(isPurchasableProduct) ??
      filteredProducts[0] ??
      products.find(isPurchasableProduct) ??
      products[0] ??
      null,
    [filteredProducts, products, selectedProductId],
  );
  const selectedSku = useMemo<ProductSku | null>(
    () => selectedProduct?.skus.find((sku) => sku.id === selectedSkuId) ?? firstActiveSku(selectedProduct),
    [selectedProduct, selectedSkuId],
  );

  const showNotice = (message: string) => {
    setNotice(message);
    window.setTimeout(() => setNotice(""), 2400);
  };

  const addCartMutation = useMutation({
    mutationFn: addCartItem,
    onSuccess: (item) => {
      queryClient.invalidateQueries({ queryKey: ["mobile", "member", "cart-items"] });
      showNotice(`${item.product_title} 已加入购物车`);
    },
  });

  const handleAddCart = () => {
    if (!selectedSku) {
      showNotice("请选择可购买 SKU");
      return;
    }
    addCartMutation.mutate({ sku_id: selectedSku.id, quantity: Number(quantity || 1) });
  };

  const handleSelectProduct = (product: Product) => {
    setSelectedProductId(product.id);
    setSelectedSkuId(firstActiveSku(product)?.id ?? null);
  };

  return (
    <main className={styles.page}>
      <header className={styles.top}>
        <button type="button" onClick={() => navigate("/ship")}>
          寄件
        </button>
        <div>
          <span>{mode === "category" ? "商品分类" : "商品商城"}</span>
          <h1>{mode === "category" ? "商品分类" : "代购首页"}</h1>
        </div>
        <button type="button" onClick={() => navigate("/cart")}>
          购物车
        </button>
      </header>

      {mode === "home" && (
        <>
          <BannerCarousel />
          <section className={styles.hero}>
            <h2>自营商品与手工代购</h2>
            <p>移动端直接选购商品，也可以从我的页面提交手工代购单，付款后进入后台采购处理。</p>
            <div className={styles.heroActions}>
              <button className={styles.primaryButton} type="button" onClick={() => navigate("/cart")}>
                查看购物车
              </button>
              <button className={styles.secondaryButton} type="button" onClick={() => navigate("/me/purchases/manual")}>
                手工代购
              </button>
            </div>
          </section>
        </>
      )}

      <section className={styles.summary}>
        <div>
          <span>可购商品</span>
          <strong>{products.length}</strong>
        </div>
        <div>
          <span>购物车</span>
          <strong>{cartQuery.data?.length ?? 0}</strong>
        </div>
        <div>
          <span>分类</span>
          <strong>{categories.length}</strong>
        </div>
      </section>

      {notice && <div className={styles.notice}>{notice}</div>}
      {addCartMutation.isError && (
        <div className={styles.error}>{addCartMutation.error instanceof Error ? addCartMutation.error.message : "加入失败"}</div>
      )}

      {mode === "home" && (
        <>
          <input
            className={styles.searchInput}
            value={keyword}
            placeholder="搜索商品或 SKU"
            onChange={(event) => setKeyword(event.target.value)}
          />

          <div className={styles.chips}>
            <button
              className={`${styles.chip} ${category === "ALL" ? styles.activeChip : ""}`}
              type="button"
              onClick={() => setCategory("ALL")}
            >
              全部
            </button>
            {categories.map((item) => (
              <button
                key={item}
                className={`${styles.chip} ${category === item ? styles.activeChip : ""}`}
                type="button"
                onClick={() => setCategory(item)}
              >
                {item}
              </button>
            ))}
          </div>
        </>
      )}

      {productsQuery.isLoading && (
        <div className={styles.loading}>
          <DotLoading />
          <span>加载商品</span>
        </div>
      )}
      {productsQuery.isError && <ErrorBlock status="default" title="商品加载失败" description="请刷新后重试" />}
      {!productsQuery.isLoading && !productsQuery.isError && filteredProducts.length === 0 && mode === "home" && (
        <Empty description="暂无匹配商品" />
      )}

      {!productsQuery.isLoading && !productsQuery.isError && filteredProducts.length > 0 && mode === "home" && (
        <ProductWaterfall products={filteredProducts} selectedProductId={selectedProduct?.id} onSelect={handleSelectProduct} />
      )}

      {!productsQuery.isLoading && !productsQuery.isError && mode === "category" && (
        <section className={styles.categorySplit}>
          <aside className={styles.categoryLeft} aria-label="一级分类">
            {categoryItems.map((item) => (
              <button
                key={item}
                className={category === item ? styles.activeCategoryItem : ""}
                type="button"
                onClick={() => setCategory(item)}
              >
                {item === "ALL" ? "全部商品" : item}
              </button>
            ))}
          </aside>
          <div className={styles.categoryRight}>
            <div className={styles.sectionHead}>
              <span>分类浏览</span>
              <h2>{category === "ALL" ? "全部商品" : category}</h2>
              <p>选择左侧分类，浏览对应商品与可购 SKU。</p>
            </div>
            {filteredProducts.length === 0 ? (
              <Empty description="该分类暂无商品" />
            ) : (
              <ProductWaterfall products={filteredProducts} selectedProductId={selectedProduct?.id} onSelect={handleSelectProduct} />
            )}
          </div>
        </section>
      )}

      {selectedProduct && (
        <section className={styles.detail}>
          <div className={styles.detailHead}>
            <div>
              <span>商品详情</span>
              <h2>{selectedProduct.title}</h2>
            </div>
          </div>
          <div className={styles.detailHero}>{selectedProduct.main_image_file_id || selectedProduct.title}</div>
          <p>{selectedProduct.description || "该商品暂无更多说明。"}</p>
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
          <div className={styles.controls}>
            <label>
              <span>数量</span>
              <input
                className={styles.searchInput}
                type="number"
                min={1}
                max={selectedSku?.stock || 1}
                value={quantity}
                onChange={(event) => setQuantity(event.target.value)}
              />
            </label>
            <button
              className={styles.primaryButton}
              type="button"
              disabled={!selectedSku || addCartMutation.isPending}
              onClick={handleAddCart}
            >
              {addCartMutation.isPending ? "加入中" : "加入购物车"}
            </button>
          </div>
        </section>
      )}
    </main>
  );
}
