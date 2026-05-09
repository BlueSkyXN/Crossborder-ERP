# QA-BROWSER-004 跨面板浏览器业务旅程

## 背景

`QA-BROWSER-001` 到 `QA-BROWSER-003` 已覆盖三端登录、关键页面 smoke、包裹预报/后台扫描入库/会员回看在库旅程和失败诊断。但源报告要求后台、用户端和移动端是可真实操作的 ERP 产品形态，单一包裹旅程仍不足以证明财务和客服面板不会退化为静态页面或前后端契约漂移。

## 目标

- 扩展 system Chrome CDP Browser Smoke，继续使用 `.tmp/browser-e2e` 隔离 SQLite、media 和 Chrome profile。
- 覆盖 User Web 创建线下汇款和客服工单、Admin Web 审核汇款入账和回复工单、User Web 回看客服回复。
- 修复本轮浏览器旅程暴露的前后端契约问题。
- 不新增 Playwright/Vitest，不下载浏览器，不安装全局依赖。

## 范围

- `scripts/e2e/browser-smoke.mjs`
- `admin-web/src/features/tickets/api.ts`
- `admin-web/src/features/finance/FinancePage.tsx`
- `admin-web/src/features/tickets/TicketOpsPage.tsx`
- README、差距地图、backlog、已知问题、交付审计和 Agent run 证据

## Done 条件

- `node --check scripts/e2e/browser-smoke.mjs` 通过。
- `pnpm --filter admin-web lint` 通过。
- `pnpm --filter admin-web build` 通过。
- `npm run e2e:browser` 通过，并覆盖财务汇款审核和客服工单回复跨面板旅程。
- `npm run e2e` 通过。
- `cd backend && uv run pytest apps/tickets/tests/test_tickets.py apps/finance/tests/test_finance.py -q` 通过。
- `npm run evidence`、`git diff --check`、`actionlint .github/workflows/ci.yml` 和 YAML parse 通过。
- PR CI 与 main CI 均通过。

## 边界

- 本任务只增强现有 CDP Browser Smoke，不引入新的浏览器测试框架。
- 仍不声明完成 Playwright、组件级测试、视觉回归或所有复杂业务路径覆盖。
- 线下汇款仍是本地/人工审核路径，不接真实线上支付、退款或渠道对账。
- 客服工单仍是轮询列表和人工回复，不接在线客服、实时推送或客服 SLA。
