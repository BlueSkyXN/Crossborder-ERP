import type { Product } from "../purchases/types";

import styles from "../../pages/PurchaseMobile.module.css";

type ProductWaterfallProps = {
  products: Product[];
  selectedProductId?: number | null;
  onSelect?: (product: Product) => void;
};

function firstActiveSku(product: Product) {
  return product.skus.find((sku) => sku.status === "ACTIVE" && sku.stock > 0) ?? product.skus[0] ?? null;
}

function formatMoney(value?: string | null, currency = "CNY") {
  return `${currency} ${value || "0.00"}`;
}

export function ProductWaterfall({ products, selectedProductId, onSelect }: ProductWaterfallProps) {
  return (
    <section className={styles.waterfallGrid} aria-label="商品瀑布流">
      {products.map((product, index) => {
        const sku = firstActiveSku(product);
        const imageLabel = product.main_image_file_id || product.category_name || "精选商品";
        return (
          <button
            key={product.id}
            type="button"
            className={`${styles.waterfallCard} ${selectedProductId === product.id ? styles.selected : ""}`}
            onClick={() => onSelect?.(product)}
          >
            <div className={styles.waterfallImage} data-variant={index % 4}>
              {imageLabel}
            </div>
            <div className={styles.waterfallBody}>
              <span>{product.category_name || "未分类"}</span>
              <h3>{product.title}</h3>
              <p>{product.description || "暂无商品说明"}</p>
              <div className={styles.priceLine}>
                <strong>{formatMoney(sku?.price)}</strong>
                <small>{sku ? `库存 ${sku.stock}` : "暂无 SKU"}</small>
              </div>
            </div>
          </button>
        );
      })}
    </section>
  );
}
