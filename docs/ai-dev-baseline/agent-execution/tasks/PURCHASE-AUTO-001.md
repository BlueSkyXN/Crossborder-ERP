# PURCHASE-AUTO-001 外部商品链接解析入口

## 背景

源报告提到用户端需要商品链接/关键词搜索和外部平台代购能力。当前不抓取真实第三方页面、不接外部电商 API、不存储第三方凭证，本轮只补 SQLite-first 可本地验证的外部链接解析入口和人工 fallback。

## 范围

- 新增 `POST /api/v1/purchase-links/parse`。
- 支持识别淘宝、天猫、1688、拼多多、京东等常见 host。
- 解析商品 ID、规范化 URL、建议商品名称和人工确认备注。
- 未识别平台仍返回 `UNKNOWN`，可转手工代购。
- User Web 和 Mobile H5 手工代购页提供链接解析入口，并把解析结果填入商品行。
- API E2E 和 Browser Smoke 覆盖解析入口和三端入口可见性。

## 非范围

- 不抓取真实第三方页面。
- 不自动下单、不同步外部订单。
- 不接支付网关、物流 API、外部风控或平台账号。
- 不声明真实自动采购完成。

## 验收

- `cd backend && uv run pytest apps/purchases/tests/test_purchases.py tests/e2e/test_p0_flow.py -q`
- `cd backend && uv run pytest`
- `npm run e2e`
- `npm run e2e:browser`
- `pnpm lint`
- `pnpm build`
- `cd backend && uv run python manage.py check`
- `cd backend && uv run python manage.py makemigrations --check --dry-run`
- `cd backend && uv run python manage.py spectacular --file /tmp/crossborder-purchase-auto001-openapi.yaml --validate`
- `git diff --check`
- `actionlint .github/workflows/ci.yml`
- YAML 解析 `current-state.yaml` 和 `task-graph.yaml`
