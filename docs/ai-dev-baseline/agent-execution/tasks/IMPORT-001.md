# IMPORT-001 批量导入/导出基础

phase: `P6_PRODUCTION_GAP`
depends_on: `CONTENT-001`
next: `QA-BROWSER-001`

## 目标

补齐跨境 ERP 常用的批量导入/导出基础能力，优先覆盖包裹预报模板下载、批量预报导入、错误明细返回和基础导出策略。继续遵守 no-Docker、SQLite-first，不新增未验证的外部服务。

## 来源

- ChatGPT Admin/User Web 报告要求 Excel 导入、模板下载和列表导出。
- Gemini Admin 报告要求 WMS/运营后台具备批量处理能力。
- 当前 `FILE-001` 已提供本地上传和文件元数据，可作为导入文件入口。

## 必须做

- 先确认仓库内是否已有 CSV/XLSX 相关依赖或工具，优先复用；没有可靠依赖时使用 CSV fallback，不随机安装全局依赖。
- 后端补导入模板下载、导入校验、错误明细和导入结果记录。
- 至少覆盖包裹预报批量导入，必要时保留运单/商品导出的扩展接口。
- Admin Web/User Web 按权限和业务角色补入口，避免把后台内部导入能力暴露给无权限用户。
- 增加字段校验、错误行、重复单号、权限隔离和 SQLite 回归测试。
- 更新 README、gap map、backlog、Agent run 和 E2E/测试说明。

## 不要做

- 不接第三方 Excel 云服务。
- 不引入 Docker、PostgreSQL/MySQL/Redis 真实验证。
- 不把所有列表导出一次性做完；先完成可验收的基础导入/导出框架。
- 不吞掉导入错误；必须返回可定位到行号/字段的错误信息。

## 验收

```bash
cd backend && uv run python manage.py makemigrations --check --dry-run
cd backend && uv run pytest
pnpm lint
pnpm build
npm run e2e
git diff --check
```

补充验收：

- 导入失败不能产生部分不可追踪数据。
- 用户只能导入自己的预报数据，后台导出需走 RBAC。
- 生成的模板和导出文件不得提交到 git。
