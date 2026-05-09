# OPS-READINESS-001 运维 Readiness 检查

## 背景

项目已完成 SQLite-first 主链路、浏览器 smoke、审计导出和基础安全响应头。本轮继续补生产化运维边界中的本地可验证能力：readiness endpoint。

## 关键实现

- 新增 `GET /api/v1/health/ready`，与既有 `/api/v1/health` 区分存活和依赖可用性。
- readiness 当前检查默认数据库连接，符合 SQLite-first 验证边界。
- 数据库可用时返回 `status: ok` 和 `checks.database: ok`。
- 数据库不可用时返回 HTTP 503、`SERVICE_UNAVAILABLE` 和脱敏后的 `checks.database: unavailable`。
- 补充成功和失败路径测试，确保不暴露 DSN、异常堆栈或本地路径。
- 更新任务图、README、部署说明、生产化 backlog、差距地图、已知问题和交付审计。

## 验证

- `cd backend && uv run pytest apps/common/tests/test_health.py -q`：4 passed。
- `cd backend && uv run pytest`：132 passed。
- `npm run e2e`：passed。
- `npm run e2e:browser`：passed，沿用 system Chrome 和 `.tmp/browser-e2e/` 临时 profile。
- `pnpm lint`：passed。
- `pnpm build`：passed。
- `cd backend && uv run python manage.py check`：passed。
- `cd backend && uv run python manage.py makemigrations --check --dry-run`：passed，No changes detected。
- `cd backend && uv run python manage.py spectacular --file /tmp/crossborder-ops-readiness-openapi.yaml --validate`：passed。
- `git diff --check`：passed。
- `actionlint .github/workflows/ci.yml`：passed。
- Ruby YAML parse：`yaml ok`，仅出现已知 `/Volumes/TP4000PRO` world-writable PATH warning。

## 未验证边界

- 未接 Prometheus、Sentry、外部监控、告警或真实 staging。
- 未检查 PostgreSQL/MySQL/Redis/Celery，因为这些依赖当前不真实验证。
- Docker、真实 TLS/HSTS、反向代理和生产可观测性仍是后续任务。
