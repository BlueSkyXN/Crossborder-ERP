import { ArrowLeftOutlined, FileTextOutlined, ReloadOutlined } from "@ant-design/icons";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";

import { fetchContentCategories, fetchContentPage, fetchContentPages } from "../features/content/api";
import type { ContentType } from "../features/content/types";
import styles from "./ContentCenterPage.module.css";

type ContentTypeFilter = "ALL" | ContentType;

const contentTypes: Array<{ value: ContentTypeFilter; label: string }> = [
  { value: "ALL", label: "全部" },
  { value: "ANNOUNCEMENT", label: "公告" },
  { value: "HELP", label: "帮助" },
  { value: "TERMS", label: "条款" },
  { value: "PRIVACY", label: "隐私" },
  { value: "ABOUT", label: "关于" },
];

const typeLabels: Record<ContentType, string> = {
  ANNOUNCEMENT: "公告",
  HELP: "帮助",
  TERMS: "服务条款",
  PRIVACY: "隐私政策",
  ABOUT: "关于我们",
};

function formatDate(value?: string | null) {
  if (!value) {
    return "-";
  }
  return new Date(value).toLocaleString("zh-CN", { hour12: false });
}

function typeLabel(type: ContentType) {
  return typeLabels[type] || type;
}

function bodyParagraphs(body?: string) {
  return (body || "").split(/\n{2,}/).filter(Boolean);
}

