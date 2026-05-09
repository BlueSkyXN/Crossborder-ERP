# AUDIT-RETENTION-001 审计日志导出与本地留存

## 背景

`AUDITLOG-001` 已完成后台写操作审计和查询面板，但生产化差距中仍保留“审计日志长期归档、导出和留存策略”。本轮先补不依赖外部服务的 SQLite-first 能力：CSV 导出和显式本地留存清理命令。

## 关键实现

- 后端新增 `/api/v1/admin/audit-logs/export.csv`，复用现有审计筛选和 `audit.logs.view` 权限。
- CSV 导出字段包括操作人、动作、对象、请求、状态、IP、UA、脱敏请求/响应 JSON，最多导出最近 5000 条匹配记录。
- 新增 `purge_audit_logs --older-than-days N [--dry-run]` management command，用于本地或运维脚本显式清理旧日志。
- Admin Web `/audit-logs` 新增 `导出 CSV` 按钮。
- Browser Smoke 增加审计日志页导出入口可见性检查。

## 验证

- `cd backend && uv run pytest apps/audit/tests/test_audit_logs.py -q`：5 passed。
- `cd backend && uv run pytest`：129 passed。
- `npm run e2e`：passed。
- `npm run e2e:browser`：passed，Admin Web 审计日志页检查到导出入口。
- `pnpm lint`：passed。
- `pnpm build`：passed。
- `cd backend && uv run python manage.py check`：passed。
- `cd backend && uv run python manage.py makemigrations --check --dry-run`：passed，No changes detected。
- `cd backend && uv run python manage.py spectacular --file /tmp/crossborder-audit-retention-openapi.yaml --validate`：passed。
- `git diff --check`：passed。
- `actionlint .github/workflows/ci.yml`：passed。
- Ruby YAML parse：`yaml ok`，仅出现已知 `/Volumes/TP4000PRO` world-writable PATH warning。

## 未验证边界

- 未接外部 SIEM、日志归档仓库、告警规则或对象存储。
- 未自动执行留存清理，避免在未确认生产策略前删除数据。
- PostgreSQL/MySQL/Redis/Celery/Docker 仍未真实验证。
