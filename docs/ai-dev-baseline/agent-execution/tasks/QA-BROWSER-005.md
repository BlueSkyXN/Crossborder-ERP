# QA-BROWSER-005 运单后半程浏览器业务旅程

## 背景

`QA-BROWSER-001` 到 `QA-BROWSER-004` 已覆盖三端登录、关键页面 smoke、包裹预报/后台扫描入库/会员回看在库、财务汇款审核和客服工单回复。但源报告和执行入口要求 P0 主链路必须跑到运单审核、计费、支付、发货、轨迹和确认收货；API E2E 已覆盖该链路，浏览器层仍需要更深的全栈证明。

## 目标

- 扩展 system Chrome CDP Browser Smoke，继续使用 `.tmp/browser-e2e` 隔离 SQLite、media、日志和 Chrome profile。
- 覆盖 User Web 从在库包裹创建运单，Admin Web 审核并设置费用，User Web 余额支付，Admin Web 发货并生成轨迹，User Web 回看轨迹并确认收货。
- 修复本轮浏览器旅程暴露的前端 runtime/console 问题。
- 不新增 Playwright/Vitest，不下载浏览器，不安装全局依赖。

## 范围

- `scripts/e2e/browser-smoke.mjs`
- `admin-web/src/features/waybills/WaybillOpsPage.tsx`
- README、差距地图、backlog、已知问题、交付审计和 Agent run 证据

## Done 条件

- `node --check scripts/e2e/browser-smoke.mjs` 通过。
- `pnpm --filter admin-web lint` 通过。
- `pnpm --filter admin-web build` 通过。
- `npm run e2e:browser` 通过，并覆盖运单创建、后台审核计费、余额支付、后台发货、用户回看轨迹和确认收货。
- `npm run e2e` 通过。
- `npm run evidence`、`git diff --check`、`actionlint .github/workflows/ci.yml` 和 YAML parse 通过。
- PR CI 与 main CI 均通过。

## 边界

- 本任务只增强现有 CDP Browser Smoke，不引入新的浏览器测试框架。
- 仍不声明完成 Playwright、组件级测试、视觉回归或所有复杂业务路径覆盖。
- 运单发货仍是人工发货和人工轨迹录入，不接真实物流 API、真实面单打印、第三方转单接口或仓库硬件。
- 余额支付仍使用本地钱包余额，不接真实线上支付、退款或渠道对账。
- PostgreSQL/MySQL/Redis/Celery/Docker 仍不真实验证。