export function ContentCenterPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [type, setType] = useState<ContentTypeFilter>("ALL");
  const [categorySlug, setCategorySlug] = useState("");
  const [keyword, setKeyword] = useState("");
  const [selectedSlug, setSelectedSlug] = useState<string | null>(null);

  const selectedType = type === "ALL" ? undefined : type;
  const categoriesQuery = useQuery({
    queryKey: ["member", "content-categories", selectedType],
    queryFn: () => fetchContentCategories(selectedType),
  });
  const pagesQuery = useQuery({
    queryKey: ["member", "content-pages", selectedType, categorySlug, keyword],
    queryFn: () => fetchContentPages({ type: selectedType, category_slug: categorySlug, keyword }),
  });
  const categories = useMemo(() => categoriesQuery.data ?? [], [categoriesQuery.data]);
  const pages = useMemo(() => pagesQuery.data ?? [], [pagesQuery.data]);
  const activeSlug =
    selectedSlug && pages.some((page) => page.slug === selectedSlug) ? selectedSlug : pages[0]?.slug ?? null;
  const detailQuery = useQuery({
    queryKey: ["member", "content-page", activeSlug],
    queryFn: () => fetchContentPage(String(activeSlug)),
    enabled: Boolean(activeSlug),
  });

  const invalidateContent = () => {
    queryClient.invalidateQueries({ queryKey: ["member", "content-categories"] });
    queryClient.invalidateQueries({ queryKey: ["member", "content-pages"] });
    if (activeSlug) {
      queryClient.invalidateQueries({ queryKey: ["member", "content-page", activeSlug] });
    }
  };

  const currentDetail = detailQuery.data;
  const hasError = pagesQuery.isError || categoriesQuery.isError || detailQuery.isError;
  const isLoading = pagesQuery.isLoading || categoriesQuery.isLoading;
  const legalCount = pages.filter((page) => ["TERMS", "PRIVACY"].includes(page.type)).length;

  return (
    <main className={styles.page}>
      <header className={styles.header}>
        <button className={styles.backButton} type="button" onClick={() => navigate("/dashboard")}>
          <ArrowLeftOutlined />
          控制台
        </button>
        <div className={styles.brand}>
          <div className={styles.logo}>CM</div>
          <div>
            <strong>内容中心</strong>
            <span>公告、帮助和服务条款</span>
          </div>
        </div>
        <button className={styles.iconButton} type="button" aria-label="刷新内容" onClick={invalidateContent}>
          <ReloadOutlined />
        </button>
      </header>

      {hasError && <div className={styles.alert}>内容加载失败，请刷新后重试。</div>}

      <section className={styles.summary}>
        <article className={styles.metric}>
          <span>公开内容</span>
          <strong>{pages.length}</strong>
        </article>
        <article className={styles.metric}>
          <span>内容分类</span>
          <strong>{categories.length}</strong>
        </article>
        <article className={styles.metric}>
          <span>公告帮助</span>
          <strong>{pages.filter((page) => ["ANNOUNCEMENT", "HELP"].includes(page.type)).length}</strong>
        </article>
        <article className={styles.metric}>
          <span>条款政策</span>
          <strong>{legalCount}</strong>
        </article>
      </section>

      <section className={styles.workspace}>
        <aside className={styles.sidebar}>
          <div className={styles.sectionTitle}>
            <div>
              <h1>内容索引</h1>
              <p>仅显示已发布内容。</p>
            </div>
            <FileTextOutlined />
          </div>
          <div className={styles.tabs}>
            {contentTypes.map((item) => (
              <button
                key={item.value}
                className={type === item.value ? styles.activeTab : ""}
                type="button"
                onClick={() => {
                  setType(item.value);
                  setCategorySlug("");
                }}
              >
                {item.label}
              </button>
            ))}
          </div>
          {categories.length > 0 && (
            <div className={styles.categories}>
              <button
                className={`${styles.categoryButton} ${!categorySlug ? styles.activeCategory : ""}`}
                type="button"
                onClick={() => setCategorySlug("")}
              >
                <strong>全部分类</strong>
                <span>{type === "ALL" ? "当前全部类型" : typeLabel(type)}</span>
              </button>
              {categories.map((category) => (
                <button
                  key={category.slug}
                  className={`${styles.categoryButton} ${categorySlug === category.slug ? styles.activeCategory : ""}`}
                  type="button"
                  onClick={() => setCategorySlug(category.slug)}
                >
                  <strong>{category.name}</strong>
                  <span>{category.description || typeLabel(category.type)}</span>
                </button>
              ))}
            </div>
          )}
          <input
            className={styles.searchInput}
            value={keyword}
            onChange={(event) => setKeyword(event.target.value)}
            placeholder="搜索标题或关键词"
          />
          {isLoading && <div className={styles.loading}>加载内容...</div>}
          {!isLoading && pages.length === 0 && <div className={styles.empty}>暂无已发布内容</div>}
          {!isLoading && pages.length > 0 && (
            <div className={styles.contentList}>
              {pages.map((page) => (
                <button
                  key={page.slug}
                  className={`${styles.contentCard} ${activeSlug === page.slug ? styles.selectedCard : ""}`}
                  type="button"
                  onClick={() => setSelectedSlug(page.slug)}
                >
                  <span className={styles.contentMeta}>
                    {typeLabel(page.type)} / {page.category_name || "未分类"} / {formatDate(page.published_at)}
                  </span>
                  <strong>{page.title}</strong>
                  {page.summary && <p>{page.summary}</p>}
                </button>
              ))}
            </div>
          )}
        </aside>

        <article className={styles.reader}>
          {!activeSlug && <div className={styles.empty}>请选择一篇内容</div>}
          {activeSlug && detailQuery.isLoading && <div className={styles.loading}>加载正文...</div>}
          {activeSlug && currentDetail && (
            <>
              <span className={styles.articleType}>{typeLabel(currentDetail.type)}</span>
              <h1>{currentDetail.title}</h1>
              <div className={styles.articleMeta}>
                {currentDetail.category_name || "未分类"} / 发布 {formatDate(currentDetail.published_at)} / 更新{" "}
                {formatDate(currentDetail.updated_at)}
              </div>
              <div className={styles.body}>
                {bodyParagraphs(currentDetail.body).map((paragraph) => (
                  <p key={paragraph}>{paragraph}</p>
                ))}
              </div>
            </>
          )}
        </article>
      </section>
    </main>
  );
}
