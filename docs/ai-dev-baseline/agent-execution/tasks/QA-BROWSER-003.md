# QA-BROWSER-003 Browser Smoke 稳定性加固

## 背景

PR #49 合并后，`main` 的首次 Browser Smoke 在 Admin Web 登录页等待 `管理员登录` 时偶发失败；同一 merge commit 重跑 failed jobs 后通过。该问题不代表业务代码回归，但说明现有 CDP smoke 的导航等待和失败诊断还不够稳健。

## 目标

- 降低 Vite/CDP 首次导航、页面切换和 SPA 加载导致的偶发误判。
- Browser Smoke 失败时保留可定位的页面快照和服务日志尾部。
- 不新增 Playwright/Vitest 等依赖，不下载浏览器，不使用用户日常 Chrome profile。

## 范围

- `scripts/e2e/browser-smoke.mjs`
- `scripts/e2e/browser-smoke.sh`
- README、差距地图、backlog、已知问题和 Agent run 证据

## Done 条件

- `node --check scripts/e2e/browser-smoke.mjs` 通过。
- `bash -n scripts/e2e/browser-smoke.sh` 通过。
- `npm run e2e:browser` 通过。
- `npm run e2e` 通过。
- `pnpm lint` 和 `pnpm build` 通过。
- `cd backend && uv run pytest` 通过。
- `git diff --check`、`actionlint .github/workflows/ci.yml` 和 YAML parse 通过。
- PR CI 与 main CI 均通过。

## 边界

- 本任务只加固现有 system Chrome CDP smoke，不引入新的浏览器测试框架。
- 仍不声明完成视觉回归、组件级测试或所有业务路径浏览器覆盖。
