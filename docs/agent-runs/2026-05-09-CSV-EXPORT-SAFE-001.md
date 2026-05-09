# CSV-EXPORT-SAFE-001 CSV 导出公式注入防护

## 输入

- 完成度审计显示项目仍有本地可验证的文件/导出安全增强空间。
- 当前系统已有包裹 CSV 导出和审计日志 CSV 导出，但导出内容可能包含用户输入或审计请求字段。
- 用户约束仍是 SQLite-first、no-Docker、不安装全局依赖、不下载额外服务。

## Agent 决策

- 选择 CSV 导出公式注入防护作为下一张本地可验证生产化任务。
- 新增共享 `apps.common.csv_exports`，避免包裹导出和审计导出各自实现不同转义规则。
- 对以 `=`、`+`、`-`、`@`、tab、回车、换行开头，或去除左侧空白后命中公式前缀的值，前置单引号，让表格软件按文本处理。
- 不把本轮扩大为导出审批、外部 DLP、对象存储或完整数据泄露防护。

## 修改

- 新增 `safe_csv_cell()` 和 `safe_csv_row()`。
- 包裹 CSV 模板/导出统一通过 `safe_csv_row()` 写出。
- 审计日志 CSV 导出通过 `safe_csv_row()` 写出。
- 新增共享 sanitizer 单测、包裹导出公式样式字段转义测试、审计导出公式样式字段转义测试。
- 更新任务图、current-state、README、gap map、backlog、known issues、delivery audit、implementation decisions 和本 Agent run。

## 验证

- `cd backend && uv run pytest apps/common/tests/test_csv_exports.py apps/parcels/tests/test_parcel_imports.py apps/audit/tests/test_audit_logs.py -q`：23 passed。
- `cd backend && uv run pytest`：204 passed，1 个 Django 覆盖 `DATABASES` 的既有 warning。
- `cd backend && uv run python manage.py check`：passed。
- `cd backend && uv run python manage.py makemigrations --check --dry-run`：No changes detected。
- `cd backend && uv run python manage.py spectacular --file /tmp/crossborder-csv-export-safe001-openapi.yaml --validate`：passed。
- `npm run e2e`：passed。
- `npm run e2e:browser`：passed，使用 `.tmp/browser-e2e` 隔离 SQLite、media 和 Chrome profile。
- `pnpm lint`：passed。
- `pnpm build`：passed。
- `npm run evidence`：passed，检查 58 个任务和 57 份 Agent run 摘要。
- `git diff --check`：passed。
- `actionlint .github/workflows/ci.yml`：passed。
- YAML parse：passed；Ruby 提示 `/Volumes/TP4000PRO` world-writable PATH warning，属当前外置盘环境既有 warning。

## 未验证边界

- 不做导出审批、外部 DLP、水印、下载审计增强或外部 SIEM。
- 不修改 CSV 导入语义；导入侧公式样式内容仍按普通文本业务数据处理。
- 不改变 `.xlsx` 模板生成或解析。
- PostgreSQL/MySQL/Redis/Celery/Docker 仍不真实验证。

## 下一步

- 后续可继续在真实生产化阶段补导出审批、DLP、下载水印、审计告警和对象存储归档。
