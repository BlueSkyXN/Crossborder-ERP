# SECURITY-HEADERS-001 基础安全响应头

## 背景

`AUDIT-RETENTION-001` 后，项目仍有生产化边界缺口。当前继续遵守 no-Docker、SQLite-first、不真实验证 PostgreSQL/MySQL/Redis 的约束，本轮只补本地可验证的应用层安全响应头。

## 关键实现

- 在 Django settings 中显式配置 `SECURE_CONTENT_TYPE_NOSNIFF`、`SECURE_REFERRER_POLICY`、`SECURE_CROSS_ORIGIN_OPENER_POLICY` 和 `X_FRAME_OPTIONS`。
- 新增 `PermissionsPolicyMiddleware`，统一输出 `Permissions-Policy`，默认禁用 camera、microphone、geolocation、payment 和 usb。
- 增加 `/api/v1/health` 回归测试，断言基础安全 header 已真实输出。
- `.env.example` 增加相关环境变量，保留 HSTS 和 HTTPS redirect 的显式开关。
- 更新 README、部署说明、任务图、生产化 backlog、差距地图、已知问题和交付审计。

## 验证

- `cd backend && uv run pytest apps/common/tests/test_health.py -q`：2 passed。
- `cd backend && uv run pytest`：130 passed。
- `npm run e2e`：passed。
- `npm run e2e:browser`：passed，沿用 system Chrome 和 `.tmp/browser-e2e/` 临时 profile。
- `pnpm lint`：passed。
- `pnpm build`：passed。
- `cd backend && uv run python manage.py check`：passed。
- `cd backend && uv run python manage.py makemigrations --check --dry-run`：passed，No changes detected。
- `cd backend && uv run python manage.py spectacular --file /tmp/crossborder-security-headers-openapi.yaml --validate`：passed。
- `git diff --check`：passed。
- `actionlint .github/workflows/ci.yml`：passed。
- Ruby YAML parse：`yaml ok`，仅出现已知 `/Volumes/TP4000PRO` world-writable PATH warning。

## 未验证边界

- 未配置真实 TLS 证书、域名、反向代理或 CDN。
- `SECURE_HSTS_SECONDS` 和 `SECURE_SSL_REDIRECT` 默认关闭，真实 HTTPS 环境验证前不声明完成。
- PostgreSQL/MySQL/Redis/Celery/Docker 仍未真实验证。
