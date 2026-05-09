# AUDIT-RETENTION-001 审计日志导出与本地留存

## 目标

在 `AUDITLOG-001` 基础上补齐审计日志的基础运维能力：后台可导出 CSV，本地环境可按留存窗口清理旧日志。该任务只覆盖 SQLite-first/local-first 可验证能力，不接外部 SIEM。

## 关联来源

- `docs/source-report-gap-map.md`：操作日志/审计缺口。
- `docs/production-readiness-backlog.md`：生产化边界中的日志归档、告警和部署验证方向。
- `docs/known-issues-and-roadmap.md`：审计日志长期归档和细粒度覆盖仍需增强。

## 范围

- 后端新增 Admin audit logs CSV export endpoint，复用现有筛选权限和脱敏后的审计数据。
- 后端新增 `purge_audit_logs` management command，支持 `--older-than-days` 和 `--dry-run`。
- Admin Web 审计日志页增加 `导出 CSV` 入口。
- Browser Smoke 检查审计日志页导出入口可见。
- 文档、任务图和完成态审计同步更新。

## 约束

- 不引入外部日志服务、SIEM、对象存储或队列。
- 不启动 Docker/PostgreSQL/MySQL/Redis。
- CSV export 不绕过 `audit.logs.view` 权限，不导出未脱敏原始密码/token。
- 留存清理命令只做本地显式命令，不自动删除生产数据。

## 验证

```bash
cd backend && uv run pytest apps/audit/tests/test_audit_logs.py -q
cd backend && uv run pytest
npm run e2e
npm run e2e:browser
pnpm lint
pnpm build
cd backend && uv run python manage.py check
cd backend && uv run python manage.py makemigrations --check --dry-run
cd backend && uv run python manage.py spectacular --file /tmp/crossborder-audit-retention-openapi.yaml --validate
git diff --check
actionlint .github/workflows/ci.yml
```

## Done

- 后台审计日志支持 CSV 导出。
- 导出结果保留脱敏，不泄露明文密码/token。
- 本地留存清理命令支持 dry-run 和实际删除旧日志。
- PR CI 通过并合并到 `main`。
