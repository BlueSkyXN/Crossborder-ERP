# QA-BROWSER-002 浏览器真实业务旅程增强

## 目标

在既有 system Chrome CDP smoke 基础上，补一条真实跨端业务旅程，证明浏览器端不是只加载页面，而是可以完成会员包裹预报、后台扫描入库和会员回看在库状态。

## 关联来源

- `docs/source-report-gap-map.md`：浏览器级 E2E 缺口。
- `docs/production-readiness-backlog.md`：完整浏览器旅程增强方向。
- `docs/ai-dev-baseline/agent-execution/tasks/QA-BROWSER-001.md`：既有 system Chrome CDP smoke。

## 范围

- 扩展 `scripts/e2e/browser-smoke.mjs`，增加可复用的 label/placeholder 表单填充 helper。
- User Web 通过真实表单提交唯一快递单号的包裹预报。
- Admin Web 通过真实扫描入库表单扫描同一快递单号，并验证进入在库列表。
- User Web 再次打开包裹中心，搜索同一快递单号，验证显示在库并出现申请打包入口。
- 保留 Admin Web、User Web、Mobile H5 既有登录和关键页面 smoke。

## 约束

- 不引入 Playwright/Vitest 依赖，不下载浏览器二进制。
- 继续使用系统 Chrome/Chromium、临时 SQLite、临时 media 和 `.tmp/browser-e2e/` Chrome profile。
- 不启动 Docker/PostgreSQL/MySQL/Redis。
- 不把这条旅程声明为完整视觉回归或组件级测试体系。

## 验证

```bash
npm run e2e:browser
npm run e2e
pnpm lint
pnpm build
cd backend && uv run pytest
git diff --check
actionlint .github/workflows/ci.yml
```

## Done

- `npm run e2e:browser` 能真实完成会员预报、后台扫描入库、会员回看在库。
- 既有三端 smoke 覆盖不回退。
- 文档、gap map、backlog、known issues、delivery audit 和任务图同步更新。
- PR CI 通过并合并到 `main`。
