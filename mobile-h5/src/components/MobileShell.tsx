import { TabBar } from "antd-mobile";
import { Outlet, useLocation, useNavigate } from "react-router-dom";

import styles from "./MobileShell.module.css";

const tabs = [
  { key: "/home", title: "首页", glyph: "首" },
  { key: "/category", title: "分类", glyph: "类" },
  { key: "/ship", title: "寄件", glyph: "寄" },
  { key: "/cart", title: "购物车", glyph: "车" },
  { key: "/me", title: "我的", glyph: "我" },
];

function resolveActive(pathname: string) {
  return tabs.find((tab) => pathname.startsWith(tab.key))?.key ?? "/ship";
}

export function MobileShell() {
  const navigate = useNavigate();
  const location = useLocation();

  return (
    <div className={styles.shell}>
      <div className={styles.content}>
        <Outlet />
      </div>
      <nav className={styles.tabs} aria-label="移动端主导航">
        <TabBar activeKey={resolveActive(location.pathname)} onChange={(key) => navigate(key)}>
          {tabs.map((tab) => (
            <TabBar.Item
              key={tab.key}
              icon={<span className={styles.glyph}>{tab.glyph}</span>}
              title={tab.title}
            />
          ))}
        </TabBar>
      </nav>
    </div>
  );
}
