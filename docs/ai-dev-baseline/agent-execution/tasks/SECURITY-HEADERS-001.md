# SECURITY-HEADERS-001 基础安全响应头

## 背景

源报告没有要求立即完成真实生产部署，但下一阶段生产化边界需要把最基础的 HTTP 安全 header 固化为可测试行为。当前仍遵守 no-Docker、SQLite-first、不真实验证 PostgreSQL/MySQL/Redis 的约束。

## 范围

- 显式配置 Django 已支持的安全响应头：
  - `X-Content-Type-Options: nosniff`
  - `Referrer-Policy: same-origin`
  - `Cross-Origin-Opener-Policy: same-origin`
  - `X-Frame-Options: DENY`
- 增加 `Permissions-Policy` 基础限制：
  - `camera=()`
  - `microphone=()`
  - `geolocation=()`
  - `payment=()`
  - `usb=()`
- 为 `/api/v1/health` 增加 header 回归测试。
- 更新 `.env.example`、部署说明、已知问题和交付边界文档。

## 非范围

- 不配置真实 TLS 证书、域名、反向代理或 CDN。
- 不默认启用 `SECURE_SSL_REDIRECT` 和 HSTS，避免破坏本地 HTTP 验收。
- 不声明 staging/production 已完成安全验收。

## 验收

- `cd backend && uv run pytest apps/common/tests/test_health.py -q`
- `cd backend && uv run pytest`
- `npm run e2e`
- `npm run e2e:browser`
- `pnpm lint`
- `pnpm build`
- `cd backend && uv run python manage.py check`
- `cd backend && uv run python manage.py makemigrations --check --dry-run`
- `cd backend && uv run python manage.py spectacular --file /tmp/crossborder-security-headers-openapi.yaml --validate`
- `git diff --check`
- `actionlint .github/workflows/ci.yml`
- YAML 解析 `current-state.yaml` 和 `task-graph.yaml`
