# OPS-READINESS-001 运维 Readiness 检查

## 背景

`SECURITY-HEADERS-001` 已补齐基础安全响应头。生产化边界还需要区分进程存活和依赖可用，便于后续反向代理、CI smoke 或监控探针接入。

## 范围

- 新增 `GET /api/v1/health/ready`。
- readiness 检查当前唯一真实验证依赖：默认数据库连接。
- 正常返回统一成功响应：
  - `status: ok`
  - `checks.database: ok`
- 依赖不可用时返回 HTTP 503 和统一错误响应：
  - `code: SERVICE_UNAVAILABLE`
  - `status: unavailable`
  - `checks.database: unavailable`
- 响应不得包含数据库 DSN、异常堆栈、本地路径或其他敏感细节。

## 非范围

- 不接 Prometheus、Sentry、外部监控、告警或真实 staging。
- 不检查 PostgreSQL/MySQL/Redis/Celery，因为这些依赖当前不真实验证。
- 不替代后续生产部署、日志、备份和可观测性任务。

## 验收

- `cd backend && uv run pytest apps/common/tests/test_health.py -q`
- `cd backend && uv run pytest`
- `npm run e2e`
- `npm run e2e:browser`
- `pnpm lint`
- `pnpm build`
- `cd backend && uv run python manage.py check`
- `cd backend && uv run python manage.py makemigrations --check --dry-run`
- `cd backend && uv run python manage.py spectacular --file /tmp/crossborder-ops-readiness-openapi.yaml --validate`
- `git diff --check`
- `actionlint .github/workflows/ci.yml`
- YAML 解析 `current-state.yaml` 和 `task-graph.yaml`
