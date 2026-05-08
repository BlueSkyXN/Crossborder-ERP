import { Empty } from "antd-mobile";

import styles from "./PlaceholderPage.module.css";

export function PlaceholderPage({ title }: { title: string }) {
  return (
    <main className={styles.page}>
      <header className={styles.header}>
        <h1>{title}</h1>
      </header>
      <Empty description="待接入" />
    </main>
  );
}
