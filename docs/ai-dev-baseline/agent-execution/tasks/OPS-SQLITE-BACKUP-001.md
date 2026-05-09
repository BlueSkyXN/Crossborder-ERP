# OPS-SQLITE-BACKUP-001 SQLite 本地备份命令

## 背景

当前项目按 SQLite-first 验收，`backend/db.sqlite3` 是唯一真实验证数据库。生产级缺口中仍包含备份与恢复策略，本轮先补当前阶段可本地验证的显式 SQLite 备份命令。

## 范围

- 新增 `backup_sqlite` Django management command。
- 支持：
  - `--database` 指定 Django database alias。
  - `--output-dir` 指定备份目录。
  - `--filename` 指定备份文件名。
  - `--dry-run` 预演源库与目标路径，不创建文件。
  - `--force` 明确覆盖已有备份。
- 默认输出到 ignored 的 `backend/backups/`。
- 使用 SQLite backup API 生成可还原 `.sqlite3` 文件。
- 对非 SQLite、`:memory:` 和已存在目标文件给出明确失败；仅在 `--force` 下覆盖。

## 非范围

- 不声明 PostgreSQL/MySQL 生产备份完成。
- 不接对象存储、远程备份、加密、备份轮转、恢复演练或告警。
- 不自动执行备份，避免未确认保留期前产生隐式数据副本。

## 验收

- `cd backend && uv run pytest apps/common/tests/test_backup_sqlite.py -q`
- `cd backend && uv run python manage.py backup_sqlite --dry-run`
- `cd backend && uv run pytest`
- `npm run e2e`
- `npm run e2e:browser`
- `pnpm lint`
- `pnpm build`
- `cd backend && uv run python manage.py check`
- `cd backend && uv run python manage.py makemigrations --check --dry-run`
- `cd backend && uv run python manage.py spectacular --file /tmp/crossborder-ops-sqlite-backup-openapi.yaml --validate`
- `git diff --check`
- `actionlint .github/workflows/ci.yml`
- YAML 解析 `current-state.yaml` 和 `task-graph.yaml`
