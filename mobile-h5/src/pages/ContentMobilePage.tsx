import { DotLoading, ErrorBlock } from "antd-mobile";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";

import { fetchContentCategories, fetchContentPage, fetchContentPages } from "../features/content/api";
import type { ContentType } from "../features/content/types";
import styles from "./ContentMobilePage.module.css";

type ContentTypeFilter = "ALL" | ContentType;

const filters: Array<{ value: ContentTypeFilter; label: string }> = [
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
  return new Date(value).toLocaleDateString("zh-CN");
}

function typeLabel(type: ContentType) {
  return typeLabels[type] || type;
}

function bodyParagraphs(body?: string) {
  return (body || "").split(/\n{2,}/).filter(Boolean);
}

export function ContentMobilePage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [type, setType] = useState<ContentTypeFilter>("ALL");
  const [categorySlug, setCategorySlug] = useState("");
  const [keyword, setKeyword] = useState("");
  const [selectedSlug, setSelectedSlug] = useState<string | null>(null);

  const selectedType = type === "ALL" ? undefined : type;
  const categoriesQuery = useQuery({
    queryKey: ["mobile", "content-categories", selectedType],
    queryFn: () => fetchContentCategories(selectedType),
  });
  const pagesQuery = useQuery({
    queryKey: ["mobile", "content-pages", selectedType, categorySlug, keyword],
    queryFn: () => fetchContentPages({ type: selectedType, category_slug: categorySlug, keyword }),
  });
  const categories = useMemo(() => categoriesQuery.data ?? [], [categoriesQuery.data]);
  const pages = useMemo(() => pagesQuery.data ?? [], [pagesQuery.data]);
  const activeSlug =
    selectedSlug && pages.some((page) => page.slug === selectedSlug) ? selectedSlug : pages[0]?.slug ?? null;
  const detailQuery = useQuery({
    queryKey: ["mobile", "content-page", activeSlug],
    queryFn: () => fetchContentPage(String(activeSlug)),
    enabled: Boolean(activeSlug),
  });

  const invalidateContent = () => {
    queryClient.invalidateQueries({ queryKey: ["mobile", "content-categories"] });
    queryClient.invalidateQueries({ queryKey: ["mobile", "content-pages"] });
    if (activeSlug) {
      queryClient.invalidateQueries({ queryKey: ["mobile", "content-page", activeSlug] });
    }
  };

  const isLoading = pagesQuery.isLoading || categoriesQuery.isLoading;
  const hasError = pagesQuery.isError || categoriesQuery.isError || detailQuery.isError;
  const detail = detailQuery.data;

  return (
    <main className={styles.page}>
      <header className={styles.top}>
        <button type="button" onClick={() => navigate("/me")}>
          我的
        </button>
        <div>
          <span>Content</span>
          <h1>帮助公告</h1>
        </div>
        <button type="button" onClick={invalidateContent}>
          刷新
        </button>
      </header>

      {hasError && <ErrorBlock status="default" title="内容加载失败" description="请刷新后重试" />}

      <section className={styles.summary}>
        <div>
          <span>公开内容</span>
          <strong>{pages.length}</strong>
        </div>
        <div>
          <span>分类</span>
          <strong>{categories.length}</strong>
        </div>
        <div>
          <span>当前类型</span>
          <strong>{type === "ALL" ? "全部" : typeLabel(type)}</strong>
        </div>
      </section>

      <section className={styles.panel}>
        <div className={styles.sectionHead}>
          <span>Index</span>
          <h2>内容索引</h2>
          <p>公告、帮助、条款和政策只显示后台已发布版本。</p>
        </div>
        <div className={styles.chips}>
          {filters.map((item) => (
            <button
              key={item.value}
              className={`${styles.chip} ${type === item.value ? styles.activeChip : ""}`}
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
          placeholder="搜索标题"
        />
        {isLoading && (
          <div className={styles.loading}>
            <DotLoading />
            <span>加载内容</span>
          </div>
        )}
        {!isLoading && pages.length === 0 && <div className={styles.empty}>暂无已发布内容</div>}
        {!isLoading && pages.length > 0 && (
          <div className={styles.list}>
            {pages.map((page) => (
              <button
                key={page.slug}
                className={`${styles.contentCard} ${activeSlug === page.slug ? styles.selected : ""}`}
                type="button"
                onClick={() => setSelectedSlug(page.slug)}
              >
                <span>{typeLabel(page.type)} / {page.category_name || "未分类"} / {formatDate(page.published_at)}</span>
                <strong>{page.title}</strong>
                {page.summary && <p>{page.summary}</p>}
              </button>
            ))}
          </div>
        )}
      </section>

      <section className={styles.reader}>
        {!activeSlug && <div className={styles.empty}>请选择一篇内容</div>}
        {activeSlug && detailQuery.isLoading && (
          <div className={styles.loading}>
            <DotLoading />
            <span>加载正文</span>
          </div>
        )}
        {activeSlug && detail && (
          <>
            <span className={styles.detailType}>{typeLabel(detail.type)}</span>
            <h2>{detail.title}</h2>
            <div className={styles.detailMeta}>
              {detail.category_name || "未分类"} / 发布 {formatDate(detail.published_at)}
            </div>
            <div className={styles.body}>
              {bodyParagraphs(detail.body).map((paragraph) => (
                <p key={paragraph}>{paragraph}</p>
              ))}
            </div>
          </>
        )}
      </section>
    </main>
  );
}
