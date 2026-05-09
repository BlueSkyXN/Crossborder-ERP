# PURCHASE-AUTO-001 外部商品链接解析入口

## 背景

源报告要求用户端具备商品链接/外部平台代购能力。当前仍遵守 no-Docker、SQLite-first、不抓真实第三方页面、不新增依赖的边界，本轮先补本地可验证的链接解析入口和人工代购 fallback。

## 关键实现

- 新增 `POST /api/v1/purchase-links/parse`。
- 后端本地识别淘宝、天猫、1688、拼多多、京东等常见 host。
- 返回 provider、商品 ID、规范化 URL、建议商品名称、默认数量和人工确认备注。
- 未识别平台返回 `UNKNOWN`，仍可作为手工代购商品行。
- 拒绝带账号/密码的 URL，避免敏感信息进入解析结果。
- User Web 和 Mobile H5 手工代购页增加链接解析入口，解析后填入商品行。
- API E2E 先解析链接，再创建手工代购单并继续原有支付、审核、采购、到货、转包裹链路。
- Browser Smoke 覆盖 User Web 和 Mobile H5 手工代购页的解析入口可见性。

## 验证

- `cd backend && uv run pytest apps/purchases/tests/test_purchases.py tests/e2e/test_p0_flow.py -q`：13 passed。
- `pnpm --filter user-web lint`：passed。
- `pnpm --filter mobile-h5 lint`：passed。
- `pnpm --filter user-web build`：passed。
- `pnpm --filter mobile-h5 build`：passed。
- `cd backend && uv run python manage.py check`：passed。
- `cd backend && uv run python manage.py makemigrations --check --dry-run`：passed，No changes detected。
- `cd backend && uv run python manage.py spectacular --file /tmp/crossborder-purchase-auto001-openapi.yaml --validate`：passed。
- `cd backend && uv run pytest`：145 passed。
- `npm run e2e`：passed。
- `npm run e2e:browser`：passed，继续使用 `.tmp/browser-e2e` 隔离 SQLite、media 和 Chrome profile。
- `pnpm lint`：passed。
- `pnpm build`：passed。
- `git diff --check`：passed。
- `actionlint .github/workflows/ci.yml`：passed。
- YAML parse：passed；Ruby 仍提示 `/Volumes/TP4000PRO` 在 PATH 中 world-writable，这是当前外置盘环境的既有 warning。

## 未验证边界

- 未抓取真实第三方页面。
- 未自动下单、未同步外部订单、未接平台账号或采购凭证。
- 真实支付、真实物流 API、真实自动采购下单仍需业务/合规确认后单独实现。
- PostgreSQL/MySQL/Redis/Celery/Docker 仍未真实验证。
