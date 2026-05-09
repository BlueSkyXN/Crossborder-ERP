# IMPORT-XLSX-001 Excel 批量预报解析

## 目标

补齐源报告中“Excel 模板批量导入包裹预报”的剩余缺口，在不新增项目依赖、不启动外部服务的前提下，让用户 Web 的批量预报同时支持 CSV 和标准 `.xlsx` 工作簿。

## 关联来源

- `docs/source-report-gap-map.md`：批量导入/导出缺口。
- `docs/production-readiness-backlog.md`：Excel 原生解析增强。
- `docs/ai-dev-baseline/04-api-database-contract.md`：包裹预报和导入任务契约。

## 范围

- 后端新增 `.xlsx` 模板下载 endpoint。
- 后端新增标准 `.xlsx` 解析，复用现有导入表头、行级校验、错误记录和 all-or-none 事务语义。
- User Web 批量预报入口支持下载 Excel 模板，并允许选择 `.csv` 或 `.xlsx` 文件。
- Browser Smoke 至少检查 User Web 批量预报入口暴露 Excel 模板。
- 更新 README、gap map、backlog、已知问题和交付审计。

## 约束

- 不新增 Python/Node 依赖，不下载浏览器或外部服务。
- 不支持旧版二进制 `.xls`，导入时应提示另存为 `.xlsx` 或 CSV。
- 不处理复杂公式求值、多 sheet 合并、宏工作簿或第三方 Excel 方言。
- PostgreSQL/MySQL/Redis/Celery/Docker 仍不进入本任务验证。

## 验证

```bash
cd backend && uv run pytest apps/parcels/tests/test_parcel_imports.py -q
cd backend && uv run pytest
npm run e2e
npm run e2e:browser
pnpm lint
pnpm build
cd backend && uv run python manage.py check
cd backend && uv run python manage.py makemigrations --check --dry-run
cd backend && uv run python manage.py spectacular --file /tmp/crossborder-import-xlsx-openapi.yaml --validate
git diff --check
actionlint .github/workflows/ci.yml
```

## Done

- `.xlsx` 模板可下载，且是有效 workbook。
- 上传 `.xlsx` 后可创建批量预报包裹。
- 错误 `.xlsx` 生成失败导入 job，不创建部分包裹。
- CSV 既有能力不回退。
- PR CI 通过并合并到 `main`。
